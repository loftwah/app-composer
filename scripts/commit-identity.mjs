// Provenance hygiene, not a permissions system. An agent lane must not invent a
// GitHub noreply address: `lane-e@users.noreply.github.com` was attributed to a
// real, unrelated @LAne-E account. This guard reads identity facts, never
// verifies an account, and never rewrites history.
//
// Modes:
//   --check-config         validate the configured author identity (used by pnpm check)
//   --range <git range>    validate every commit in a range (e.g. origin/main..HEAD)
//   --message <file>       validate a commit message file (commit-msg hook)
//   --install              point this clone at the tracked hooks directory
import { execFileSync } from "node:child_process";
import { readFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Addresses the owner has explicitly approved for automated work. */
const APPROVED = new Map([
  ["worker@minimax.local", "the shared agent worker identity used by this repository's trains"],
  ["dean@deanlofts.xyz", "the owner"],
]);

const NUMERIC_NOREPLY = /^\d+\+[A-Za-z0-9-]+@users\.noreply\.github\.com$/;
const INVENTED_NOREPLY = /^[^@\s]+@users\.noreply\.github\.com$/;
const LANE_LOCAL = /^(lane|agent|worker|bot)[-_.]?[a-z0-9]*@(?!minimax\.local)/i;

/**
 * Classify one identity. Returns {level, reason}.
 * `block` is reserved for a confirmed fabrication vector; old commits are
 * checked only when they are inside the requested range.
 */
export function classifyIdentity({ name = "", email = "" } = {}) {
  const address = String(email).trim().toLowerCase();
  if (!address) return { level: "block", reason: "no author email is set" };
  if (APPROVED.has(address)) return { level: "ok", reason: APPROVED.get(address) };
  if (NUMERIC_NOREPLY.test(address)) return { level: "ok", reason: "a GitHub noreply address bound to a numeric account id" };
  if (INVENTED_NOREPLY.test(address))
    return {
      level: "block",
      reason:
        "an invented users.noreply.github.com address can be attributed to a real stranger; " +
        "use the owner's address, the shared worker address, or the numeric `<id>+<login>@users.noreply.github.com` form",
    };
  if (LANE_LOCAL.test(address))
    return {
      level: "block",
      reason: "a lane or agent name is not an identity; keep it in the branch, PR and work record",
    };
  if (!String(name).trim()) return { level: "warn", reason: "the author name is empty" };
  if (/localhost|example\.(com|org|net)|invalid$/i.test(address))
    return { level: "warn", reason: "the address is a placeholder, not a real identity" };
  return { level: "ok", reason: "an ordinary address" };
}

/** Trailers that claim additional authorship in one commit message. */
export function trailerIdentities(message = "") {
  const found = [];
  for (const line of String(message).split(/\r?\n/)) {
    const match = /^(?:co-authored-by|authored-by|signed-off-by):\s*(.*)<([^>]+)>\s*$/i.exec(line.trim());
    if (match) found.push({ name: match[1].trim(), email: match[2].trim() });
  }
  return found;
}

/** Check a commit message's trailers plus the author it will be recorded with. */
export function checkMessage(message, author) {
  const problems = [];
  const authorResult = classifyIdentity(author);
  if (authorResult.level === "block") problems.push({ ...authorResult, who: `${author.name} <${author.email}>` });
  for (const trailer of trailerIdentities(message)) {
    const result = classifyIdentity(trailer);
    if (result.level === "block") problems.push({ ...result, who: `${trailer.name} <${trailer.email}>` });
  }
  return problems;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function configuredIdentity() {
  return { name: git(["config", "user.name"]), email: git(["config", "user.email"]) };
}

function rangeIdentities(range) {
  const raw = git(["log", "--format=%H%x1f%an%x1f%ae%x1f%B%x1e", range]);
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, name, email, ...rest] = entry.split("\x1f");
      return { sha, name, email, message: rest.join("\x1f") };
    });
}

function report(problems, context) {
  if (!problems.length) {
    console.log(`Commit identity check passed${context ? ` (${context})` : ""}.`);
    return 0;
  }
  console.error(`Commit identity check failed${context ? ` (${context})` : ""}:`);
  for (const problem of problems) console.error(`- ${problem.who ?? ""} ${problem.reason}`.trim());
  console.error(
    "Fix: `git config user.name \"Worker\"` and `git config user.email \"worker@minimax.local\"`, " +
      "or use the owner identity. Never invent a users.noreply.github.com address.",
  );
  return 1;
}

export function main(argv = process.argv.slice(2)) {
  const args = [...argv];
  const mode = args.shift();
  if (mode === "--check-config") {
    const identity = configuredIdentity();
    const result = classifyIdentity(identity);
    return report(result.level === "block" ? [{ ...result, who: `${identity.name} <${identity.email}>` }] : [], "configured identity");
  }
  if (mode === "--range") {
    const range = args[0] ?? "origin/main..HEAD";
    const problems = [];
    for (const commit of rangeIdentities(range)) {
      const author = classifyIdentity(commit);
      if (author.level === "block") problems.push({ ...author, who: `${commit.sha.slice(0, 8)} ${commit.name} <${commit.email}>` });
      for (const trailer of trailerIdentities(commit.message)) {
        const result = classifyIdentity(trailer);
        if (result.level === "block") problems.push({ ...result, who: `${commit.sha.slice(0, 8)} trailer ${trailer.name} <${trailer.email}>` });
      }
    }
    return report(problems, range);
  }
  if (mode === "--message") {
    const file = args[0];
    if (!file) {
      console.error("usage: --message <commit-message-file>");
      return 2;
    }
    const problems = checkMessage(readFileSync(file, "utf8"), configuredIdentity());
    return report(problems, "commit message");
  }
  if (mode === "--install") {
    git(["config", "core.hooksPath", ".githooks"]);
    chmodSync(fileURLToPath(new URL("../.githooks/commit-msg", import.meta.url)), 0o755);
    console.log("hooks installed: core.hooksPath=.githooks");
    return 0;
  }
  console.error("usage: commit-identity.mjs --check-config | --range <git range> | --message <file> | --install");
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main());
