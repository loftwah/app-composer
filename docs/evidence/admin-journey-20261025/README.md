# Native admin journey evidence — 2026/10/25

Locally simulated acceptance for **Needs attention** (`/_emdash/admin/plugins/composer-stacks/overview`).
It runs the real committed Astro source in Chromium, against a fictional local
D1 fixture and one clearly labelled set of fixture seams.

## Prove / simulate / unverified

**Proven here (real browser, real source, fictional data)**

- The Overview page renders from the real `overview-page.tsx` inside the real
  EmDash admin shell, from a real `astro dev` server on the committed source.
- Scope is explicit and server-confirmed: workspace, environment and app are
  written to the URL, the account is shown read-only, and the confirmed values
  survive a reload and the browser Back button.
- One lead problem is chosen deterministically; the rest are a quieter list.
  The resource-drift class (`The connected app source changed`) is present in
  the queue with an anchor into App resources.
- One supported action (`Recheck Workflows`) performs a real read, reports the
  grouped record count and updates the observation time.
- A deliberate failure (a retained platform request with malformed JSON) makes
  the platform source unavailable. Rechecking it shows an explicit failure and
  **keeps the previous result**; repairing the record and retrying recovers and
  surfaces the retained request.
- Horizontal overflow is 0 at 390 and 1440 in dark and light; every visible
  control inside the page is at least 44px tall; keyboard focus draws a 2px
  outline; Tab reaches the scope controls and the primary action; Enter follows
  the primary action; Escape closes the coverage disclosure and returns focus
  to its summary.

**Simulated (never production proof)**

- **Authentication**: the fixture copy removes the Cloudflare Access wrapper and
  uses EmDash's own passkey flow with a virtual authenticator. No Access
  session was created, copied or forged, and no production identity was used.
- **Data**: every workspace, stack, resource, workflow run and notification is
  invented for this run in a local SQLite D1 database. No owner draft, enquiry
  or resource record was read.
- **Server**: `astro dev` on a copied checkout, with routes, cron triggers and
  provider service bindings removed. No request can leave the machine.

**Not verified at all**

- Any production owner session, Cloudflare Access policy, production D1 or
  provider state.
- Physical touch, tablet, stylus or screen-reader use.
- A native `<select>` committed by arrow keys on macOS headless Chromium: the
  select is keyboard-reachable and its recorded options were asserted, but the
  value change itself was driven through the select API. A human keyboard check
  on a real browser remains open.
- Record rendering inside the owning screens: the drill-down URL, scope and
  record anchor are correct, but the local fixture's Workflows/Platform screens
  did not render their retained rows within the probe window. That is recorded
  in `receipt.json` (`anchoredRecordProven`, `keyboardAnchor`), not claimed.

## Fixture

Prepared by `prepare-fixture.mjs` into one owned temporary root:

| Item | Value |
| --- | --- |
| Workspace | created by EmDash setup for `fixture@example.test` |
| Account | `fictional-lane-a-account` (server var, never client-selectable) |
| Environments | `production`, `preview` (recorded resources) |
| App | `guestbook` |
| Workflow failures | 2 non-synthetic `needs-attention` runs for one source, 1 synthetic run that must stay excluded |
| Notifications | 2 held records (`failed`, `uncertain`) for the visitor book |
| Resource records | production resource with genuine confirmed-source drift; preview resource in step |
| Deliberate failure | one platform request with `plan_json = 'broken JSON'`, repaired later in the run |

## Fixture seams (copy only)

Recorded in `fixture.json` under `seams`; nothing is written back to the source
checkout. Each is a single reviewed replacement:

1. `astro.config.mjs` — `auth: access({...})` removed so EmDash uses its native
   passkey auth; `siteUrl` set to the local origin so the WebAuthn relying party
   matches.
2. `src/lib/overview.ts` — the production-origin guard constant points at the
   local origin. The guard itself is unchanged in source.
3. `wrangler.jsonc` — local name, `lab-entry.ts`, no routes, cron, `env` blocks
   or service bindings; `RESOURCE_ACCOUNT_ID` is fictional.
4. `lab-entry.ts` — a new file that exports the EmDash handler without the
   production Access wrapper.

## Run it

Requires Node 22.23.4 or newer (Astro 7.4.2 refuses 22.23.1) and Playwright's
Chromium. Stop any dev server on the chosen port first; the script refuses an
occupied port.

```sh
export PATH=/path/to/node-22.23.4/bin:$PATH
ROOT=/private/var/folders/.../opencode/lane-a-<date>

node docs/evidence/admin-journey-20261025/prepare-fixture.mjs \
  --source "$PWD" --root "$ROOT" --origin http://localhost:4337

node docs/evidence/admin-journey-20261025/capture.mjs --root "$ROOT"

# when finished: stop the server and delete only this owned root
node docs/evidence/admin-journey-20261025/prepare-fixture.mjs --root "$ROOT" --clean
```

`prepare-fixture.mjs` copies the checkout (APFS clone where available), applies
the seams, starts `astro dev`, applies Composer's local migrations and writes
`fixture.json`. `capture.mjs` performs EmDash setup with a virtual passkey,
inserts the fictional rows, drives the journey, asserts measurements and writes
`receipt.json` plus the captures in this directory.

## Captures

Nine PNGs, each also hashed in `receipt.json`:

- `overview-1440-dark.png`, `overview-1440-light.png`
- `overview-390-dark.png`, `overview-390-light.png`
- `drilldown-workflows-1440-dark.png`
- `recheck-success-1440-dark.png`
- `recheck-failure-1440-dark.png`
- `keyboard-focus-1440-dark.png`
- `coverage-390-dark.png`

Measurements (from `receipt.json`): document and body horizontal overflow `0`
at both widths in both themes; smallest control height `44`; zero undersized
controls; zero page errors.

## What this does not replace

The coordinator's authenticated production observations, the canonical release
receipt in issue #11, and physical/assistive acceptance. See
`docs/ldraw-catalogue-publication.md` for the LDraw catalogue record; the
publication itself was performed by the coordinator.
