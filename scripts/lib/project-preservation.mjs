// MIT. Read-only evidence for a bounded agent trial; never follows file links.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";

const hash = (value) => createHash("sha256").update(value).digest("hex");
function git(project, args) {
  return execFileSync("git", ["-C", project, ...args], {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8_000_000,
  });
}
export function captureProjectState(project, ownerFiles = []) {
  if (
    !Array.isArray(ownerFiles) ||
    ownerFiles.length > 16 ||
    ownerFiles.some(
      (path) =>
        typeof path !== "string" ||
        !path ||
        isAbsolute(path) ||
        path.split(/[\\/]/).some((segment) => ["..", ".git"].includes(segment)),
    )
  )
    throw Error("Choose at most sixteen exact project-relative owner files.");
  const root = realpathSync(project);
  const top = realpathSync(git(root, ["rev-parse", "--show-toplevel"]).trim());
  if (top !== root)
    throw Error("Select the project repository root explicitly.");
  const source = git(root, ["rev-parse", "HEAD"]).trim();
  const status = git(root, ["status", "--porcelain=v1", "-z"]);
  const listed = git(root, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ])
    .split("\0")
    .filter(Boolean)
    .sort();
  const paths = [...new Set([...listed, ...ownerFiles])].sort();
  if (paths.length > 20_000)
    throw Error("Project exceeds this bounded trial snapshot.");
  const files = Object.create(null);
  for (const path of paths) {
    const file = join(root, path);
    let stat;
    try {
      stat = lstatSync(file);
    } catch (error) {
      if (error.code !== "ENOENT" || ownerFiles.includes(path)) throw error;
      files[path] = { kind: "missing", sha256: hash("missing") };
      continue;
    }
    const parent = realpathSync(dirname(file));
    if (parent !== root && !parent.startsWith(root + sep))
      throw Error("A listed parent escapes the selected project.");
    if (stat.isSymbolicLink()) {
      files[path] = { kind: "symlink", sha256: hash(readlinkSync(file)) };
      continue;
    }
    if (!stat.isFile())
      throw Error(
        "Directory or submodule requires its own explicit trial: " + path,
      );
    const descriptor = openSync(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const opened = fstatSync(descriptor);
      if (
        !opened.isFile() ||
        opened.dev !== stat.dev ||
        opened.ino !== stat.ino
      )
        throw Error("Project file changed during capture.");
      const digest = createHash("sha256"),
        buffer = Buffer.alloc(65536);
      let length;
      while (
        (length = readSync(descriptor, buffer, 0, buffer.length, null)) > 0
      )
        digest.update(buffer.subarray(0, length));
      const after = fstatSync(descriptor);
      if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs)
        throw Error("Project file changed during capture.");
      files[path] = { kind: "file", sha256: digest.digest("hex") };
    } finally {
      closeSync(descriptor);
    }
  }
  if (
    source !== git(root, ["rev-parse", "HEAD"]).trim() ||
    status !== git(root, ["status", "--porcelain=v1", "-z"])
  )
    throw Error("Project source or status changed during capture.");
  return {
    schema: "composer.project-preservation/1",
    source,
    status,
    coverage:
      "tracked and nonignored untracked files, plus explicitly selected owner files; other ignored data/configuration excluded",
    ownerFiles: [...ownerFiles].sort(),
    files,
  };
}
function validReceipt(value) {
  return (
    value?.schema === "composer.project-preservation/1" &&
    /^[a-f0-9]{40}$/.test(value.source) &&
    typeof value.status === "string" &&
    Array.isArray(value.ownerFiles) &&
    value.ownerFiles.every((path) => typeof path === "string") &&
    value.files &&
    !Array.isArray(value.files) &&
    typeof value.files === "object" &&
    Object.values(value.files).every(
      (file) =>
        file &&
        ["file", "symlink", "missing"].includes(file.kind) &&
        /^[a-f0-9]{64}$/.test(file.sha256),
    )
  );
}
export function compareProjectState(before, after) {
  if (
    !validReceipt(before) ||
    !validReceipt(after) ||
    JSON.stringify(before.ownerFiles) !== JSON.stringify(after.ownerFiles)
  )
    throw Error("Select two supported project-preservation receipts.");
  const paths = [
    ...new Set([...Object.keys(before.files), ...Object.keys(after.files)]),
  ].sort();
  const changedFiles = paths.filter(
    (path) =>
      JSON.stringify(before.files[path]) !== JSON.stringify(after.files[path]),
  );
  return {
    unchanged:
      before.source === after.source &&
      before.status === after.status &&
      changedFiles.length === 0,
    sourceChanged: before.source !== after.source,
    statusChanged: before.status !== after.status,
    changedFiles,
  };
}
