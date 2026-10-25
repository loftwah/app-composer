# Riverton Rowing Club (local self-use fixture)

A fictional community rowing club used to test one complete App Composer self-use
journey. It is a real Cloudflare Worker with its own D1 schema, run locally under
`wrangler dev`; it is not deployed and does not contact a provider.

The public site has upcoming events, notices, a joining enquiry form and volunteer
roles with a server-enforced capacity. The private owner area edits events and
notices, publishes them, reviews enquiries and manages volunteer roles.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Club home, next event, notices and open volunteer roles |
| `/events`, `/events/:slug` | Published events only |
| `/notices` | Published notices only |
| `/join` | Joining enquiry form (server validation, private pending queue) |
| `/volunteer`, `/volunteer/:id` | Published roles, places left and sign-up |
| `/admin/login` | Owner sign-in with the local `ADMIN_TOKEN` |
| `/admin` | Private events, notices, enquiries, volunteer roles and sign-ups |
| `/healthz` | Local health check |

Draft events, draft notices, draft roles, enquiries and sign-ups never appear on
public pages. The owner cookie is `HttpOnly`, `SameSite=Strict`, and `Secure` when
the request is HTTPS. State-changing requests also refuse a different `Origin`.

## Run it locally

Node 22.23.4+ is needed by the repository's Astro toolchain; this app's own
Worker/Wrangler commands also run on the repository's Node 22.23.x install.

```sh
cd labs/self-use-club/app
pnpm install --prefer-offline
pnpm db:migrate       # applies 0001_init.sql and 0002_volunteers.sql
pnpm db:seed          # fictional events and notices
pnpm dev              # http://localhost:8787, local D1 only
```

`pnpm dev` intentionally passes a **local fictional** owner token:
`riverton-local-admin-2026`. It is not a secret and has no value outside this
machine. Open `/admin`, paste it into the owner form. Do not reuse it anywhere.

The local D1 state is under `.wrangler/` (ignored). To start clean:

```sh
rm -rf .wrangler
pnpm db:migrate
pnpm db:seed
```

## Reproduce the additive second feature

The volunteer feature was added after real event, notice and enquiry data existed.
The exact sequence used for the recorded evidence was:

```sh
rm -rf .wrangler
pnpm exec wrangler d1 execute riverton-rowing-club --local --file=migrations/0001_init.sql
pnpm db:seed
# capture existing rows, then:
pnpm exec wrangler d1 execute riverton-rowing-club --local --file=migrations/0002_volunteers.sql
# compare: every event, notice and enquiry row is byte-identical
```

`migrations/0002_volunteers.sql` only creates `volunteer_roles` and
`volunteer_signups`; it contains no `ALTER`, `UPDATE`, `DELETE` or insert into an
existing table. `tests/migration.test.mjs` applies the migration to a populated
SQLite database and compares rows and columns before and after.

## Checks

```sh
pnpm check   # tsc --noEmit + node --experimental-strip-types --test tests/*.test.mjs
```

The suite runs the actual Worker with a small `node:sqlite` D1 adapter. It covers
public/draft separation, escaping and CSP, anonymous refusal, owner CRUD, enquiry
validation and review, capacity enforcement, additive migration preservation and
cross-origin refusal.

## Data ownership

The app owns `migrations/*.sql`, `seed/local.sql`, its D1 database and the live
records. Operational state is in `.wrangler/` locally. A deploy would need its own
migration-first release, a real `database_id` and a real owner credential; none of
that is performed or claimed here.

## Known limits

- Local Worker only; not a deployment, custom domain or production D1/R2 proof.
- One owner token, no invitations, accounts, password reset or audit log.
- No email is sent; “Reviewed” is an owner decision, not a reply or a sale.
- Calendar dates are days in Australia/Melbourne. The content model has no
  time-of-day field, so start times are a short free-text note. Native date
  pickers may render their own locale format; stored values remain `YYYY-MM-DD`.
- Capacity is enforced by one conditional `INSERT … SELECT`; this is atomic in
  the local SQLite/D1 execution, but a production provider would still need load
  and concurrency evidence.
- No uploads, pagination, search, rate limiting, account recovery or backups.
