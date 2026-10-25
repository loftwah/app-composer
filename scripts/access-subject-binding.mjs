import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { lstatSync } from "node:fs";
import {
  bindingInsertSql,
  validateSubjectBindingInput,
} from "../src/lib/access-subject-bindings.mjs";

const { values } = parseArgs({
  options: {
    database: { type: "string" },
    issuer: { type: "string" },
    subject: { type: "string" },
    "idp-id": { type: "string" },
    "upstream-issuer": { type: "string" },
    "upstream-subject": { type: "string" },
    user: { type: "string" },
    "expected-email": { type: "string" },
    "reviewed-by": { type: "string" },
    bind: { type: "boolean", default: false },
    revoke: { type: "boolean", default: false },
  },
});

if (!values.database)
  throw new Error("Select an explicit local SQLite database with --database");
if (!lstatSync(values.database).isFile())
  throw new Error("Select an existing unlinked SQLite file");
if (values.bind && values.revoke)
  throw new Error("Choose either --bind or --revoke");
const db = new DatabaseSync(values.database, {
  readOnly: !values.bind && !values.revoke,
});
try {
  if (!values.bind && !values.revoke) {
    const users = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    const bindings = db
      .prepare(
        `SELECT COUNT(*) AS count FROM composer_access_subject_bindings WHERE revoked_at IS NULL`,
      )
      .get().count;
    console.log(
      JSON.stringify({
        mode: "read-only",
        users,
        activeBindings: bindings,
        enforcement: "Runtime configuration must be checked separately",
      }),
    );
  } else {
    const input = validateSubjectBindingInput({
      issuer: values.issuer,
      subject: values.subject,
      idpId: values["idp-id"],
      upstreamIssuer: values["upstream-issuer"],
      upstreamSubject: values["upstream-subject"],
      userId: values.user,
      expectedEmail: values["expected-email"],
      reviewedBy: values["reviewed-by"],
    });
    if (values.revoke) {
      const result = db
        .prepare(
          `
        UPDATE composer_access_subject_bindings SET revoked_at=CURRENT_TIMESTAMP
        WHERE issuer=? AND subject=? AND idp_id=? AND upstream_issuer=?
          AND upstream_subject=? AND user_id=? AND reviewed_by=? AND revoked_at IS NULL
          AND EXISTS(SELECT 1 FROM users WHERE id=? AND email=?)
      `,
        )
        .run(
          input.issuer,
          input.subject,
          input.idpId,
          input.upstreamIssuer,
          input.upstreamSubject,
          input.userId,
          input.reviewedBy,
          input.userId,
          input.expectedEmail,
        );
      if (Number(result.changes) !== 1)
        throw new Error(
          "Revocation refused: current active reviewed binding did not match",
        );
      console.log(
        JSON.stringify({
          revoked: true,
          retainedBinding: true,
          changedAccounts: 0,
          changedMemberships: 0,
          changedGrants: 0,
        }),
      );
      // Never clear revoked_at or recycle the association as a recovery shortcut.
    } else {
      const result = db
        .prepare(bindingInsertSql)
        .run(
          input.issuer,
          input.subject,
          input.idpId,
          input.upstreamIssuer,
          input.upstreamSubject,
          input.reviewedBy,
          input.userId,
          input.expectedEmail,
        );
      if (Number(result.changes) !== 1)
        throw new Error(
          "Binding refused: current enabled user did not match the reviewed identity",
        );
      console.log(
        JSON.stringify({
          bound: true,
          changedAccounts: 0,
          changedMemberships: 0,
          changedGrants: 0,
        }),
      );
    }
  }
} finally {
  db.close();
}
