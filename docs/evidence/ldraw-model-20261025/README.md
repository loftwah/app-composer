# A model edits the real LDraw scene — 25 October 2026

Composer #375 / LDraw #1. The independently merged local MCP source is
`b3cd3237c1333fa9c19d791dfb24cc380a29cb8c`; no new renderer was introduced.
Codex CLI0.145.0 / gpt-5.6-sol connected to its real stdio server with a
host-selected, disposable drawing workspace. Provider credentials were excluded.

The session listed templates and brand status, created the existing architecture
and journey presets, read native scene revisions, revised labels and inserted
maintained blocks. It exercised a stale revision refusal and read back unchanged
current content. It rendered real PNG/SVG/native round trips through Excalidraw
0.18.1 and inspected the first exported PNGs. Original source IDs survived those
round trips (38 review /44 contribution elements). The first session's MCP
transport closed after a final edit; that refreshed render was correctly marked
unknown. A fresh explicitly scoped session re-read both exact filenames and
completed rendering/round-trip checks. An earlier recovery attempt was refused
because its prompt omitted the filenames; it is not counted as a pass.

## Defects found and fixed

Actual editing found two transport-contract defects: `update_label` rejected
uppercase IDs present in LDraw's own preset, and unsupported measured-font
characters returned a generic error. Both now have failing-before/passing-after
regressions. Existing native IDs remain exact; new label/prefix slugs retain
their existing strict grammar. Known text refusals return Unicode code points
and guidance without echoing a label or host path. Unknown failures stay
redacted. Independent review found no material issue.

[LDraw PR3](https://github.com/loftwah/app-composer-ldraw/pull/3), head
`9fec6e795dd3fc68d1fb5a63f72c5e698e4c8fc1`, merged as
`9247b73f63a4d5ec98b6a1a87959b964e6d72208`. Check:41pass/1opt-in-render-test skip,
build and audit pass. The actual model render exercises the skipped renderer
path separately. This changes the local MCP source; it makes no claim that the
standalone browser editor was redeployed or its source pin silently promoted.

## Publication review

The two maintained presets and approved Composer identity were exercised;
Linkarooie's documented lime family was reused without inventing a complete
brand pack. The resumed client reported geometry acceptance but no pixel
attachment in that session. The integration owner therefore inspected actual
PNG pixels and curated the authored scenes before publishing: removed duplicate
preset explanations, enlarged tiny labels, re-centred changed text and used the
accessible darker orange for text on white. The review diagram names release
requirements instead of the preset's irrelevant generic storage/Queues example.
Independent source review caught an overclaim in the original model scene: the
existing release guard does not consume an accepted agent-proposal digest. The
corrected scene and text show proposal-review CAS separately from a manual
handoff to clean pushed-main deployment, and explicitly label the execution
adapter unconnected. The corrected PNG and all eight page views were rendered
and reviewed again. No fake deployed architecture or new brand is published.

Versioned editable sources, real PNG and font-embedded SVG are together under
`public/diagrams/ldraw/*-20261025-model.*`. Retained selected IDs/text reproduce
through the existing renderer; intentional removed IDs and exact hashes are in
`publication.json`. The raw model sources, transcripts and superseded outputs
are bounded ignored evidence under `output/ldraw-model/`; no entire temporary
project or browser profile remains. Rendering's internal owned roots were also
removed by its existing finally cleanup.

The existing atlas and architecture context use the revised approval view; a
new contribution view links from the build story. Both retain an expandable
semantic text equivalent and editable/download actions. The earlier immutable
URLs remain available. Page composition is reviewed in desktop/phone and both
themes; white drawing paper is deliberately retained in both themes. These
are technical explanations, not device/creative owner approval or a new
production incident/deployment receipt. Live source/asset checks belong to #11.
