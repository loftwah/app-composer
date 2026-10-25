# Deployment handoff: blocked on an authorised target

Status as of **25 October 2026**. The app is a finished local candidate, but it is
**not deployed**. No Cloudflare Worker, D1 database, bucket, hostname, Access policy
or secret was created for it.

## Why deployment stopped

A read-only inventory of the existing Cloudflare account (`Loftwah`, account
`1003dc1d93af0ebea56b2f1252f89627`) found no target for this app:

- 117 Workers, 19 D1 databases, 16 R2 buckets and 18 Worker custom domains;
- no name containing `riverton`, `rowing`, `self-use`, `selfuse` or `lane-c`;
- no Workers for Platforms dispatch namespace (the API returned 403);
- no existing unused preview target that belongs to this app. The
  `app-composer-preview`, `composer-*` and `*-preview` resources are other
  products' release targets and must not be repurposed;
- creating a new Worker and database was outside this run's authority.

The inventory is stored outside the repository in the ignored lane evidence. The
remaining authority is an owner decision: authorise one isolated development
Worker plus one D1 database, and one reachable hostname (a `workers.dev` hostname or
a reviewed custom domain).

## Candidate identity

- Candidate source: `labs/self-use-club/app` at app tree
  `a2e4c2fa7c02bd4d0134f8a92e42036fd137f3c8`, baseline commit
  `fc53f0f079d7a5776899ff4bcdc2e47d4058dc3e`.
- Worker build (`pnpm build`, Wrangler 4.152.0 dry run):
  `dist/worker.js` **106,233 bytes**, **22,609 bytes gzip**, SHA-256
  `2d1587d16c06636494dbdf9b48b9e8ca783322ce491aa9bf0daf410e6ebe7b2f`.
- Migrations: `0001_init.sql` SHA-256
  `38ffc7a7be3b26e91095d8fd5fee1b168cb6949ad6d7ac6c6b66f8bae12c08aa`,
  `0002_volunteers.sql` SHA-256
  `d1f4c588f43e7a756ed14b4cda50e246eaa346a6000df12eac11b04f120da277`.
- Checks at this source: `pnpm check` **18/18 tests**, `pnpm build` clean. The
  built `dist/worker.js` itself passed both browser journeys (10 + 10 steps) on a
  fresh local D1, with no unexpected console errors.

The build is not a deployed release. The app config still contains the local-only
placeholder `database_id` `00000000-0000-4000-8000-000000000000` and
`PUBLIC_ORIGIN` `http://localhost:8787`.

## Operator steps

Run these from `labs/self-use-club/app` only after the owner has named the isolated
target and hostname. Do not use the local fictional owner token.

1. **Create the isolated target** (this is the step that needs authority):

   ```sh
   pnpm exec wrangler d1 create riverton-rowing-club
   ```

   Put the returned `database_id` into `wrangler.jsonc`. Keep the local Worker name
   `riverton-rowing-club`; do not reuse an existing product's Worker.

2. **Set the public origin and a reachable route.** Set `PUBLIC_ORIGIN` to the
   final HTTPS origin. Either set `workers_dev: true` for the isolated
   `riverton-rowing-club.<account-subdomain>.workers.dev` hostname, or add a
   reviewed `routes` entry with `custom_domain: true`. `preview_urls` stays false.
   A deployment with `workers_dev: false` and no route has no usable URL.

3. **Set the owner secret** without putting it in source, a prompt or shell
   history:

   ```sh
   openssl rand -base64 32 | pnpm exec wrangler secret put ADMIN_TOKEN
   ```

4. **Preserve the pre-deploy boundary.** For a new database, record the empty
   state. For an existing target, export it before changing anything:

   ```sh
   pnpm exec wrangler d1 export riverton-rowing-club --remote --output predeploy.sql
   ```

5. **Apply the forward migrations before serving the new code.** The code queries
   the volunteer tables on `/`, so code-before-migration is a known 500:

   ```sh
   pnpm exec wrangler d1 migrations apply riverton-rowing-club --remote
   ```

   Confirm `0001_init.sql` and `0002_volunteers.sql` are both applied. Do not edit
   or re-run a migration that is already recorded.

6. **Deploy the reviewed source:**

   ```sh
   pnpm build
   pnpm exec wrangler deploy
   pnpm exec wrangler deployments list
   ```

   Record the Worker version ID and deployment timestamp. `pnpm build` is a dry
   run; the upload is the separate `wrangler deploy`.

7. **Verify source and resource identity before exercising the app:**

   ```sh
   curl -fsS https://<live-origin>/healthz
   curl -fsSI https://<live-origin>/
   pnpm exec wrangler d1 execute riverton-rowing-club --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
   ```

   `/healthz` must return `{"ok":true,"app":"riverton-rowing-club"}`. Check the
   D1 binding points at the database created in step 1, and that the response has
   the CSP and `X-Frame-Options: DENY` headers.

8. **Exercise the live journey with fictional records only:**

   - visitor reads `/`, an event, `/notices` and `/volunteer`;
   - an invalid enquiry is refused with 422 and preserves the form values;
   - a valid fictional enquiry is saved and its reference is recorded;
   - anonymous `GET /admin` redirects to sign-in; anonymous `POST /admin/events`
     returns 401 and writes no row;
   - the owner signs in with the real secret, reviews the enquiry, edits and
     publishes an event, and a fresh visitor sees the change;
   - the owner creates a capacity-limited volunteer role, two fictional people
     sign up, a third is refused at capacity, and raising capacity keeps both
     sign-ups;
   - compare counts and rows before/after the volunteer step: existing events,
     notices and enquiries must be unchanged.

9. **Record rollback and recovery boundaries.**

   - Code rollback: `wrangler rollback <previous-version-id>` (or deploy the
     previous version). `0002` is additive, so the pre-volunteer code can run
     against a database that already has the extra tables.
   - Data recovery: use the pre-deploy export and D1 Time Travel
     (`wrangler d1 time-travel info` / `restore`) within the provider's retention
     window. Do not treat a schema drop as rollback.
   - Rotating `ADMIN_TOKEN` invalidates existing owner sessions.
   - Email delivery, payments, backups, restore drills and load/concurrency remain
     untested and unsupported.

## What remains unproven

A deployed Worker, remote D1, real hostname/TLS, a real owner secret, live
enquiry review, live additive migration, code rollback, D1 Time Travel restore,
email/payment, rate limiting, concurrency and physical-device/assistive-technology
acceptance are all still unproven. The local evidence is honest about that
boundary: [`docs/evidence/selfuse-club-20261025/`](../../docs/evidence/selfuse-club-20261025/README.md).
