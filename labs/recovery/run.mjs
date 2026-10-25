// Reproducible recovery drill: owned SQLite and object-directory fixtures only.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function runRecoveryDrill() {
  const root = mkdtempSync(join(tmpdir(), "composer-recovery-"));
  let db, server;
  const report = {
    version: "composer.isolated-recovery/1",
    environment: "owned-local-sqlite-filesystem",
    providerCalls: 0,
    observations: [],
    cleanup: false,
  };
  try {
    db = new DatabaseSync(join(root, "application.sqlite"));
    db.exec(
      `CREATE TABLE content(id TEXT PRIMARY KEY,body TEXT,visible INTEGER); CREATE TABLE access(user TEXT PRIMARY KEY,enabled INTEGER); CREATE TABLE retained_deletions(id TEXT PRIMARY KEY); INSERT INTO content VALUES('public','Original public record',1),('private','Private draft',0),('deleted','Retained deletion example',1); INSERT INTO access VALUES('owner',1),('revoked',1)`,
    );
    const media = Buffer.from("fictional-original-object-bytes");
    writeFileSync(join(root, "object.bin"), media);
    writeFileSync(join(root, "release.json"), JSON.stringify({ version: 1 }));
    db.prepare("VACUUM INTO ?").run(join(root, "backup.sqlite"));
    copyFileSync(join(root, "object.bin"), join(root, "object-backup.bin"));
    copyFileSync(join(root, "release.json"), join(root, "release-backup.json"));
    server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      const access = db
        .prepare("SELECT enabled FROM access WHERE user=?")
        .get(url.searchParams.get("actor"));
      if (!access?.enabled) {
        res.writeHead(403);
        res.end();
        return;
      }
      const id = url.pathname.split("/").pop();
      const row = db.prepare("SELECT * FROM content WHERE id=?").get(id);
      if (
        !row ||
        !row.visible ||
        db.prepare("SELECT id FROM retained_deletions WHERE id=?").get(id)
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      const release = JSON.parse(readFileSync(join(root, "release.json")));
      if (release.version === 2) {
        res.writeHead(500);
        res.end("predetermined incompatible release");
        return;
      }
      res.end(
        url.pathname.startsWith("/media/")
          ? readFileSync(join(root, "object.bin"))
          : row.body,
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = "http://127.0.0.1:" + server.address().port;
    const observe = async (stage, path, status, expected) => {
      const response = await fetch(origin + path, {
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        }),
        bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(response.status, status);
      if (expected !== undefined) assert.equal(hash(bytes), hash(expected));
      report.observations.push({ stage, path, status, sha256: hash(bytes) });
    };
    await observe(
      "baseline",
      "/content/public?actor=owner",
      200,
      "Original public record",
    );
    writeFileSync(join(root, "release.json"), JSON.stringify({ version: 2 }));
    db.exec(
      "UPDATE content SET body='Corrupted application data' WHERE id='public'; UPDATE access SET enabled=0 WHERE user='revoked'; INSERT INTO retained_deletions VALUES('deleted'); DELETE FROM content WHERE id='deleted'",
    );
    writeFileSync(join(root, "object.bin"), "corrupted-object");
    await observe("failure", "/content/public?actor=owner", 500);
    copyFileSync(join(root, "release-backup.json"), join(root, "release.json"));
    await observe(
      "code-rollback-only",
      "/content/public?actor=owner",
      200,
      "Corrupted application data",
    );
    await observe(
      "code-rollback-only",
      "/media/public?actor=owner",
      200,
      "corrupted-object",
    );
    // Restore application content only. Access and deletion constraints live outside
    // the restored content set; copying an entire old database would undo revocation.
    db.prepare("ATTACH DATABASE ? AS recovery").run(
      join(root, "backup.sqlite"),
    );
    db.exec(
      "BEGIN IMMEDIATE; DELETE FROM content; INSERT INTO content SELECT * FROM recovery.content WHERE id NOT IN (SELECT id FROM retained_deletions); COMMIT; DETACH DATABASE recovery",
    );
    await observe(
      "content-restored",
      "/content/public?actor=owner",
      200,
      "Original public record",
    );
    await observe(
      "content-restored-media-still-corrupt",
      "/media/public?actor=owner",
      200,
      "corrupted-object",
    );
    copyFileSync(join(root, "object-backup.bin"), join(root, "object.bin"));
    await observe("object-restored", "/media/public?actor=owner", 200, media);
    await observe("revocation-retained", "/content/public?actor=revoked", 403);
    await observe(
      "private-draft-retained",
      "/content/private?actor=owner",
      404,
    );
    await observe("deletion-retained", "/content/deleted?actor=owner", 404);
    report.result = {
      codeRollback: "restored-release-only",
      databaseRestore: "application-content-only",
      objectRecovery: "original-bytes-restored",
      revocation: "retained",
      privateDraft: "nonpublic",
      deletedRecord: "not-resurrected",
    };
    report.limits = [
      "Owned SQLite and filesystem object fixtures, not a Cloudflare D1/R2 provider restore.",
      "Selective content restore requires an app-specific schema and current deletion/access ledger. Never apply this fictional SQL to production.",
      "No production database, media, credential or access policy was read or modified.",
    ];
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((yes) => server.close(yes));
    }
    db?.close();
    rmSync(root, { recursive: true, force: true });
    report.cleanup = !existsSync(root);
  }
  assert.equal(report.cleanup, true);
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await runRecoveryDrill();
  const output = resolve(
    process.argv[2] ?? "output/recovery-drill/receipt.json",
  );
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
