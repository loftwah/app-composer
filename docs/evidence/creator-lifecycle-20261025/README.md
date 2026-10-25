# Native creator lifecycle acceptance — 25 October 2026

Passed at source `b7841c437b1b3f8e0dd76e33113ea5a91f70707c`, with Guestbook
`5075d7be53b43aca288d3707fd06851aca91e8c2` and Showcase
`f1dd27952ca8548f81fde5c5905346dae4a2b61b`. This is actual isolated local
workerd/EmDash 1.3.1, local D1/R2, StackView SSR, real native React administration
and virtual-passkey sessions. No HTTP response doubles or injected identity or
session rows. It establishes neither a production deployment nor physical-device,
screen-reader, production Access or MFA acceptance.

## What the browser proved

- Team A remains governed. Its creator page explains the application-request
  workflow, links to the scoped request page, disables fields and omits Save and
  Publish controls. Its profile, policy, existing stack, independent resource,
  nonempty content and original PNG digest remain unchanged.
- The same owner creates a new stack in their separate ordinary creator workspace,
  adds the reviewed Guestbook app, applies its declared title and publishes.
  No profile, grant or policy is removed to allow this workflow.
- The native editor previews an unsaved owner label/caption without changing the
  public page. Publishing revision 11 makes the first caption public. Saving the
  next caption remains private: the public HTTP body hash is unchanged. Publishing
  revision 13 changes that body; reviewing and confirming the stored revision 11
  restores exactly its body hash. Draft revision 15 still retains the second
  caption, owner label, app configuration and resource identity/version. Both
  stored publications remain.
- The ordinary new book starts empty and remains empty. Preservation of nonempty
  content/media is demonstrated separately by the unchanged governed Team A
  control, not claimed for this new book. PNG SHA-256:
  `b2ab07c3ebcf81ed916de51db14f880b177a351bad9f3163042b980aba37f6b9`.
- Separate same-context responsive probes check fully loaded governed and ordinary
  views at 390×844 and 1440×1000 in native light/dark mode, with no horizontal
  document overflow. The primary continuous camera stays 1440×1000. PNGs show
  the visible native scroll viewport, not a claim that one screenshot captures
  every section. The retained representative pixels were visually inspected.
- Scoped native outcomes show three retained publication snapshots and unavailable
  action metrics. The fixture does not invent people, activity, revenue or adoption.
- The inherited native journey also retains its role10 delegation boundaries,
  wrong-team refusals, content moderation, real PNG upload and policy controls.

The full bounded [receipt](native-receipt.json) records each public observation,
source hashes, derived local configuration, auth admission and four continuous
1440×1000 WebM hashes. Videos and the remaining screenshots stay under ignored
`output/creator-lifecycle-20261025/ordinary-clean/`; browser profile, cookies,
certificates, databases, copied source and secret material are not retained.

## Reproduction and performance

Use the exact pinned disposable Guestbook/Showcase worktrees described in
[the maintained native demonstration](../../platform/native-demo.md), then:

```sh
TMPDIR="$owned_source_root" python3 /Users/deanlofts/gits/woodhouse-new/scripts/host-validation.py \
  --project app-composer --operation creator-lifecycle-ordinary-native --wait-seconds 1200 -- \
  node labs/platform/native-run.mjs run --admitted --creator-lifecycle \
  --guestbook "$owned_source_root/guestbook" --showcase "$owned_source_root/showcase" \
  --playwright /Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs \
  --output output/creator-lifecycle-20261025/ordinary-clean
```

The successful run took **173.960 seconds** from receipt start to finish; host
reservation elapsed **357.49 seconds**, including **183.19 seconds** FIFO wait
and **174.30 seconds** admitted workload/cleanup. Exact-pin offline installs
reused 39 cached packages each in 294ms and 92ms. No dependencies downloaded.

Browser, fixture root and lifecycle pointer cleanup all report true. Both exact-pin
worktrees and their enclosing `/tmp/composer-creator-sources.OFaEbR` were removed.
No owner checkout, production record, provider resource or application release was
changed. Source lint passes; all 42 maintained formatting checks pass; 26 generated
Creator distributions match. Governed-mode route/editor/public focused tests and
independent review found no critical/important blockers.

## Failures that informed the shipped fix

Earlier attempts are not counted as accepted. The first fixture assertion wrongly
expected an injected resource reference inside the saved draft; it was corrected
to inspect the actual binding store and published document. The next real browser
journey exposed a material product defect: governed Team A displayed editable
lifecycle controls but correctly refused Save at the server boundary. The native
UI now reports governed mode and directs changes through application requests;
the existing server guard is preserved. Unknown/failed refresh metadata disables
lifecycle editing until re-confirmed. Read/export and existing content moderation
retain their separate permissions.

One subsequent attempt was correctly stopped before native writes because a
capture-readiness commit changed the source after preflight. Its cleanup completed;
the final clean immutable source above passed. A separate earlier admission timeout
ran no workload. These waiting/source failures are not application-test passes.

Production promotion, real physical devices/assistive technology, production
Access/MFA, customer onboarding and provider-level data restoration remain separate
gates. The incident/recovery drill has its own independent evidence and limitations.
