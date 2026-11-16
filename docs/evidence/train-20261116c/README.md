# Evening delivery train — 16 November 2026

This is the live verification record for the second 16 November train. It is
not a release receipt index; [#11](https://github.com/loftwah/app-composer/issues/11)
keeps the canonical release evidence.

## Released sources

| App | Source | Worker | Release |
| --- | --- | --- | --- |
| Media Studio | `eb127cfcddfb2a468ceacb45fe2bb29744ee7355` | `428b691d-c2f5-4ddb-bccb-9aed7560c371` | 30.8 s |
| App Composer | `4c851cb731ef9a8f35ba18deacf6c6fc944a0442` | `a6ccf6d3-a278-4291-bec8-b8969a3672a0` | 123.6 s |
| App Composer (Workers redirect correction) | `57d4174b5db7d151a19dc51cb2fcec6fba6bcb8f` | `0afe3f07-afb7-4613-9ef7-e8ce90303b76` | 93.6 s |
| App Composer (relationship and composition check) | `f6aa705808c548fcbabc2b17015a56a6fe864214` | `ee638fad-c6f7-4813-80fd-46fd00823697` | 90.0 s |
| Hello reference | `29efbab96d57d919c4cd3eba14d775a440713338` | `584caa40-7de2-4370-abb3-b70899213ac8` | verified at `ready.loftwah.com` |

Every Composer and Studio release used the repository's own clean pushed-main
guard. Hello used its explicit target guard, exact pushed main and live
`/build.json` identity check. No new release service, CI workflow or credential
was added.

## Studio #10 — viewer navigation and signed-in contrast

Live `media.loftwah.com` at `eb127cf`. In the signed-in owner session
(`Opened from App Composer · dean`):

- The proof project library rendered one `role="tablist"` with seven tabs,
  roving `tabindex`, `aria-controls` and a labelled tab panel.
- Opening `Proof plate · teal` from the viewer hash produced one
  `role="dialog"`, `aria-modal="true"`, background `inert`, and focus on the
  labelled **Close the viewer** control.
- Escape returned to `#/p/prj_c0b0c0580e8c461b93726b24b99a1912/library`.
- `#/p/.../nonsense` normalised to Library and showed “That studio section
  doesn't exist, so Library is open.”
- The signed-in kind badges resolve to dark ink on a near-white composite
  (`color(srgb 0.949 0.952 0.961 / 0.84)` over `rgb(32,34,39)`), not the
  low-contrast pair an alpha-blind sample suggests.

Branch evidence: `docs/evidence/2026-11-16-studio-10-navigation-contrast/`
contains the before/after computed-style JSON, 59/59 browser checks and the
find→fix record. Physical-device and screen-reader acceptance remains #182.

## Studio #183 — live browser-local image workbench

`https://media.loftwah.com/tools/images` is public and signed out. In the real
browser:

- The generated sample loaded as `studio-image-sample.png`, 1400 × 900,
  1.00 MiB, alpha channel present, SHA-256 `58f30676…`.
- Long edge 300 with a 1:1 centre crop produced 300 × 300.
- PNG output was 91 KiB; switching the same settings to WebP produced 13 KiB
  with a real `.webp` download and a 300 × 300 preview.
- The page states that SVG, HTML, HEIC/HEIF, AVIF and GIF are refused in this
  slice, that the original File is unchanged, and that no file is uploaded.
- The batch control and the explicit private Studio import remain separate from
  the local processing action.

Evidence and the coverage matrix: `docs/evidence/2026-11-16-browser-local-image-workbench/`
and `docs/image-tools-coverage.md`.

## Composer #114 — two saved stacks, revisions and withdrawal

Workspace `dean` (owner) in the native Creator stacks editor:

- Duplicated the controlled **Fictional Trail Notes** stack into a draft
  **Fictional Trail Notes copy**. The copy received its own visitor book
  `4ee89770 · configuration 1`; the original retained `2056b6dd ·
  configuration 11`.
- Edited the copy to **Train isolation copy**, Midnight, with a distinct
  description. Saved draft revision 2, previewed the real page, applied app
  settings and published saved revision 9 at
  `/s/fictional-trail-notes-copy`.
- Edited the first instance label to **Isolation drop**, saved revision 11
  while the public page still served revision 9, then published revision 11.
  The public page then showed `Isolation drop` and `revision 11`, so the draft
  did not leak.
- Unpublished. The public address returned **404**; the stored publication was
  retained. The original stack still returned **200** with `revision 30` and
  its approved postcards.
- Archived the copy. It became locked and left the public address. No app-owned
  records were deleted.
- A write with a foreign workspace id returned `ok:false`,
  `code:"FORBIDDEN"`, **“This workspace is not yours.”**

## Composer #24 / #25 — submit, moderate, feature, withdraw

Live `guestbook.loftwah.com` and `showcase.loftwah.com`:

1. Submitted a clearly fictional postcard through the public form with the
   guest code, explicit consent and the alias **App Composer train fixture**.
   The form generated the PNG from the message and returned “Postcard sent”.
2. In native **Manage mini-apps**, the pending item appeared. **Approve photo**
   returned “Photo approved. It can appear publicly and is eligible for
   Linkarooie.”
3. **Feature in Linkarooie** returned “Photo marked as featured in Linkarooie.”
   The guestbook public page showed the postcard and its item page; the
   showcase rendered a card linking to `guestbook.loftwah.com/item/86871279-…`.
4. **Hide photo** returned “Photo hidden. Controlled public and featured paths
   now refuse it.” The item and media both returned **404**, and the text
   disappeared from both public pages.
5. The standalone guestbook kept two approved public items and its contribution
   route; the showcase stayed at **200** with its authored cards and no
   dependency on the hidden source.
6. The native Linkarooie surface saved a manual reorder: the public collection
   changed from `LoftwahFM, Loftwah the Beatsmiff` to `Loftwah the Beatsmiff,
   LoftwahFM`, then the original order was restored and read back. Manual cards,
   reorder and the composed feature/revoke path therefore work without the
   guestbook copied into Linkarooie.

A form-driven live change then renamed the standalone guestbook to
**Loftwah's train field notes** and switched it to Daylight. The live title and
`data-theme="light"` changed. The original title and Midnight theme were
restored and verified. No source redeploy was needed for an app-owned
configuration change.

## Composer #601 — real matched media comparison

The blind page is
`https://composer.loftwah.com/benchmarks/media?run=animate-a-still-v1-d20cbf5`.

- Two saved Studio video jobs shared the exact still bytes
  (`7758a17cd5e12dd1…`), prompt digest, recipe, duration and aspect; the model
  was the only intended variable.
- The pair is H3 Max Turbo 768p (1344 × 768, 5.184 s, 17.1 s job latency,
  US$0.24 estimate) against Kling 2.5 Turbo Pro (1920 × 1080, 5.042 s, 141.2 s,
  US$0.35 estimate). Provider charges were not recorded.
- The blind HTML contained no model/provider names. Both clips played through
  opaque routes; range requests returned **206**.
- One blind visitor vote was recorded for side A at
  `2026-11-16T11:08:09Z`. The revealed run page shows
  `1 blind · 0 unblinded · unauthenticated labels`; the export contains the
  same vote and reopens.
- Limits are explicit: one pair, no repeated trials, a prompt/still conflict,
  different output resolution and one clip with an audio track.

## Composer #604 — Bluesky identity and exact approval

A real Bluesky draft for **Fictional Trail Notes** is in the owner calendar:

- Public handle `loftwah.com`, display name **Loftwah**, DID
  `did:plc:axc7n2yjep6ggdz7fuztluc4`, resolved through the public AT Protocol
  AppView from the Composer Worker.
- **Publishing authorised: No.** No password, app password or token was
  requested or stored.
- Exact text is 101 / 300 graphemes and 101 / 3000 UTF-8 bytes. The package
  carries the published share-card descriptor hash, the canonical link and the
  public alt text.
- Intended time: **2026/11/17 09:30 AEDT · 2026/11/16 22:30 UTC**. Revalidated
  immediately before the approval prompt.
- State: **Awaiting approval — not sent**. The panel has no send adapter in this
  build. LinkedIn remains the manual fallback.

The live resolver initially failed because Cloudflare Workers reject
`redirect: "error"`. The fix uses `redirect: "manual"` and treats a 3xx as an
unavailable identity; the same Workers-incompatible option was corrected in the
model-intelligence adapter with a regression test.

## Composer #658 — Command Centre

Signed-in `/_emdash/admin/plugins/composer-stacks/command-centre` at
`57d4174`:

- Live read of `loftwah/app-composer`: **152 open issues**, **0 open pull
  requests**, latest commit `57d4174b5db7`, every section confirmed.
- Completion outlook: **UNKNOWN**, with the exact reason “The sampled completed
  issues span 9 days; at least 14 days are needed for a weekly rate.” No date
  is invented.
- Plan showed the bounded 100-item sample, explicit parent/blocker/PR
  references and “No milestone is recorded”. Delivery showed 19 sampled
  closures, median cycle 1.49 days (n=16), changing scope and no release-linked
  closure presented as live.
- No blocked/needs-attention label is defined on the repository, so the view
  says so rather than rendering zero.
- A live defect was found and fixed: the relationship parser read the prose
  “**Presentation/discovery:**” as the `PR` label and invented a pull request
  for #7/#28/#29. Labels now require a word boundary; #11 parses with parent
  #1 and no invented PRs.

## Composer #613 — shareable public insight

`/activity` now carries a shareable complete-day insight. The live card and
page use the real 17 Oct–15 Nov 2026 UTC window:

| App | Recorded opens | Share |
| --- | ---: | ---: |
| Linkarooie | 823 | 25% |
| Here / there | 758 | 23% |
| Link Check | 594 | 18% |
| Carry / forward | 585 | 18% |
| Hello World | 520 | 16% |
| **Total** | **3,280** | **100%** |

`/insights/recorded-app-opens?from=2026-10-17&to=2026-11-15&surface=all`
returned **200**; the card returned **200 image/png, 1200 × 630, 78,166 bytes**.
The copy defines a “recorded open” as a request, not a person or conversion.
Withdrawal, malformed windows and unavailable counters fail closed.

## Composer #5 — the composition pipeline checks the composed source

`pnpm compose` used to compare each independent app's live `/build.json` with
the source pin. That is the wrong target: the composed services at
`/guestbook/` and `/showcase/` keep their reviewed pins while the standalone
apps can move ahead independently. The default run therefore failed on a valid
composition.

The script now validates the mounted composed source at
`https://composer.loftwah.com/<app>/build.json` against the selected pin, while
keeping the standalone origin for configuration. The reviewed
`composition.lock.json` and its service names are unchanged. `pnpm compose`
now passes reproducibly:

```
Validated pinned composition 8428e16f61c25a4d524abb691e440b36fe07c92e21c2f3843e43962b197f1e1e.
No source code downloaded from the registry was executed. Candidate staged; nothing deployed.
```

The mounted Guestbook is `5075d7be…` and the mounted Showcase is `f1dd2795…`;
the standalone apps are independently at `a8191d34…` and `e6780997…`.

## Composer #18 / #20 — fresh checkout, refused dirty deploy, real change

A fresh clone of `loftwah/app-composer-hello` at `a6aa209` was installed and
checked (`28/28` tests). With an uncommitted `config.json` edit, the deploy
guard refused before any provider mutation with **“Commit reviewed source
before release”**, and the local edit was preserved.

The reviewed intro was then changed to “Made in my App Composer workspace. A
tiny app that confirms this environment can build, deploy and change.”,
committed as `29efbab`, pushed to main, and deployed with the explicit
repository, account, Worker and HTTPS target. Live `/build.json` reports
`29efbab…`; the live page shows the changed sentence. The existing
`ready.loftwah.com` target was reused, so no new repository, Worker, domain,
purchase or cleanup debt was created.

## Remaining limits

- Studio #10 physical-device, screen-reader, switch and touch-assistive proof
  stays #182.
- Studio #183 is the first Wave 1 slice; background removal, GIF, PDF, sprite
  sheets, agent/headless parity and cross-browser proof remain open.
- Composer #604 has no authorised posting adapter and no owner approval. The
  draft is scheduled and awaiting approval, not published.
- Composer #601 has one pair, one vote and no repeated trials. It is not a model
  ranking.
- Composer #658 still has no Project V2 read, no second production source and no
  signed-in screenshots at 390/1440 in this record.
- Composer #613 is Slice A only; reusable blocks, a second independent app and a
  Woodhouse projection remain open.
- No spam, personal data, private account ID or credential is included here.
