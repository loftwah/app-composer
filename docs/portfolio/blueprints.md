# Runnable pinned blueprints

Updated 16 November 2026. These recipes accompany the catalogue at
[/blueprints](https://composer.loftwah.com/blueprints). A blueprint is a brief:
it never deploys, it carries no credential, and its pin is not a claim about what
the reference production app currently runs.

Both shipped blueprints are **Reference**. The pins, upstream source, live
reference apps and prerequisites were checked on 16 November 2026. **No
independent owner has replayed either build**, and this repository did not run
the commands below end to end. The commands come from the pinned source's own
documentation; the unverified parts are named in each section.

Neither recipe shares data, databases, buckets, keys or credentials with another
project. Each app keeps its own repository, D1 database, R2 bucket and owner
credential. Nothing here imports Linkarooie, Guestbook, Studio or Composer
private data.

## Creator Hub

A moderated photo guestbook plus a Linkarooie profile that features approved
moments. Two independently deployed Workers, two D1 databases and one private R2
bucket.

| App | Source | Pin | Licence |
| --- | --- | --- | --- |
| Here / there (guestbook) | [loftwah/app-composer-guestbook](https://github.com/loftwah/app-composer-guestbook) | `5075d7be53b43aca288d3707fd06851aca91e8c2` | MIT |
| Linkarooie (showcase) | [loftwah/app-composer-showcase](https://github.com/loftwah/app-composer-showcase) | `f1dd27952ca8548f81fde5c5905346dae4a2b61b` | MIT |

The pins are the values in `composition.lock.json`. The live reference installs
are **newer** than these pins: Guestbook reports
`a8191d3442ea95a4013d481a2a50148e1f94bde3` and Linkarooie reports
`e6780997b96f8b9f2411abc66abbbdd590dd5940`. That is evidence that the pattern
runs in production; it is not a replay of the pinned build.

### Prerequisites

- Node 22 (`>=22 <23` at both pins) and the pinned `pnpm@12.8.1` through Corepack.
- A Cloudflare account you control, `wrangler` authenticated to it, and a Worker
  name and HTTPS origin you control (a custom domain or `workers.dev`).
- A D1 database for each app and one private R2 bucket for Guestbook media.
- Your own `OWNER_API_TOKEN`. The apps have no public signup.
- No Composer workspace grant is required for the standalone pair.

### Recipe

1. Create your own copy of each repository and check out the pin. A fork keeps
   the history; a fresh repository from the source archive also works.

   ```sh
   git clone https://github.com/<your-account>/app-composer-guestbook
   git clone https://github.com/<your-account>/app-composer-showcase
   git -C app-composer-guestbook checkout 5075d7be53b43aca288d3707fd06851aca91e8c2
   git -C app-composer-showcase checkout f1dd27952ca8548f81fde5c5905346dae4a2b61b
   ```

2. Replace the first-party deployment identity in each `wrangler.jsonc`. The
   published files name the original account, hostnames, D1 ids and service
   binding; reusing them is not an independent install.

   - `account_id`: your Cloudflare account id.
   - `name`: your Worker name.
   - `routes`: your hostname, or remove the route and use `workers_dev`.
   - Guestbook `d1_databases[0]`: your database name and id; `r2_buckets[0]`:
     your private bucket name; `vars.PUBLIC_ORIGIN`: your Guestbook origin.
   - Guestbook `OWNER_STUDIO_URL`, `RESOURCE_ACCOUNT_ID`,
     `RESOURCE_ENVIRONMENT` and `MEMBER_ISSUER`: remove them unless you are
     deliberately connecting your own Composer member service. The default
     `guestAccess: closed` keeps public posting off.
   - Showcase `d1_databases[0]`: your database name and id;
     `vars.PROFILE_ORIGIN`: your Linkarooie origin; `vars.PROVIDER_ORIGIN`: your
     Guestbook origin; the `ITEM_PROVIDER` service name: your Guestbook Worker;
     `COMPOSER_ISSUER` and `OWNER_STUDIO_URL`: remove them or point them at your
     own Composer.
   - Showcase `PROVIDER_MOUNT` may stay `/guestbook`; it is the path the profile
     uses for the provider, not a first-party account identifier.

3. Create the storage.

   ```sh
   cd app-composer-guestbook
   npx wrangler d1 create <your-guestbook-db>
   npx wrangler r2 bucket create <your-guestbook-photos>
   cd ../app-composer-showcase
   npx wrangler d1 create <your-showcase-db>
   ```

4. Install and run the source's own checks.

   ```sh
   pnpm install --frozen-lockfile
   pnpm check
   ```

5. Set the owner credential. Do not write it into a file, command history or the
   repository.

   ```sh
   printf '%s' "$OWNER_API_TOKEN" | npx wrangler secret put OWNER_API_TOKEN
   ```

   Guestbook also uses a browser-visible public puzzle code for guest postcards.
   It is intentionally public and is not owner authority. Keep guest postcards
   closed until you have reviewed the moderation queue.

6. Deploy. The first-party guarded script is **not portable as shipped**: it
   requires a clean pushed `main`, applies migrations, deploys with the commit
   and manifest baked in, then polls `https://guestbook.loftwah.com/build.json`
   (or `https://showcase.loftwah.com/build.json`) and verifies sharing on that
   first-party host. That check cannot pass for your origin.

   Inspect the two first-party URLs in your own fork and replace them with your
   origins:

   ```sh
   grep -n "loftwah.com" scripts/deploy.mjs
   ```

   Then use the guarded path from a clean, pushed `main`:

   ```sh
   pnpm deploy
   ```

   If you prefer not to change the release script, deploy with Wrangler and pass
   the same defines yourself. The build identity endpoint requires them:

   ```sh
   pnpm build
   pnpm exec wrangler deploy --config wrangler.jsonc --env= \
     --define BUILD_SHA:"\"$(git rev-parse HEAD)\"" \
     --define MANIFEST:"$(cat app.manifest.json)"
   ```

   Apply the forward migrations before the first direct upload:

   ```sh
   pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.jsonc --env=
   ```

7. Verify your own build, not the reference one.

   ```sh
   curl -sS https://<your-guestbook-origin>/build.json
   curl -sS https://<your-showcase-origin>/build.json
   ```

   Both should report the commit you deployed. Guestbook's `/healthz` also
   returns `revision` and `status: "up"`. Then open the Guestbook owner page,
   approve or reject one test postcard, and confirm the approved item appears in
   Linkarooie only after you explicitly feature it.

### Limits and replay status

**Replay status: not replayed.** No independent owner has run this recipe, and
this repository did not deploy it. The pin and source checks pass; a real rebuild,
change and reopen is still the missing proof.

- The two apps are separate deployments. Guestbook owns media and moderation;
  Linkarooie owns the curated cards and profile.
- The first-party `pnpm deploy` verification is hardcoded to `loftwah.com`; an
  independent owner must change it in their own fork or use the direct Wrangler
  path. This is a real portability gap, not a hidden credential.
- The reference screenshots in each README show the production UI, not a replay
  of this pin.
- A blueprint is a brief. `/init?start=composition` prepares settings; it does
  not create Cloudflare resources or deploy.

## Media Studio

An independent image, video and sound studio with its own Worker, D1 database,
R2 bucket, Durable Object, Workers AI and Images bindings. It is single-owner by
design and has no public signup.

| App | Source | Pin | Licence |
| --- | --- | --- | --- |
| Media Studio | [loftwah/composer-media-studio](https://github.com/loftwah/composer-media-studio) | `e8b3778cd5d800378f42985afda80820fcb7ef57` | MIT stated in the README; no licence file detected at the pin |

The pin is the value in `config/media-studio-standalone.json`. The live reference
studio is **newer**: it reports
`f2f29696d8be2424cee5f64b89bdcb0bb43de037`, built
2026-11-15T23:18:21.480Z. The blueprint and Init brief stay on the declared pin;
neither value is rewritten here.

### Prerequisites

- Node `>=22.23.5 <23 || >=24.22.3 <25 || >=26.13.1 <27` and
  `pnpm@12.19.0`.
- A Cloudflare account with Workers Paid, a D1 database, a private R2 bucket,
  Workers AI, Cloudflare Images entitlement and billing for the `IMAGES` binding,
  and a Durable Object migration.
- `OWNER_PASSPHRASE` and `SESSION_SECRET`. `FAL_KEY` is optional and only needed
  for fal-backed video, voice, music and provider rendering.
- A monthly allowance cap you choose. The example installation sets
  `MONTHLY_ALLOWANCE_MICRO` to `5000000`; replace it with your own limit.
- A repository you own: the release script refuses a mismatch between
  `app.manifest.json` `repository` and this copy's `origin`.

### Recipe

1. Create your own copy at the pin.

   ```sh
   git clone https://github.com/<your-account>/composer-media-studio
   cd composer-media-studio
   git checkout e8b3778cd5d800378f42985afda80820fcb7ef57
   ```

2. Replace the first-party values in `wrangler.jsonc` and `app.manifest.json`:

   - `account_id`, Worker `name`, and the `media.loftwah.com` route.
   - D1 `database_id`: your database. Keep the `database_name` `media-studio`
     unless you also change it in `scripts/deploy.mjs`, because the guarded
     `--migrate` path names that database. R2 `MEDIA` and `APP_ARTIFACTS` bucket
     names. Both bindings must point at the **same private bucket**.
   - `vars.PUBLIC_ORIGIN`: your HTTPS origin.
   - `vars.RENDER_ORIGIN`: your Worker's `workers.dev` hostname, not the custom
     domain, so the render provider's signed reads are not blocked by edge bot or
     Access rules.
   - `vars.COMPOSER_ORIGIN`, `PUBLIC_BUILD_URL`, `PUBLIC_STORY_URL`,
     `LAUNCH_KIT_URL`, `WOODHOUSE_SHARE` and `PUBLIC_SHOWCASE_SLUGS`: remove
     them or replace them with your own destinations. Do not copy the example
     installation's showcase list.
   - `vars.MONTHLY_ALLOWANCE_MICRO`: your cap, not the example's.
   - `app.manifest.json` `repository`: your repository URL. The guarded release
     checks this against `origin`.

3. Create the storage and apply the complete migration set.

   ```sh
   npx wrangler d1 create media-studio
   npx wrangler r2 bucket create <your-media-bucket>
   # put the returned database_id in wrangler.jsonc
   npx wrangler d1 migrations apply media-studio --remote
   ```

   Apply migrations `0001`–`0017` in order. The guarded command below applies
   them for you; do not reset or skip a migration.

4. Set the runtime secrets directly, never through a tracked file.

   ```sh
   printf '%s' "$OWNER_PASSPHRASE" | npx wrangler secret put OWNER_PASSPHRASE
   printf '%s' "$SESSION_SECRET" | npx wrangler secret put SESSION_SECRET
   printf '%s' "$FAL_KEY" | npx wrangler secret put FAL_KEY   # optional
   ```

5. Check and deploy from a clean, pushed `main`.

   ```sh
   pnpm install --frozen-lockfile
   pnpm check
   pnpm run deploy --migrate
   ```

   The Studio's release script is portable: it reads `PUBLIC_ORIGIN` from the
   environment or `wrangler.jsonc`, deploys with the commit and build time baked
   in, then verifies your own `/healthz` and `/build.json`. It refuses a dirty
   tree, an unpushed `main`, or a manifest repository that does not match
   `origin`.

6. Verify the exact build.

   ```sh
   curl -sS https://<your-studio-origin>/build.json
   curl -sS https://<your-studio-origin>/healthz
   ```

   Both should report `revision` equal to your deployed commit. `/healthz` also
   reports `bridge`, `builtAt` and `ok: true`. Then create one project, upload
   one image, publish one page deliberately, and confirm the public page opens
   without an owner session.

### Limits and replay status

**Replay status: not replayed.** No independent owner has run this recipe, and
this repository did not run the storage creation, provider calls or deploy. The
pinned README and deployment notes are the source of the commands.

- The Studio is single-owner. It is not a multi-tenant signup product.
- Provider availability, prices and output quality are your account decision.
  The estimate shown before a request is not an invoice.
- Local MP4 rendering depends on browser codecs and memory; it is not a device
  parity promise.
- `IMAGES` entitlement and billing are a separate Cloudflare decision. Error
  9432 is the known trap when the binding is not entitled.
- The example installation's D1 ids, R2 names, account id, route, showcase list
  and public destinations are first-party configuration. They are documented in
  the pinned source so an owner can recognise them, not reuse them.
