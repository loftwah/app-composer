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
  },
});

if (!values.database)
  throw new Error("Select an explicit local SQLite database with --database");
if (!lstatSync(values.database).isFile())
  throw new Error("Select an existing unlinked SQLite file");
const db = new DatabaseSync(values.database, { readOnly: !values.bind });
try {
  if (!values.bind) {
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
} finally {
  db.close();
}
