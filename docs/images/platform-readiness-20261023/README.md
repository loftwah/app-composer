# Get Ready platform assessment evidence

Product source: `f2eeef822bda37b08ca2b0bea617fa59d8cbff2e`, based on
`b90092418c5b19b78a1fd4093d697b1792c61436`. PR #263. Capture date:
23 October 2026, Australia/Melbourne. The later evidence-only commit does not
change the product files; integration and production require their own exact
source/build/live checks.

The page and React component were served by the actual built local Worker.
Private EmDash GET responses were intercepted with labelled fictional accounts,
teams and policies. These are **browser-response-double UI checks**, not native
authentication, current provider access or production readiness qualification.
No account, invitation, grant or app resource was created. Every intercepted
plugin request was GET.

`qualification.json` records all 13 browser cases, the source, bounded request
paths and image SHA-256 values. It also records the passing required `pnpm check`
(694 tests, no skips), Astro (0 errors / 0 warnings) and `pnpm build` publication
inspection (1,080 files / 78 archive members). The selected real-app default-fetch
test used the existing clean Guestbook checkout at locked source `9515b359`;
it is distinct from workerd named-entrypoint acceptance. Six offline package
consumer tests and seven pinned-Wrangler authentication tests also passed.

The UI cases cover team A → B selection and current Init links; private
observation download; empty/adoption/missing-adapter/viewer/older-runtime states;
denial without fallback; wrong workspace; account change; signed-out access;
invalid/repeated selection; and real Tab focus with reduced motion. Direct
programmatic focus after mouse input was rejected as a keyboard test; the passing
case uses actual keyboard navigation.

`capture.json` records a separate final capture-only pass on the same unchanged
product source/build. The included PNGs are normal 390 × 844 and 1440 × 1000
viewports in both themes, at the page top and setup panel. Two additional
390-pixel lower-panel captures cover standing rules, adapter configuration and
the protected/current-team continuation actions. Scrolls were explicitly
instant and frames/fonts settled before capture. Earlier stitched/fullpage and
smooth-scroll transition captures are rejected and excluded. This establishes
neither physical-device nor actual screen-reader acceptance.

`public-platform-metadata.json` is a separate anonymous production HTTP
observation of `/platform`: canonical/title/description and actual approved JPEG
bytes at 1200 × 630, with source unchanged across the observation. It does not
prove native social-unfurl rendering, clipboard success or the new readiness UI
in production.

The bounded local harness remains under the owning worktree’s ignored
`output/readiness/validate.mjs`; it reused existing dependencies and Chrome,
without installing a browser. Each reservation released after closing its own
browser and Worker process group. The single owned fictional-data/certificate
root was removed and its absence recorded. Failed environment/fixture attempts
remain in ignored output; no complete temporary project or native session is
retained as evidence.

The independent final visual review passed all ten settled frames with no
material findings; its lower-phone evidence condition is resolved. See
`visual-review.json` and `code-review.json`.

An independent source review caught and cleared the initial stale-team Init-link
bug, and approved the final hierarchy/sign-in-context delta. The integration
owner separately owns the additive server `setup.canConfigurePolicy` capability
and its creator-role/workspace-owner tests. The browser fixture here uses the
original conservative role-50 operator flag; it cannot prove that later server
change.

The canonical release index is [issue #11](https://github.com/loftwah/app-composer/issues/11).
The full delegated-member/native two-team, release lifecycle, incident/recovery,
retirement and film criteria retain their owning issues and current limits.
