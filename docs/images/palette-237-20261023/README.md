# Mini-app palette propagation, 23 October 2026

Production verification: 14:22 AEDT / 03:22 UTC. The [machine receipt](receipt.json)
records exact independent releases, Worker versions, served CSS hashes and the
20-case Chromium matrix (1440×1000 and 390×844, dark/light). These are actual live
pages; the earlier candidate interception renders are excluded. Full original PNG
captures remain under the run's ignored `output/playwright/`.

| App | Before phone light | Live phone light | Before desktop dark | Live desktop dark |
| --- | --- | --- | --- | --- |
| Here / there | [Before](guestbook-before-390-light.webp) | [Live](guestbook-live-390-light.webp) | [Before](guestbook-before-1440-dark.webp) | [Live](guestbook-live-1440-dark.webp) |
| Hello | [Before](hello-before-390-light.webp) | [Live](hello-live-390-light.webp) | [Before](hello-before-1440-dark.webp) | [Live](hello-live-1440-dark.webp) |
| Link Check | [Before](linkcheck-before-390-light.webp) | [Live](linkcheck-live-390-light.webp) | [Before](linkcheck-before-1440-dark.webp) | [Live](linkcheck-live-1440-dark.webp) |
| Linkarooie | [Before](showcase-before-390-light.webp) | [Live](showcase-live-390-light.webp) | [Before](showcase-before-1440-dark.webp) | [Live](showcase-live-1440-dark.webp) |
| Carry / forward | [Before](state-before-390-light.webp) | [Live](state-live-390-light.webp) | [Before](state-before-1440-dark.webp) | [Live](state-live-1440-dark.webp) |

The other theme/viewport combinations follow the same filenames. Before images
record the observed live palette; that first capture did not separately query
build identity. Live images are bound to queried release identities and matching
served CSS. Focus, hover and held-pointer pressed styles were measured without
activating an action or submitting content. All 20 cases had no horizontal overflow.

The three Composer-default shells now use `#fc5b05` primary fill with `#17181b`
ink in both themes; hover is `#ff7a33`, pressed `#e85404`. Ordinary accent text is
`#fc5b05` dark / `#c74400` light. Independent review caught insufficient contrast
for light focus on elevated surfaces: light focus now uses `#c74400` (4.25:1 on
ivory, 3.73:1 on Carry's violet surface). Regression tests derive the actual app
background/surface values. Linkarooie's lime/purple and Carry's violet identity
palettes remain intact, as do independent illustration/social artwork and saved
owner configuration.

All five clean pushed-main deployment guards passed repository checks/builds,
source identity and applicable live sharing probes: 107 Guestbook, 105 Showcase,
57 Link Check, 19 Hello and 26 State tests. The canonical parent contract and new
content-project defaults were already corrected under #214; #237 repairs the
native default aliases that the launcher-only copy had missed. The same copied
`launcher.css` now carries `composer.palette/1` roles without an extra request.

Exact Guestbook/Showcase service promotion prepared composition
`115e6d85f86af78436cdee88b63616448997befc6278665963dcfc7284232a7a`.
Composer activated those service bindings through its guarded production release
at source `82cff759980428fcce1abfc9c14f99a64d2f317d`, Worker
`38a90088-38fb-4a87-b38d-a2307b0e0925` (100% traffic). The final
[mounted receipt](mounted-receipt.json) records service versions, exact source
identities, matching launcher hashes and all eight actual mounted browser cases.
Mounted before/live filenames add `-mounted-` before the stage; both themes and
viewports are retained. Verified 14:33 AEDT / 03:33 UTC. This evidence-only
branch does not advance the deployed main source.
Physical-device, screen-reader and external platform rendering remain separate.
