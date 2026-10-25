// Real installed EmDash middleware and Access adapter, synthetic RSA/JWKS/IdP,
// in-memory SQLite. Only Astro's build-time virtual imports/DEV flag are shimmed.
import assert from "node:assert/strict";
import { registerHooks, createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPair, exportJWK, SignJWT, decodeJwt } from "jose";
import { protectAdministration } from "../../src/lib/access-boundary.mjs";
import {
  bindingInsertSql,
  validateSubjectBindingInput,
} from "../../src/lib/access-subject-bindings.mjs";

const team = "synthetic-subject-binding.cloudflareaccess.com";
const issuer = "https://" + team;
const upstreamIssuer = "https://idp.fictional.invalid/tenant-a";
const auth = {
  type: "cloudflare-access",
  entrypoint: "@emdash-cms/cloudflare/auth",
  config: {
    teamDomain: team,
    audience: "fixture-app",
    autoProvision: true,
    defaultRole: 10,
    syncRoles: false,
    syncName: false,
  },
};
const virtualConfig =
  "data:text/javascript," +
  encodeURIComponent("export default " + JSON.stringify({ auth }));
const actualAccess = import.meta.resolve("@emdash-cms/cloudflare/auth");
const authMiddleware = import.meta.resolve("emdash/internal/middleware/auth");
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "astro:middleware")
      return {
        url: "data:text/javascript,export const defineMiddleware = x => x",
        shortCircuit: true,
      };
    if (specifier === "virtual:emdash/config")
      return { url: virtualConfig, shortCircuit: true };
    if (specifier === "virtual:emdash/auth")
      return { url: actualAccess, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === authMiddleware)
      return {
        format: "module",
        shortCircuit: true,
        source: readFileSync(new URL(url), "utf8").replaceAll(
          "import.meta.env.DEV",
          "false",
        ),
      };
    return next(url, context);
  },
});

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT,
    avatar_url TEXT, role INTEGER NOT NULL, email_verified INTEGER DEFAULT 1,
    disabled INTEGER DEFAULT 0, data TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  INSERT INTO users (id,email,name,role) VALUES ('fictional-owner','owner@fictional.invalid','Owner',50);
`);
for (const file of [
  "0003_stacks.sql",
  "0008_workspace_access.sql",
  "0010_member_app_grants.sql",
  "0019_access_subject_bindings.sql",
]) {
  sqlite.exec(
    readFileSync(new URL("../../migrations/" + file, import.meta.url), "utf8"),
  );
}
sqlite.exec(`INSERT INTO creator_workspaces (id,name) VALUES ('team-alpha','Fictional Alpha');
  INSERT INTO creator_members (workspace_id,user_id,role) VALUES ('team-alpha','fictional-owner','owner');
  INSERT INTO creator_app_grants (id,issuer,workspace_id,user_id,app,resource_id,action,created_by)
  VALUES ('grant-alpha','https://composer.loftwah.com','team-alpha','fictional-owner','showcase','alpha','maintain','fictional-owner');`);

const requireEmdash = createRequire(import.meta.resolve("emdash"));
const { Kysely, SqliteDialect } = await import(requireEmdash.resolve("kysely"));
const db = new Kysely({
  dialect: new SqliteDialect({
    database: {
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        return {
          reader: statement.columns().length > 0,
          all: (args) => statement.all(...args),
          run: (args) => statement.run(...args),
        };
      },
      close() {},
    },
  }),
});
const d1 = {
  prepare(sql) {
    return {
      bind(...args) {
        return { first: async () => sqlite.prepare(sql).get(...args) ?? null };
      },
    };
  },
};
const runtime = {
  DB: d1,
  CF_ACCESS_TEAM_DOMAIN: team,
  CF_ACCESS_AUDIENCE: "fixture-app",
  CF_ACCESS_SUBJECT_BINDING: "enforce",
};
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "synthetic-subject-fixture";
let identityOverride,
  identityFailure = false;
const oldFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) === issuer + "/cdn-cgi/access/certs")
    return Response.json({ keys: [jwk] });
  assert.equal(String(url), issuer + "/cdn-cgi/access/get-identity");
  if (identityFailure) return new Response(null, { status: 503 });
  const payload = decodeJwt(
    options.headers.Cookie.slice("CF_Authorization=".length),
  );
  return Response.json(
    identityOverride ?? {
      user_uuid: payload.sub,
      email: payload.email,
      name: "Owner",
      groups: [],
      idp: { id: "fictional-idp-a", type: "oidc" },
      oidc_fields: {
        iss: upstreamIssuer,
        sub: payload.upstreamSubject ?? "principal-a",
      },
    },
  );
};
const signed = ({
  subject = "access-user-a",
  email = "owner@fictional.invalid",
  iss = issuer,
  audience = "fixture-app",
  upstreamSubject = "principal-a",
  expiration = "5m",
} = {}) =>
  new SignJWT({ email, upstreamSubject })
    .setSubject(subject)
    .setIssuer(iss)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .sign(privateKey);
const request = (token) =>
  new Request("https://composer.fictional.invalid/_emdash/api/users", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
const nextUser = async (token) => {
  const req = request(token);
  const context = {
    url: new URL(req.url),
    request: req,
    locals: { emdash: { db, config: { auth } } },
    session: { set() {} },
  };
  const response = await onRequest(context, async () =>
    Response.json({ user: context.locals.user }),
  );
  return { response, user: context.locals.user };
};
const rows = (table) =>
  sqlite.prepare("SELECT * FROM " + table + " ORDER BY 1").all();
const preservedBefore = {
  users: rows("users"),
  memberships: rows("creator_members"),
  grants: rows("creator_app_grants"),
};
const { onRequest } = await import("emdash/internal/middleware/auth");
try {
  // Reproduction: two independently signed Access subjects resolve to the same
  // privileged local ID and therefore its existing memberships and grants.
  const original = await nextUser(await signed());
  const recycled = await nextUser(
    await signed({ subject: "access-user-b", upstreamSubject: "principal-b" }),
  );
  assert.equal(original.response.status, 200);
  assert.equal(recycled.response.status, 200);
  assert.equal(recycled.user.id, "fictional-owner");
  assert.equal(recycled.user.role, 50);
  assert.equal(
    rows("creator_members").filter((row) => row.user_id === recycled.user.id)
      .length,
    1,
  );
  assert.equal(
    rows("creator_app_grants").filter((row) => row.user_id === recycled.user.id)
      .length,
    1,
  );
  assert.deepEqual(
    {
      users: rows("users"),
      memberships: rows("creator_members"),
      grants: rows("creator_app_grants"),
    },
    preservedBefore,
  );

  const accepted = validateSubjectBindingInput({
    issuer,
    subject: "access-user-a",
    idpId: "fictional-idp-a",
    upstreamIssuer,
    upstreamSubject: "principal-a",
    userId: "fictional-owner",
    expectedEmail: "owner@fictional.invalid",
    reviewedBy: "synthetic-reviewer",
  });
  const bind = (input) =>
    sqlite
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
  assert.equal(
    Number(
      bind({ ...accepted, expectedEmail: "wrong@fictional.invalid" }).changes,
    ),
    0,
  );
  assert.equal(Number(bind(accepted).changes), 1);
  assert.throws(
    () => bind({ ...accepted, subject: "access-user-b" }),
    /UNIQUE/,
  );
  assert.equal(
    await protectAdministration(request(await signed()), runtime),
    null,
  );
  const denied = async (options) =>
    assert.equal(
      (await protectAdministration(request(await signed(options)), runtime))
        .status,
      403,
    );
  await denied({ subject: "access-user-b", upstreamSubject: "principal-b" });
  // Access's subject is email-associated, so simulate a recycled upstream
  // account retaining the SAME Access subject and address too.
  await denied({ upstreamSubject: "principal-b" });
  await denied({ email: "changed@fictional.invalid" });
  await denied({ iss: "https://other.cloudflareaccess.com" });
  await denied({ audience: "other-app" });
  await denied({ subject: "" });
  await denied({ expiration: 1 });
  assert.equal(
    (await protectAdministration(request("forged.jwt.token"), runtime)).status,
    403,
  );

  const baseIdentity = {
    user_uuid: "access-user-a",
    email: accepted.expectedEmail,
    groups: [],
    idp: { id: accepted.idpId, type: "oidc" },
    oidc_fields: { iss: upstreamIssuer, sub: "principal-a" },
  };
  for (const identity of [
    { ...baseIdentity, user_uuid: undefined, id: "access-user-a" }, // installed stale type
    { ...baseIdentity, user_uuid: "access-user-b" },
    { ...baseIdentity, email: "other@fictional.invalid" },
    { ...baseIdentity, idp: { id: "other-idp" } },
    { ...baseIdentity, oidc_fields: undefined },
    { ...baseIdentity, oidc_fields: { sub: "principal-a" } },
    {
      ...baseIdentity,
      oidc_fields: {
        iss: "https://idp.fictional.invalid/other-tenant",
        sub: "principal-a",
      },
    },
    {
      ...baseIdentity,
      oidc_fields: { iss: upstreamIssuer, sub: "principal-b" },
    },
    {
      ...baseIdentity,
      oidc_fields: { iss: upstreamIssuer, sub: ["principal-a"] },
    },
  ]) {
    identityOverride = identity;
    await denied({});
  }
  identityOverride = undefined;
  sqlite.exec(
    "UPDATE composer_access_subject_bindings SET upstream_subject=''",
  );
  identityOverride = {
    ...baseIdentity,
    oidc_fields: { iss: upstreamIssuer, sub: "" },
  };
  await denied({});
  sqlite.exec(
    "UPDATE composer_access_subject_bindings SET upstream_subject='principal-a'",
  );
  identityOverride = undefined;
  identityFailure = true;
  await denied({});
  identityFailure = false;
  assert.equal(
    (
      await protectAdministration(request(await signed()), {
        ...runtime,
        DB: undefined,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await protectAdministration(request(await signed()), {
        ...runtime,
        DB: {
          prepare() {
            throw new Error("offline");
          },
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await protectAdministration(request(await signed()), {
        ...runtime,
        CF_ACCESS_SUBJECT_BINDING: "enfore",
      })
    ).status,
    403,
  );

  sqlite.prepare("UPDATE users SET role=10 WHERE id=?").run("fictional-owner");
  assert.equal(
    await protectAdministration(request(await signed()), runtime),
    null,
  );
  assert.equal(
    (await nextUser(await signed())).user.role,
    10,
    "current local role retained",
  );
  sqlite
    .prepare("UPDATE users SET disabled=1 WHERE id=?")
    .run("fictional-owner");
  await denied({});
  assert.equal(
    (await nextUser(await signed())).response.status,
    403,
    "installed disabled user refusal",
  );
  sqlite
    .prepare("UPDATE users SET disabled=0,role=50 WHERE id=?")
    .run("fictional-owner");
  sqlite.exec(
    "UPDATE composer_access_subject_bindings SET revoked_at=CURRENT_TIMESTAMP",
  );
  await denied({});
  sqlite.exec("UPDATE composer_access_subject_bindings SET revoked_at=NULL");
  sqlite
    .prepare("UPDATE users SET email=? WHERE id=?")
    .run("changed@fictional.invalid", "fictional-owner");
  await denied({});
  assert.equal(
    await protectAdministration(
      request(await signed({ email: "changed@fictional.invalid" })),
      runtime,
    ),
    null,
  );
  assert.equal(
    (await nextUser(await signed({ email: "changed@fictional.invalid" }))).user
      .id,
    "fictional-owner",
  );
  sqlite
    .prepare("UPDATE users SET email=? WHERE id=?")
    .run(accepted.expectedEmail, "fictional-owner");
  // Explicit compatibility does not pretend to fix the installed vulnerability.
  assert.equal(
    await protectAdministration(
      request(await signed({ subject: "access-user-b" })),
      { ...runtime, CF_ACCESS_SUBJECT_BINDING: "compatibility" },
    ),
    null,
  );
  assert.deepEqual(
    {
      users: rows("users"),
      memberships: rows("creator_members"),
      grants: rows("creator_app_grants"),
    },
    preservedBefore,
  );
  console.log(
    JSON.stringify({
      installed: "EmDash/Cloudflare 1.3.1",
      reproduced:
        "distinct signed subjects inherit role 50 and grants by email",
      enforce: "Access and upstream issuer/subject binding",
      retainedAccounts: true,
      retainedMemberships: true,
      retainedGrants: true,
      realProviderClaims: "unverified",
      productionEnforcement: "not enabled",
    }),
  );
} finally {
  globalThis.fetch = oldFetch;
  hooks.deregister();
  await db.destroy();
  sqlite.close();
}
