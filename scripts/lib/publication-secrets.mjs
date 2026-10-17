// Publication-only guard adapted from Woodhouse #56. Findings contain labels and
// paths, never matched bytes. No source/config name prefix grants an exemption.
import { execFileSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, posix } from "node:path";
import { gunzipSync, inflateRawSync } from "node:zlib";

const patterns = [
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  ],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Stripe secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Resend secret", /\bre_[A-Za-z0-9]{24,}\b/],
  ["EmDash token", /\bec_pat_[A-Za-z0-9]{16,}\b/],
  [
    "JSON web token",
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  ],
  [
    "private key",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  ],
];
const maxBytes = 64 * 1024 * 1024;
const maxExpandedBytes = 256 * 1024 * 1024;

export function riskyPath(name) {
  const parts = String(name).replaceAll("\\", "/").toLowerCase().split("/");
  if (parts.some((part) => [".git", ".ssh", ".aws", ".gcloud"].includes(part)))
    return "credential directory";
  const base = parts.at(-1) ?? "";
  if (
    /^(?:\.env(?:[.~].*)?|\.dev\.vars.*)$/.test(base) ||
    /\.env(?:[.~].*)?$/.test(base)
  )
    return "environment file";
  if (
    /^(?:\.npmrc|\.netrc|\.git-credentials|\.htpasswd|id_(?:rsa|dsa|ecdsa|ed25519)|(?:service-account|credentials)\.json)(?:[.~].*)?$/.test(
      base,
    )
  )
    return "credential file";
  if (/\.(?:pem|key|p12|pfx|keystore|jks|ppk|der)(?:[.~].*)?$/.test(base))
    return "key material";
  return null;
}

export function privateValues(environment = process.env) {
  // Intentional public configuration has no credential-like name in these
  // projects (PUBLIC_ORIGIN and VITE_CLOUD_API_URL are URLs). PUBLIC_*KEY/TOKEN
  // remain private, including opaque credentials without a recognisable shape.
  return [
    ...new Set(
      Object.entries(environment)
        .filter(
          ([name, value]) =>
            /key|token|secret|password|passwd|credential/i.test(name) &&
            typeof value === "string" &&
            value.length >= 8,
        )
        .map(([, value]) => value),
    ),
  ];
}

export function textFindings(bytes, values = []) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes);
  const found = patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
  if (values.some((value) => value.length >= 8 && text.includes(value)))
    found.push("configured private value");
  return found;
}

function safeMember(name) {
  return (
    name &&
    !name.includes("\0") &&
    !name.includes("\\") &&
    !name.startsWith("/") &&
    !/^[a-z]:/i.test(name) &&
    !name.split("/").includes("..")
  );
}

// Read the exact compressed bytes we publish, not merely an archive listing or
// its uncompressed source inputs. Never extract into a filesystem. Unsupported,
// malformed, linked, encrypted or oversized members fail closed.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function archiveMembers(name, bytes) {
  if (/\.(?:tgz|tar\.gz)$/i.test(name)) {
    const tar = gunzipSync(bytes, { maxOutputLength: maxExpandedBytes });
    const files = [],
      names = new Set();
    let end = 0;
    while (end + 512 <= tar.length) {
      const header = tar.subarray(end, end + 512);
      if (header.every((byte) => byte === 0)) break;
      const string = (from, to) =>
        header.subarray(from, to).toString("utf8").split("\0")[0];
      const checksum = string(148, 156).trim();
      const actualChecksum = [...header].reduce(
        (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
        0,
      );
      if (
        !/^[0-7]+$/.test(checksum) ||
        Number.parseInt(checksum, 8) !== actualChecksum
      )
        throw Error("invalid tar checksum");
      const sizeText = string(124, 136).trim();
      if (!/^[0-7]+$/.test(sizeText)) throw Error("unsupported tar size");
      const size = Number.parseInt(sizeText, 8);
      const member = [string(345, 500), string(0, 100)]
        .filter(Boolean)
        .join("/");
      const type = string(156, 157);
      if (
        !safeMember(member) ||
        !["", "0", "5"].includes(type) ||
        size > maxBytes ||
        end + 512 + size > tar.length
      )
        throw Error("unsupported tar member");
      const canonical = posix.normalize(member.replace(/\/$/, ""));
      if (names.has(canonical) || (type === "5" && size !== 0))
        throw Error("duplicate or nonempty directory member");
      names.add(canonical);
      if (type !== "5")
        files.push([member, tar.subarray(end + 512, end + 512 + size)]);
      end += 512 + Math.ceil(size / 512) * 512;
      if (files.length > 10000) throw Error("too many archive members");
    }
    if (
      !files.length ||
      end + 1024 > tar.length ||
      !tar.subarray(end).every((byte) => byte === 0)
    )
      throw Error("invalid tar archive");
    return files;
  }
  if (/\.zip$/i.test(name)) {
    let end = bytes.length - 22;
    while (
      end >= Math.max(0, bytes.length - 65557) &&
      bytes.readUInt32LE(end) !== 0x06054b50
    )
      end--;
    if (
      end < 0 ||
      bytes.readUInt32LE(end) !== 0x06054b50 ||
      end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
    )
      throw Error("invalid zip directory");
    const count = bytes.readUInt16LE(end + 10);
    if (
      bytes.readUInt32LE(end + 4) !== 0 ||
      count !== bytes.readUInt16LE(end + 8) ||
      count > 10000
    )
      throw Error("unsupported zip volume");
    let cursor = bytes.readUInt32LE(end + 16),
      expanded = 0;
    const files = [],
      names = new Set();
    const centralStart = cursor;
    let localCursor = 0;
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50)
        throw Error("invalid zip member");
      const flags = bytes.readUInt16LE(cursor + 8),
        method = bytes.readUInt16LE(cursor + 10);
      const packed = bytes.readUInt32LE(cursor + 20),
        size = bytes.readUInt32LE(cursor + 24);
      const length = bytes.readUInt16LE(cursor + 28),
        extra = bytes.readUInt16LE(cursor + 30),
        comment = bytes.readUInt16LE(cursor + 32);
      const member = bytes
        .subarray(cursor + 46, cursor + 46 + length)
        .toString("utf8");
      const mode = bytes.readUInt32LE(cursor + 38) >>> 16;
      if (
        !safeMember(member) ||
        (mode & 0xf000) === 0xa000 ||
        (flags & ~0x800) !== 0 ||
        ![0, 8].includes(method) ||
        size > maxBytes
      )
        throw Error("unsupported zip member");
      const canonical = posix.normalize(member.replace(/\/$/, ""));
      if (names.has(canonical) || (member.endsWith("/") && size !== 0))
        throw Error("duplicate or nonempty directory member");
      names.add(canonical);
      const local = bytes.readUInt32LE(cursor + 42);
      if (local !== localCursor)
        throw Error("unindexed or overlapping zip data");
      if (local + 30 > cursor || bytes.readUInt32LE(local) !== 0x04034b50)
        throw Error("invalid zip local header");
      const localLength = bytes.readUInt16LE(local + 26);
      if (
        bytes
          .subarray(local + 30, local + 30 + localLength)
          .toString("utf8") !== member ||
        bytes.readUInt16LE(local + 8) !== method ||
        bytes.readUInt16LE(local + 6) !== flags ||
        bytes.readUInt32LE(local + 14) !== bytes.readUInt32LE(cursor + 16) ||
        bytes.readUInt32LE(local + 18) !== packed ||
        bytes.readUInt32LE(local + 22) !== size
      )
        throw Error("zip local header differs");
      const start = local + 30 + localLength + bytes.readUInt16LE(local + 28);
      if (start + packed > centralStart) throw Error("invalid zip data");
      localCursor = start + packed;
      const raw = bytes.subarray(start, start + packed);
      const data =
        method === 8 ? inflateRawSync(raw, { maxOutputLength: maxBytes }) : raw;
      expanded += data.length;
      if (
        data.length !== size ||
        crc32(data) !== bytes.readUInt32LE(cursor + 16) ||
        expanded > maxExpandedBytes
      )
        throw Error("invalid expanded zip size");
      if (!member.endsWith("/")) files.push([member, data]);
      cursor += 46 + length + extra + comment;
    }
    if (cursor !== end || localCursor !== centralStart || !files.length)
      throw Error("invalid zip directory size");
    return files;
  }
  return null;
}

export function scanPublication({ roots, values = privateValues() }) {
  const findings = [];
  let files = 0,
    members = 0;
  const add = (path, label) =>
    findings.push({
      path: textFindings(path, values).length
        ? "<redacted publication path>"
        : path,
      label,
    });
  function inspect(name, bytes, depth = 0) {
    if (textFindings(name, values).length)
      add(name, "private value in publication path");
    const reason = riskyPath(name);
    if (reason) add(name, "published " + reason);
    for (const label of textFindings(bytes, values)) add(name, label);
    try {
      if (bytes.length > maxBytes) throw Error("oversized publication file");
      if (/\.(?:zip|tgz|tar\.gz)$/i.test(name)) {
        if (depth >= 3) throw Error("nested archive limit");
        for (const [member, data] of archiveMembers(name, bytes)) {
          members++;
          inspect(name + "!" + member, data, depth + 1);
        }
      }
    } catch {
      add(name, "archive or file could not be safely inspected");
    }
  }
  for (const selected of roots) {
    const root = resolve(selected);
    let count = 0;
    function visit(file) {
      const stat = lstatSync(file);
      const name = relative(process.cwd(), file);
      if (stat.isSymbolicLink()) {
        add(name, "linked publication path");
        return;
      }
      if (stat.isDirectory()) {
        const reason = riskyPath(name + "/placeholder");
        if (reason) add(name, "published " + reason);
        for (const entry of readdirSync(file)) visit(join(file, entry));
      } else if (stat.isFile()) {
        count++;
        files++;
        if (stat.size > maxBytes) add(name, "oversized publication file");
        else inspect(name, readFileSync(file));
      } else add(name, "unsupported publication path");
    }
    try {
      visit(root);
    } catch {
      add(
        relative(process.cwd(), root),
        "publication root missing or unreadable",
      );
    }
    if (!count) add(relative(process.cwd(), root), "empty publication root");
  }
  return { ok: findings.length === 0, files, members, findings };
}

// The staged/tracked source inventory must not contain credential files either.
// The exact example-file exception is source-only; it never exempts build output
// or secret-shaped content. Callers choose their existing reviewed example path.
export function trackedPathFindings({
  directory = process.cwd(),
  publicExamples = [],
} = {}) {
  let names;
  try {
    names = execFileSync("git", ["ls-files", "-z"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    return [{ path: ".", label: "tracked source inventory unavailable" }];
  }
  const findings = [];
  for (const name of names) {
    const reason = riskyPath(name);
    if (!reason) continue;
    if (!publicExamples.includes(name))
      findings.push({ path: name, label: "tracked " + reason });
    else
      for (const label of textFindings(readFileSync(resolve(directory, name))))
        findings.push({ path: name, label });
  }
  return findings;
}
