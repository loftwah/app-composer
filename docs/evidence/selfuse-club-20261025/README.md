# Self-use club evidence

Fictional **Riverton Rowing Club**, 25 October 2026 (Australia/Melbourne) /
24 October 2026 UTC. Local Cloudflare Worker and local D1 under Wrangler; no
deployment, provider account, DNS, Access, secret store, paid service or GitHub
Action was used.

- Composer source: `86514680720702ce30157671652981e388b77f65`, verified against
  production `/build.json`.
- App source: this worktree, `labs/self-use-club/app`.
- Captures: Chromium through Playwright, `wrangler dev` with local D1.
- Screenshots are full-page PNGs compressed with `pngquant` 80–96 (no resize).
  Per-file viewport, theme, page, bytes and SHA-256 are in `captures.json`.

## Recorded journeys

### 1. Visitor → owner → public change

`acceptance.json`, 2026/10/25 10:35–10:36 Australia/Melbourne
(2026/10/24 23:35–23:36 UTC):

- visitor read **Spring row and breakfast** at `2026/11/14`, 7:00 am for 7:30 am,
  Riverton Boathouse;
- a deliberately bad enquiry was refused with HTTP 422; the name/message errors
  were shown and the submitted email/message were preserved;
- a real-fictional enquiry from **Fictional Priya Raman** (`priya.raman@example.test`)
  was saved as pending with reference **RRC-49B15E50**;
- anonymous `GET /admin` redirected to sign-in; an anonymous `POST /admin/events`
  returned **401** and wrote no row;
- the owner signed in through the form and saw the pending enquiry;
- the owner edited the seeded draft **Twilight paddle and supper**, changed its
  summary/date/description and published it;
- a fresh visitor context fetched `/events/twilight-paddle-and-supper` with HTTP
  200 and saw `2027/01/23` and the changed copy; the public page did not contain
  the enquiry email or message;
- the owner marked the enquiry **Reviewed** with a private note; the pending count
  became 0 and the reviewed disclosure opened.

Screenshots: `public/join-error-1440-light.png`,
`public/join-thanks-1440-light.png`, `admin/denied-1440-light.png`,
`admin/dashboard-before-1440-light.png`, `admin/dashboard-after-1440-light.png`,
`public/event-twilight-*`, plus the full viewport set listed below.

### 2. Volunteer capacity request

`second-feature.json`, 2026/10/25 10:36 Australia/Melbourne (23:36 UTC), using
`spec/requests/volunteers.md` exported from the real `/prompts#change` form:

- owner created and published **Working bee — pontoon handrail**, capacity 2;
- public page showed **2 of 2 places left**;
- **Fictional Noor Haddad** signed up; public role showed **1 of 2**;
- **Fictional Ben Okafor** signed up; public role became **Crew full** with no form;
- a third direct POST returned **409** and no third row was written;
- the owner saw both confirmed sign-ups with private contact details;
- the owner raised capacity to 4 and renamed the role; both existing sign-ups
  remained, public showed **2 of 4 places are still open**, and the new title.

Screenshots: `public/volunteer-thanks-1440-light.png`,
`public/volunteer-full-1440-light.png`, `public/volunteer-list-*`,
`public/volunteer-role-*`, `admin/volunteers-created-1440-light.png`,
`admin/volunteers-signups-*`.

## Migration comparison

`volunteers-before.json` was taken with seeded events/notices and no enquiries;
`0002_volunteers.sql` was applied while the server was not serving the new code;
`volunteers-after-migration.json` was byte-identical for events, notices and
enquiries. `second-feature-preservation.json` compares the data after both
acceptance journeys: all notice and enquiry rows unchanged, all event IDs present,
the two untouched events byte-identical, and the intentional edit recorded. The
publishing edit and reviewed enquiry survived the second feature.

## Captures

55 files under `public/`, `admin/` and `composer/`.

- Main public pages and owner pages at **390 and 1440**, **light and dark**.
- State captures: validation refusal, enquiry thanks, anonymous denial, pending
  and reviewed queues, saved event, created role, volunteer thanks/full states.
- Composer form captures from production: `/setup`, `/prompts#build`,
  `/prompts#change`, `/init/content` for events/notices/enquiries.

`captures.json` is the manifest. No horizontal overflow was reported by either
acceptance script (`scrollWidth === clientWidth` at every captured page); empty
console error arrays are in the two JSON records. The 401/409/422 resource errors
listed under `expectedRefusalResponses` are the deliberate denial tests.

## Reproduce

```sh
cd labs/self-use-club/app
pnpm install --prefer-offline
rm -rf .wrangler
pnpm exec wrangler d1 execute riverton-rowing-club --local --file=migrations/0001_init.sql
pnpm db:seed
# optional: export rows, apply 0002, compare
pnpm exec wrangler d1 execute riverton-rowing-club --local --file=migrations/0002_volunteers.sql
pnpm dev
```

In another terminal:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node labs/self-use-club/scripts/acceptance.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node labs/self-use-club/scripts/acceptance-volunteers.mjs
```

The scripts assume the fresh seed and that they run in order. They were the exact
scripts used for these records (the only later edit was moving the local token
from the generic `ADMIN_TOKEN` variable to `RIVERTON_ADMIN_TOKEN`, after this host's
unrelated `ADMIN_TOKEN` caused a failed login). The failed attempt wrote no
successful review, the database was reset, and the recorded runs started clean.

## Checks run at this revision

- app `pnpm check`: TypeScript clean, **18 tests pass**.
- app `pnpm build`: Wrangler dry-run build passed, 103.74 KiB upload / 22.14 KiB
  gzip; it exits before upload and creates no resource. The app is run with the
  pinned Wrangler 4.152.0.
- Composer `tests/content-model-downloads.test.mjs`: **3 tests pass**.
- Composer focused suites (`content-model-downloads`, `project-setup`):
  **14 tests pass** (3 + 11).
- Root `pnpm build`: passed, including the publication guard (1243 files, 150
  archive members).
- Root `pnpm check`: **1018/1020 tests passed**. The two failures are the existing
  Guestbook sibling-checkout identity tests, which expected pinned
  `5075d7be53b43aca288d3707fd06851aca91e8c2` and found the local checkout at
  `376129c8b48d29d26e982777084aa241966569c7`. They are unrelated to this lane and
  no Guestbook source was changed.

## What this proves

- One real Composer form journey produced a portable guide, prompts, three
  validated models/seeds/handoffs and a change request.
- An agent implemented a working local app from those artefacts with a public
  site, private server-enforced owner area, real D1 records, enquiry review and
  capacity-limited volunteer sign-ups.
- Real browser journeys at phone and desktop in both themes, with negative cases.
- The additive migration and the second feature preserved existing content.

## What it does not prove

- General autonomous app creation from arbitrary briefs.
- A deployed app, production D1, custom domain, email, auth provider, payment or
  backup/restore.
- Multi-user accounts, invitation/removal, rate limiting, load/concurrency or
  accessibility acceptance with assistive technology/physical phones.
- That the agent did not make routine implementation decisions; it did, and they
  are listed in [`docs/self-use-club.md`](../../../docs/self-use-club.md).
- That the fixed Composer download-name change is live; it is a worktree change.

## Temporary storage

The run used `/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/opencode/lane-d-20261025`
for reference clones, model drafts, Playwright exports and logs. It is removed at
the end of the lane. The app's own `.wrangler/` local D1 state and `node_modules/`
are ignored and not evidence; no owner checkout or record was read or modified.
