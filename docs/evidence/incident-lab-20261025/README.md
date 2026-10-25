# Controlled local fault and manual recovery — 25 October 2026

This receipt exercises a real HTTP failure inside an owned local workerd and
local D1 fixture. The deliberately defective canary is copied from
`canary-route.txt` into the temporary app only. It is never a production route,
a provider outage, or a change to Guestbook. Existing proposal schemas use the
`guestbook` app discriminator; the receipt explicitly identifies the actual
target as the temporary caption canary.

Run from this checkout with the already installed dependencies:

```sh
node docs/evidence/incident-lab-20261025/run.mjs
node --test tests/agent-proposals.test.mjs tests/agent-grants.test.mjs tests/native-fixture-process.test.mjs
```

The observed sequence is recorded in `receipt.json` with exact localhost URLs,
timestamps, response status/body hashes, original and executed source hashes,
persisted proposal versions, decisions and final canary rows:

- Establish HTTP 200 baseline for the fictional Team A page and Team B control.
- Remove only Team A's caption using a local D1 revision guard. The defective
  `.trim()` now causes repeated actual HTTP 500 responses. Shallow health and
  the scoped D1 read still return 200; the latter confirms a null caption. Team
  B's response hash remains identical.
- Retain an `isolated-lab` SITREP with observations, supported/disproved
  hypotheses, impact, uncertainty and next checks. A real native EmDash owner
  sends version 1 back using keyboard controls. Version 2 includes a new
  briefing and retained source evidence. Native stale approval returns 409;
  the owner accepts the current version. Both versions and review reasons stay
  stored. Approval alone leaves the page failing with 500.
- The authorized drill harness explicitly acts as the **manual operator** and
  restores the exact prior caption only while revision=2 and caption is null.
  Three independent HTTP requests return 200 with the original body hash. The
  unrelated control and canary source hash remain unchanged.
- Store and review a separate final SITREP carrying those recovery observations.
  The accepted original proposal remains immutable. The final report states
  `verified-in-isolated-lab`, and keeps the remaining nullable-source defect
  and absent provider/production proof visible.

This is configuration restoration, not a code repair. The same null input can
still reproduce the known defect. The fault author also knows the fault while
investigating; this does not establish independent blind agent diagnosis. The
proposal execution adapter is unconnected throughout. No automated recovery,
deployment, real incident, email, PagerDuty, production Access/MFA, physical
factor or screen-reader acceptance is claimed.

The native UI uses real EmDash 1.3.1 setup, a virtual passkey, and its actual
review endpoints. Direct store calls prepare and revise the fictional local
proposals; no identity or session rows are injected. `runtimeSourceHashes`
records original and executed fixture bytes separately. The proposal origin
comparison is the existing local-fixture seam; the other listed source files
are unchanged. The fixture's separate seams also record the native-auth config,
local overview origin and temporary route. Provider service bindings, routes
and cron are absent in this copy.

## Harness failures and cleanup

The first attempt named its route folder with an underscore; the installed
Astro router explicitly ignores such names, so the baseline correctly failed
with 404. It was renamed only in the temporary route template. The next run
completed fault/review/manual recovery, then Vite's development error overlay
from the intentional exception intercepted a native button. The finished
runner recognizes only that nullable-caption overlay and reloads the real
native route after recovery. Escape and outside-click dismissal were unreliable
inside the native shell. This does not replace a request, remove an overlay from
the DOM, or suppress an unexpected application error.

Every attempt uses one fresh owned root, registers cleanup before preparation,
checks the daemon's actual working directory before stopping it, and removes
the root on success or failure. `cleanup.json` records final removal. Native logs and failed-attempt captures remain in ignored `output/`; the twelve
finished-run screenshots and bounded receipt are retained here. No other checkout or daemon is stopped.

The final run passed all native assertions and cleanup at `http://localhost:50913`,
using source `e0a7d6e034e4e36f691b48f2468861b56125d134` plus the uncommitted fixture
work recorded here. The affected store/grant/process checks passed 35/35. The
only browser console error was the deliberate stale-approval HTTP 409; no page
script error or horizontal document overflow was observed. These checks do not
certify the entire native shell or physical/assistive technology behavior.
