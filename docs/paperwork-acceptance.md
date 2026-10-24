# Paperwork acceptance — 24 October 2026

[Open Paperwork](https://composer-paperwork.loftwah.workers.dev/) · [Four-page fictional sample](https://composer-paperwork.loftwah.workers.dev/?sample=lab) · [Completed PDF](https://composer.loftwah.com/paperwork/lab-completed-20261024.pdf) · [Configure in Init](https://composer.loftwah.com/init/paperwork)

Paperwork is independently maintained in [app-composer-paperwork](https://github.com/loftwah/app-composer-paperwork). Served source: `d1801d98179d9fee0f00ec5132ff34659f2ed267` ([PR 1](https://github.com/loftwah/app-composer-paperwork/pull/1), [touch correction PR 3](https://github.com/loftwah/app-composer-paperwork/pull/3)); static Worker version `da983342-d2fd-49a6-8a05-306da4e9fd71`, account `1003dc1d93af0ebea56b2f1252f89627`. Composer's final source, independently promoted navigation pins and active Worker identity are in the single canonical [#11 release receipt](https://github.com/loftwah/app-composer/issues/11). [#264](https://github.com/loftwah/app-composer/issues/264) owns remaining acceptance.

## Actual results

| Journey | Result |
| --- | --- |
| Native field editing | Pass: all 11 supplied field values, including modified prefilled/multiline text, read-only ID, toggled checks, three radio choices and repeated dropdown choices. |
| Mixed annotations | Pass: pen, eraser, undo/redo, text/tick, highlight, imported transparent PNG, movement/resizing and editing the native field afterwards. |
| Rotation and scanned page | Pass: three X/text targets on the 90° page at changed zoom; text/tick/ink/signature on the image-only page. Independent reader finds the text at the intended displayed coordinates. |
| Save/reopen | Pass: actual Chrome 155 download, reopened through Paperwork/PDF.js; supplied verifier checks exact values and every target region. Unchanged source fails completed-document acceptance. |
| Independent inspection | Pass: PyMuPDF 1.28.2 and Poppler render the actual downloaded PDF. Media/crop/rotation match; original scanned RGB pixels are identical; PNG alpha mask is exact and the placed image remains inside its target. |
| Print data | Pass: Print prepares exactly the same completed PDF bytes as Save; browser PDF viewer receives that blob. Actual printer dialog, print-to-PDF and physical paper were not qualified. |
| Phone | Pass: 390×844 touch-enabled WebKit, native field editing, pen touch, undo/redo, signature placement, both themes, no horizontal document overflow and actual exported field value. A native Chromium touch regression also passes continuous ink, Select scrolling without added ink, two-finger zoom and PNG signature movement/resizing. Physical iPhone/stylus/IME remain unexercised. |
| Failure recovery | Pass: encrypted and truncated fixtures produce helpful errors while retaining an unrelated unsaved answer. Unsupported glyph export fails with edits intact. |
| Privacy | Pass: no external HTTP requests or document/signature uploads through the served open/edit/sign/save/print journey; localStorage/sessionStorage/IndexedDB remain empty. Browser-internal Chrome PDF-viewer assets are local, not network egress. |
| Separate connected Chrome review | Pass for built-in lab sample editing, native dropdown, page/zoom, real mouse ink, undo/redo and actual downloaded native values. PNG file selection was unavailable because the extension's Allow access to file URLs permission is disabled. Full file/PNG workflows passed in the automated Chrome and WebKit sessions. Native OS inspection was unavailable while the Mac was locked. |
| Reproduction | Pass: the existing Init command copies the exact reviewed source into an absent owned directory, applies title/introduction/theme, retains source metadata and cleans up its test copy. It performs no install or deployment and does not alter existing drafts. |

The critical live download SHA-256 is `e7d8052865bab48dae63df8a6468396d6ba1c23beb651ee3abdf3434dff92d5f`. The public completed fictional PDF is that exact file. Its print copy has the same hash.

The unchanged owner pack lives under `tests/fixtures/paperwork-fixtures/` in the independent app, including README, generator, expectations, verifier, signature and negative files. Its distributed hashes pass. The intended list widget in this pack is actually encoded with the PDF Combo flag; it was tested unchanged. A genuine multi-select list is exercised with the smaller garden fixture.

## Fixes discovered during delivery

- Mobile signature drags could become native page pans and be cancelled. The SVG root now owns object touch gestures while blank-page scrolling remains available; the native-touch regression is committed in the independent app.
- Read-only fields rendered both their original appearance and an HTML value; the overlay now masks the duplicate.
- Segment-by-segment PDF highlighter strokes darkened at joins; each stroke is now one continuous translucent path, with a focused serialized-stroke regression.
- Action stripping assumed every dictionary's `A`/`Names` entries were action dictionaries. The focused regression now preserves unrelated keys and destination arrays while disabling actual action dictionaries.
- Automation's ambiguous page-label/value matching was corrected with explicit option values. This was a harness failure, not a page-navigation defect.

## Unsupported and unexercised

XFA, encrypted and already certificate-signed documents are deliberately refused. No certificate signing, OCR, AI processing or cloud document storage is offered. The bundled font supports Latin/extended Latin; unsupported characters produce a save error. Added objects remain individually editable during the current session and become ordinary page content in the exported file; native fields remain editable on reopening.

Genuine XFA/certificate fixtures, physical iPhone/stylus input, assistive-technology acceptance, a real printer dialog and an unfamiliar human completing the whole form remain separate gates. No failing exported-field or geometry check remains in the exercised corpus.

`pnpm check`, build and audit pass in Paperwork. Composer and independent launcher releases use their existing clean pushed-main guards. Bounded run evidence stays in ignored `output/live/` (Paperwork) and `output/paperwork/` (Composer); temporary verification dependencies, reproduction copies and independent release clones are removed. No new QA service, GitHub Actions, account, paid SDK or document backend was added.
