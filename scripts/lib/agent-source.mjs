// Local source snapshots for the agent-proposal CLI.
//
// Only a hash and a bounded file manifest leave this module. File contents are
// never stored in the proposal database. Symlinks, secret-like filenames and
// secret-like content are refused before a proposal can be submitted.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { scanSecretMaterial } from "../../src/lib/agent-proposal-contract.ts";

export class SourceError extends Error {
  code;
  humanAction;
  constructor(code, message, humanAction) {
    super(message);
    this.name = "SourceError";
    this.code = code;
    this.humanAction = humanAction;
  }
}

const skippedDirectories = new Set([
  ".git",
  "node_modules",
  ".wrangler",
  ".astro",
  ".emdash",
  "dist",
  "output",
]);
const secretNames =
  /(^|[._-])(env|dev\.vars|pem|key|p12|pfx|npmrc|netrc|htpasswd)($|[._-])|^\.env|^\.dev\.vars|^id_(rsa|ed25519)$/i;
const limits = { files: 50, bytes: 2_000_000, fileBytes: 512_000 };

function hash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function within(root, target) {
  return target === root || target.startsWith(root + sep);
}

function walk(root, start, state) {
  const info = lstatSync(start);
  if (info.isSymbolicLink())
    throw new SourceError(
      "SYMLINK_REFUSED",
      `Source path ${relative(root, start) || "."} is a symbolic link.`,
      "Use a real path inside the selected repository; symlinks are not hashed.",
    );
  if (info.isDirectory()) {
    const name = start.split(sep).pop() ?? "";
    if (
      start !== root &&
      (skippedDirectories.has(name) || secretNames.test(name))
    )
      return;
    for (const entry of readdirSync(start).sort())
      walk(root, resolve(start, entry), state);
    return;
  }
  if (!info.isFile()) return;
  const rel = relative(root, start).split(sep).join("/");
  if (secretNames.test(rel.split("/").pop() ?? ""))
    throw new SourceError(
      "SECRET_FILENAME",
      `Source file ${rel} looks like secret material and was not read.`,
      "Exclude owner credentials and environment files from the proposed source.",
    );
  if (info.size > limits.fileBytes)
    throw new SourceError(
      "SOURCE_TOO_LARGE",
      `Source file ${rel} exceeds ${limits.fileBytes} bytes.`,
      "Propose a smaller, reviewable source snapshot.",
    );
  state.files += 1;
  state.bytes += info.size;
  if (state.files > limits.files || state.bytes > limits.bytes)
    throw new SourceError(
      "SOURCE_TOO_LARGE",
      `Source exceeds ${limits.files} files or ${limits.bytes} bytes.`,
      "Propose a smaller, reviewable source snapshot.",
    );
  const buffer = readFileSync(start);
  const text = buffer.toString("utf8");
  if (!text.includes("\u0000")) {
    const secrets = scanSecretMaterial(text);
    if (secrets.length)
      throw new SourceError(
        "SECRET_MATERIAL",
        `Source file ${rel} contains secret-like material (${secrets.map((item) => item.label).join(", ")}). The value was not stored.`,
        "Remove and rotate the value, then submit a redacted source.",
      );
  }
  state.entries.push({ path: rel, bytes: info.size, sha256: hash(buffer) });
}

function snapshot(root, target) {
  const state = { files: 0, bytes: 0, entries: [] };
  walk(root, target, state);
  if (!state.files)
    throw new SourceError(
      "EMPTY_SOURCE",
      "The selected source path contains no reviewable files.",
      "Choose a file or directory with the proposed source.",
    );
  const manifest = JSON.stringify(
    state.entries
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((entry) => `${entry.path}\u0000${entry.bytes}\u0000${entry.sha256}`)
      .join("\n"),
  );
  return {
    contentHash: hash(manifest),
    files: state.files,
    bytes: state.bytes,
    entries: state.entries,
  };
}

function repoRoot(path) {
  const root = realpathSync(path);
  if (!lstatSync(root).isDirectory())
    throw new SourceError(
      "INVALID_ROOT",
      "The repository root is not a directory.",
      "Pass a local checkout root.",
    );
  return root;
}

/** Hash the exact source a human will review. */
export function inspectSource(input, rootPath, now) {
  const root = repoRoot(rootPath);
  if (input.kind === "local-path") {
    let real;
    try {
      real = realpathSync(resolve(root, input.path));
    } catch {
      throw new SourceError(
        "SOURCE_MISSING",
        `Source path ${input.path} does not exist.`,
        "Correct the path; an absent source is not an empty proposal.",
      );
    }
    if (!within(root, real))
      throw new SourceError(
        "PATH_OUTSIDE_REPO",
        "The proposed source path is outside the selected repository.",
        "Keep proposals to files inside the repository the owner selected.",
      );
    const snap = snapshot(root, real);
    return {
      kind: "local-path",
      path: relative(root, real).split(sep).join("/") || ".",
      contentHash: snap.contentHash,
      files: snap.files,
      bytes: snap.bytes,
      checkedAt: now,
    };
  }
  let snap = null;
  if (input.checkout) {
    let real;
    try {
      real = realpathSync(resolve(root, input.checkout));
    } catch {
      throw new SourceError(
        "SOURCE_MISSING",
        `Checkout ${input.checkout} does not exist.`,
        "Correct the checkout path.",
      );
    }
    if (!within(root, real))
      throw new SourceError(
        "PATH_OUTSIDE_REPO",
        "The checkout path is outside the selected repository.",
        "Keep the checkout inside the selected repository.",
      );
    try {
      execFileSync(
        "git",
        ["-C", real, "cat-file", "-e", `${input.commit}^{commit}`],
        {
          stdio: "ignore",
        },
      );
    } catch {
      throw new SourceError(
        "COMMIT_MISSING",
        `Commit ${input.commit} is not in the selected checkout.`,
        "Fetch the exact source revision or choose a commit that exists locally.",
      );
    }
    snap = snapshot(real, real);
  }
  return {
    kind: "repo",
    repository: input.repository,
    commit: input.commit,
    checkout: input.checkout ?? null,
    contentHash: snap?.contentHash ?? null,
    files: snap?.files ?? 0,
    bytes: snap?.bytes ?? 0,
    checkedAt: snap ? now : null,
  };
}

/** Recheck a stored source. Read-only: it returns state and the current hash. */
export function checkSource(source, rootPath, now) {
  const root = repoRoot(rootPath);
  if (source.kind === "local-path") {
    try {
      const real = realpathSync(resolve(root, source.path));
      if (!within(root, real))
        return {
          state: "missing",
          detail: "The stored source path is outside this repository.",
          currentHash: null,
          checkedAt: now,
        };
      const snap = snapshot(root, real);
      if (snap.contentHash !== source.contentHash)
        return {
          state: "stale",
          detail: `The source content hash is ${snap.contentHash.slice(0, 12)}…, not the submitted ${source.contentHash.slice(0, 12)}….`,
          currentHash: snap.contentHash,
          checkedAt: now,
        };
      return {
        state: "current",
        detail: `${snap.files} file(s) and ${snap.bytes} byte(s) match the submitted content hash.`,
        currentHash: snap.contentHash,
        checkedAt: now,
      };
    } catch (error) {
      return {
        state: "missing",
        detail:
          error instanceof SourceError
            ? error.message
            : "The source path cannot be read.",
        currentHash: null,
        checkedAt: now,
      };
    }
  }
  if (!source.checkout)
    return {
      state: "pinned-commit",
      detail: `Repository ${source.repository} is pinned to commit ${source.commit}; no mutable checkout was supplied.`,
      currentHash: source.contentHash,
      checkedAt: now,
    };
  try {
    const real = realpathSync(resolve(root, source.checkout));
    if (!within(root, real))
      return {
        state: "missing",
        detail: "The stored checkout path is outside this repository.",
        currentHash: null,
        checkedAt: now,
      };
    execFileSync(
      "git",
      ["-C", real, "cat-file", "-e", `${source.commit}^{commit}`],
      { stdio: "ignore" },
    );
    const snap = snapshot(real, real);
    if (source.contentHash && snap.contentHash !== source.contentHash)
      return {
        state: "stale",
        detail:
          "The checkout content no longer matches the submitted content hash.",
        currentHash: snap.contentHash,
        checkedAt: now,
      };
    return {
      state: "current",
      detail: `Commit ${source.commit} exists and the checkout matches.`,
      currentHash: snap.contentHash,
      checkedAt: now,
    };
  } catch (error) {
    return {
      state: "missing",
      detail:
        error instanceof SourceError
          ? error.message
          : `Commit ${source.commit} is not present in the checkout.`,
      currentHash: null,
      checkedAt: now,
    };
  }
}
