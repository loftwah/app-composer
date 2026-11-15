# Launch outcome map — 15 November 2026

This is the run record for the owner play-through. It maps the issues named in
the run brief to what actually changed, what stayed open, and why. It is not a
closure claim: an issue closes only when its own current acceptance is met.

## Release identities

| Surface | Source | Worker | Live identity |
| --- | --- | --- | --- |
| Media Studio | `13103c975f5469923448eb75b1abcec6e233c185` | `6fe20afa-6863-4db2-86da-a0eaed5f24f3` | [build.json](https://media.loftwah.com/build.json) |
| App Composer | `4e474d2aa110621f6028f9df683f7c366621d398` | `b0153865-a542-4ec2-ab7a-3fb492525099` | [build.json](https://composer.loftwah.com/build.json) |

Studio releases in this run: `0de910b` (Assemble workbench), `8e465d3`
(exact-take review), `5d48bcf` (project-scoped comparison), `3b30b54` (source
still beside each take), `550878d` (pick updates the verdict), `13103c9`
(selected frame in the create review).

Composer releases: `d2c65ec` (run-scoped benchmark review and JSON export),
`bfdef9d` (Media Studio blueprint), `4e474d2` (Studio pin at `13103c9`).

## Issue outcomes

| Issue | Outcome | Evidence and remaining work |
| --- | --- | --- |
| Studio [#148](https://github.com/loftwah/composer-media-studio/issues/148) Assemble/Promo workbench | **Advanced, stays open** | `0de910b` replaced the half-empty form with a scene rail, active-scene editor, brief fields and script panel. Verified on the owner session at 1728×851 CSS px (DPR 2), plus 1440/1512/1280/1024/768/390/320 widths in a browser. Remaining: 200%/400% zoom, conflict/read-only browser cases and the wider sibling-pane audit. |
| Studio [#2](https://github.com/loftwah/composer-media-studio/issues/2) Owned studio proof | **Advanced, stays open** | Real matched still pair (Studio Film `$0.02`, Studio Print `$0.03`) and motion pair (H3 `$0.24`, Kling `$0.35`) in one owned project. Both compare groups are playable; provider charges remain not reported. A real review rejected Kling for losing the source subject and picked H3. The executed results and reviews are pinned in Studio `7ba1a54` under `fixtures/comparison-fixtures.json`. |
| Studio [#10](https://github.com/loftwah/composer-media-studio/issues/10) React shell/navigation | **Not this run** | The page-level defect was fixed under #148. The grand shell/React rewrite, trapped-navigation audit and full Impeccable evidence remain owned here. |
| Studio [#14](https://github.com/loftwah/composer-media-studio/issues/14) Music video | **Advanced, stays open** | The owner's existing 33.04 s local render plays with sound; its receipt binds storyboard revision 4, six source hashes and the soundtrack hash. Take replacement is visible across revisions. Revision 4 reopens with six 5.5 s shots, the saved mixed bed and its source track. Caption-burned export and the complete new music-video path remain open. |
| Studio [#15](https://github.com/loftwah/composer-media-studio/issues/15) Director | **Advanced, stays open** | A typed scene proposal for saved plan revision 4 was previewed against the real plan, showed before/after direction and the Low Tide reference, and applied to the draft only. A reload restored revision 4 unchanged. The full Director conversation and human approval remain open. |
| Studio [#11](https://github.com/loftwah/composer-media-studio/issues/11) MCP | **Not this run** | The deployed server and OAuth remain as recorded; a real Codex/OpenCode connection and authenticated production tool call are still unverified. |
| Studio [#13](https://github.com/loftwah/composer-media-studio/issues/13) Public studio | **Not this run** | The public gallery and withdrawal path remain live; no new publication was made in this run. |
| Studio #16/#17/#19/#20/#64/#65/#67/#147/#146 | **Post-launch / owned elsewhere** | No new evidence this run. Their existing partial receipts remain valid. |
| Composer [#601](https://github.com/loftwah/app-composer/issues/601) Benchmarks Studio | **Advanced, stays open** | `d2c65ec` binds a review to one recorded run, keeps other runs' picks, and exports private JSON. The zero-spend suite recorded 13/13 checks. The prepared H3/Kling pair was executed and reviewed. Capability packs, timed second harness, real build/deploy trials and a portable rebuild remain open. |
| Composer [#600](https://github.com/loftwah/app-composer/issues/600) Recursive blueprints | **Advanced, stays open** | `/blueprints/media-studio.json` now pins the standalone Studio at `13103c9`. It stays **Reference**. Independent blueprint replays and the remaining portfolio examples are not proven. |
| Composer [#457](https://github.com/loftwah/app-composer/issues/457), [#499](https://github.com/loftwah/app-composer/issues/499), [#590](https://github.com/loftwah/app-composer/issues/590) Studio/ownership epics | **Advanced indirectly** | The Studio releases above are real slices of the provider-backed studio and the owned creation surface. Their wider acceptance is unchanged. |
| Composer [#425](https://github.com/loftwah/app-composer/issues/425) Flagship | **Not this run** | Creator Hub and its follow-up remain as recorded. The independent newcomer and their owned deployment were not available. |
| Composer [#495](https://github.com/loftwah/app-composer/issues/495) First impression | **Previously shipped, still open** | The comprehension fix remains live. A cold independent visitor was not available. |
| Composer [#615](https://github.com/loftwah/app-composer/issues/615), [#597](https://github.com/loftwah/app-composer/issues/597), [#598](https://github.com/loftwah/app-composer/issues/598), [#599](https://github.com/loftwah/app-composer/issues/599) | **Post-launch decision** | These are platform-sized work packs, job contracts and workspace scoping. No bounded slice was safe to start before the existing Studio/native work was integrated. |
| Composer [#604](https://github.com/loftwah/app-composer/issues/604), [#613](https://github.com/loftwah/app-composer/issues/613), [#477](https://github.com/loftwah/app-composer/issues/477), [#586](https://github.com/loftwah/app-composer/issues/586), [#596](https://github.com/loftwah/app-composer/issues/596), [#602](https://github.com/loftwah/app-composer/issues/602) | **Post-launch decision** | Social connection, public proof, sharing and widget work need their own connector/consent/audience evidence. No post or campaign was published. |
| Composer [#605](https://github.com/loftwah/app-composer/issues/605), [#609](https://github.com/loftwah/app-composer/issues/609) | **Post-launch decision** | Cross-app layout and docs UX remain broad audits. The Studio page-level layout defect was fixed at its own source instead. |
| Composer [#311](https://github.com/loftwah/app-composer/issues/311), [#117](https://github.com/loftwah/app-composer/issues/117), [#118](https://github.com/loftwah/app-composer/issues/118), [#291](https://github.com/loftwah/app-composer/issues/291), [#8](https://github.com/loftwah/app-composer/issues/8)/[#9](https://github.com/loftwah/app-composer/issues/9)/[#10](https://github.com/loftwah/app-composer/issues/10), [#113](https://github.com/loftwah/app-composer/issues/113)–[#116](https://github.com/loftwah/app-composer/issues/116) | **Not this run** | Native inbox, connections, recovery and workspace isolation were not part of this slice. Existing receipts remain. |
| Composer [#603](https://github.com/loftwah/app-composer/issues/603), [#18](https://github.com/loftwah/app-composer/issues/18), [#24](https://github.com/loftwah/app-composer/issues/24), [#25](https://github.com/loftwah/app-composer/issues/25), [#114](https://github.com/loftwah/app-composer/issues/114), [#115](https://github.com/loftwah/app-composer/issues/115) | **Not this run / already closed where applicable** | #603 is closed. The others retain their existing acceptance and evidence. |

## Owner actions taken and remaining

Taken in this run:

- The owner signed into the Studio through the existing Composer session.
- The owner approved the matched-pair spend. The executed Studio allocations
  were `$0.24` (H3), `$0.35` (Kling), `$0.03` (Studio Print) and `$0.02`
  (Studio Film): `$0.64`. The project now shows `$2.835` spent of `$5.00`.
- No passphrase was pasted into chat, logs or a file.

Remaining:

- Provider invoices are not linked. Every provider charge on the comparison
  page stays **not reported**.
- The complete Director conversation, caption-burned export and a full new
  music-video path were not exercised in this run.
- Independent newcomer, physical iOS and social-channel posting still need
  their own participants, devices and approvals.

## Follow-up delivery — 15 November 2026, evening

The evening run kept the same owner session and added the following. Read the
[model freshness receipt](model-freshness-20261115.md) and the
[private play-through](../play-through-20261115/README.md) for exact evidence.

| Surface | Source | Worker | Live |
| --- | --- | --- | --- |
| Media Studio | `2640e67b7224f9c3a2ada1b77e364769ac4039b5` | `e560dc4b-4c97-4ccd-a098-f4e2b89fa098` | [build.json](https://media.loftwah.com/build.json) |
| App Composer | `f26c94030e039c54c49d009d860b5b396736821f` | `8fa56e05-d986-43b5-8b51-45cb37c9a6f2` | [build.json](https://composer.loftwah.com/build.json) |

| Issue / item | Outcome | Evidence and remaining work |
| --- | --- | --- |
| Studio model retirement (new [#156](https://github.com/loftwah/composer-media-studio/issues/156)) | **Delivered; close proposed** | SDXL Lightning was withdrawn before its 20 November cutoff. Studio Draft uses FLUX.2 Klein 9B; saved jobs keep the exact SDXL attribution. A live Studio request saved `gen_4515ab469ca948dfbe5587bbf142c8ac` at 1024 × 1280 on the real adapter. The manifest has zero alerts. The close is waiting in the GitHub panel for owner approval. |
| Studio [#148](https://github.com/loftwah/composer-media-studio/issues/148) Assemble workbench | **Advanced; stays open** | `2640e67` adds read-only treatment, conflict recovery (keep draft on latest revision, load saved, retry, keep as new brief), focus restoration and extreme-width grid fixes. Live 1728/864/432/390/320 widths have no horizontal overflow and keep the rail, stage and save bar. Remaining: six long scenes, real mobile software keyboard, reduced motion, user-journey recording and owner acceptance. |
| Studio [#14](https://github.com/loftwah/composer-media-studio/issues/14) Music video | **Advanced; stays open** | The existing project's plan revision 6 was mixed to a saved WAV and rendered locally with **burned-in captions**: 640 × 360, 16.8 s, 2.6 MB, asset `asset_a8ee90d0730f4276a9d2808c73d0ee99`. The private receipt binds revision 6, three source hashes, the mixed soundtrack, caption look and output hash. Audio decoded during playback. The older 33 s film is unchanged. Remaining: full new song path, ≥4 scenes, reroll/alternative take proof. |
| Studio [#15](https://github.com/loftwah/composer-media-studio/issues/15) Director | **Advanced; stays open** | A typed scene proposal changed only scene 1 of plan revision 5, previewed before/after, applied to the draft, saved as **revision 6**, and survived reload. Revision 5 and all takes/captions remain. The full conversational Producer, named character, MCP parity and refusal/approval states remain open. |
| Composer [#457](https://github.com/loftwah/app-composer/issues/457) / [#499](https://github.com/loftwah/app-composer/issues/499) / [#590](https://github.com/loftwah/app-composer/issues/590) Studio epics | **Advanced indirectly** | Composer Init now consumes the Studio capability snapshot and migrates retired selections. Studio pin moved to `2640e67`. Wider ownership and evolver acceptance unchanged. |
| Composer [#609](https://github.com/loftwah/app-composer/issues/609) Docs UX | **Advanced; stays open** | Live `/docs` now opens with “What do you want to make or do?”, six task paths, local search and canonical copy actions. The 17-section technical reference moved to `/docs/how-it-works` with legacy anchors preserved. Live [desktop](docs-1440.png) and [phone](docs-390.png) captures; [reference phone](docs-how-it-works-390.png). Remaining: five-person test, fresh-agent copied-output proof, wider tutorial migration. |
| Composer [#621](https://github.com/loftwah/app-composer/issues/621) Design LEGO | **Advanced; stays open** | Live Composer includes the merged **Workshop press** Brand Studio skin: opt-in, saved/reopened through the existing record, default branding unchanged, silent until enabled, keyboard/reduced-motion paths tested locally. The admin route needs the owner's Cloudflare Access sign-in, so live skin inspection remains. |
| Composer [#600](https://github.com/loftwah/app-composer/issues/600) Blueprints | **Advanced; stays open** | Media Studio blueprint still **Reference**, now pinned to `2640e67`. No independent replay this run. |
| Composer [#601](https://github.com/loftwah/app-composer/issues/601) Benchmarks | **Not this run** | The capability refresh and live model receipt are reusable evidence, but no new benchmark run was executed. |
| Composer [#599](https://github.com/loftwah/app-composer/issues/599), [#598](https://github.com/loftwah/app-composer/issues/598), [#604](https://github.com/loftwah/app-composer/issues/604), [#613](https://github.com/loftwah/app-composer/issues/613), [#596](https://github.com/loftwah/app-composer/issues/596), [#602](https://github.com/loftwah/app-composer/issues/602), [#617](https://github.com/loftwah/app-composer/issues/617) | **Not this run** | Workspace, enquiry, social, analytics, widget, identity and second-consumer proofs need their own bounded slices. Existing receipts remain valid. |

Remaining owner decisions:

1. Approve or skip the proposed Studio #156 close in the GitHub panel.
2. Sign into the Composer EmDash admin through Cloudflare Access to inspect the
   Workshop press skin live.
3. Provide a controlled recipient/sender authority before any real reply or
   social send.
4. Provide an independent newcomer/account if the Creator Hub proof should leave
   **Reference**.

