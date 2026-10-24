# Paperwork acceptance — 24 October 2026

[Open Paperwork](https://paperwork.loftwah.com/) · [Four-page fictional sample](https://paperwork.loftwah.com/?sample=lab) · [Completed PDF](https://composer.loftwah.com/paperwork/lab-completed-20261024b.pdf) · [Configure in Init](https://composer.loftwah.com/init/paperwork)

Paperwork is independently maintained in [app-composer-paperwork](https://github.com/loftwah/app-composer-paperwork). Served source: `028ce03467b51e0f8ee80326a3b328300ecffc8b` ([HTML-preservation PR 11](https://github.com/loftwah/app-composer-paperwork/pull/11), [custom-domain PR 10](https://github.com/loftwah/app-composer-paperwork/pull/10), [print-shop polish PR 9](https://github.com/loftwah/app-composer-paperwork/pull/9), [PR 1](https://github.com/loftwah/app-composer-paperwork/pull/1), [touch correction PR 3](https://github.com/loftwah/app-composer-paperwork/pull/3), [native-widget rotation PR 4](https://github.com/loftwah/app-composer-paperwork/pull/4), [export safeguards PR 6](https://github.com/loftwah/app-composer-paperwork/pull/6), [native appearance PR 7](https://github.com/loftwah/app-composer-paperwork/pull/7)); reference custom domain `paperwork.loftwah.com`, account `1003dc1d93af0ebea56b2f1252f89627`. Composer's final source, independently promoted navigation pins and active Worker identity are in the single canonical [#11 release receipt](https://github.com/loftwah/app-composer/issues/11). [#264](https://github.com/loftwah/app-composer/issues/264) owns remaining acceptance.

The owner-selected print-shop direction adds charcoal/orange typography and original ink-textured artwork, while keeping the document workspace clear. Phone filenames, explicit unsaved/exported state, pending-field Undo, keyboard help and larger signature resize targets are exercised through the real interface. The downloaded completed PDF remains byte-identical to the independently verified acceptance file below. Composer uses the exact current source for reproduction.

The public address is `https://paperwork.loftwah.com/`. Existing Workers page links move to that address in the browser, preserving their path, query and fragment. Init reproduction removes the reference account and custom-domain routes so copied instances retain their own deployment boundary. The app-local `Cache-Control: no-transform` header prevents Cloudflare JavaScript Detection injection; release verification still requires exact served HTML bytes. Exact active Worker identity belongs in the canonical #11 receipt.

## Actual results

| Journey | Result |
| --- | --- |
| Native field editing | Pass: all 11 supplied field values, including modified prefilled/multiline text, read-only ID, toggled checks, three radio choices and repeated dropdown choices. |
| Mixed annotations | Pass: pen, eraser, undo/redo, text/tick, highlight, imported transparent PNG, movement/resizing and editing the native field afterwards. |
| Rotation and scanned page | Pass: three X/text targets on the 90° page at changed zoom; text/tick/ink/signature on the image-only page. Independent reader finds the text at the intended displayed coordinates. Derived 90° and 270° variants also pass actual browser bounds for every native widget and downloaded field values. |
| Save/reopen | Pass: actual Chrome 155 download, reopened through Paperwork/PDF.js; supplied verifier checks exact values and every target region. Unchanged source fails completed-document acceptance. |
| Independent inspection | Pass: PyMuPDF 1.28.2 and Poppler render the actual downloaded PDF. Media/crop/rotation match; original scanned RGB pixels are identical; PNG alpha mask is exact and the placed image remains inside its target. |
| Print data | Pass: Print prepares exactly the same completed PDF bytes as Save; browser PDF viewer receives that blob. The connected native Print preview showed all four completed pages. MP saved and inspected that print-to-PDF; their font-spacing observation led to the appearance fix below. Physical paper remains unqualified. |
| Phone | Pass: 390×844 touch-enabled WebKit, native field editing, pen touch, undo/redo, signature placement, both themes, no horizontal document overflow and actual exported field value. A native Chromium touch regression also passes continuous ink, Select scrolling without added ink, two-finger zoom and PNG signature movement/resizing. Physical iPhone/stylus/IME remain unexercised. |
| Failure recovery | Pass: encrypted and truncated fixtures produce helpful errors while retaining an unrelated unsaved answer. Unsupported glyph and out-of-page addition exports fail with edits intact. Further edits remove the previous print copy; edits during asynchronous export prevent an outdated snapshot from being offered. |
| Privacy | Pass: no external HTTP requests or document/signature uploads through the served open/edit/sign/save/print journey; localStorage/sessionStorage/IndexedDB remain empty. Browser-internal Chrome PDF-viewer assets are local, not network egress. |
| Separate connected Chrome review | Pass for built-in lab sample editing, native dropdown, page/zoom, real mouse ink, undo/redo and actual downloaded native values. PNG file selection was unavailable because the extension's Allow access to file URLs permission is disabled. Full file/PNG workflows passed in the automated Chrome and WebKit sessions. Initial native OS inspection was unavailable while the Mac was locked; later the actual four-page completed export was opened in Chrome’s native Save-as-PDF preview and saved by MP. |
| Reproduction | Pass: the existing Init command copies the exact reviewed source into an absent owned directory, applies title/introduction/theme, retains source metadata and cleans up its test copy. It performs no install or deployment and does not alter existing drafts. |

The critical live download SHA-256 is `2b81ccd7dcdb61baabb8e4f5158c0cdaa245c4dbb343effa7c7ec3750b36db3b`. The public completed fictional PDF is that exact file. Its print copy has the same hash.

The unchanged owner pack lives under `tests/fixtures/paperwork-fixtures/` in the independent app, including README, generator, expectations, verifier, signature and negative files. Its distributed hashes pass. The intended list widget in this pack is actually encoded with the PDF Combo flag; it was tested unchanged. A genuine multi-select list is exercised with the smaller garden fixture.

## Fixes discovered during delivery

- Mobile signature drags could become native page pans and be cancelled. The SVG root now owns object touch gestures while blank-page scrolling remains available; the native-touch regression is committed in the independent app.
- MP’s actual print-to-PDF exposed oversized multiline comments and dropdown text: pdf-lib read escaped literal appearance settings without decoding them, auto-sizing 11 pt comments to 26 pt. Changed fields now preserve the decoded appearance bytes, original font size and colour. The regression checks the exact saved sizes and first-line baseline; fresh independent rendering shows the text near the top without the unintended gap.
- Native fields on 90°/270° pages used swapped CSS translation dimensions. Every widget now matches its PDF viewport bounds, with a browser/download regression for both rotations.
- Image resizing could extend below the page, and a long text addition could be clipped during export. Aspect-preserving image sizing now respects both page dimensions; export refuses additions outside the page without discarding edits.
- Edits could leave an older print copy available or race with an asynchronous export. Output is invalidated on mutation and the exported snapshot must still match current state before publication.
- Read-only fields rendered both their original appearance and an HTML value; the overlay now masks the duplicate.
- Segment-by-segment PDF highlighter strokes darkened at joins; each stroke is now one continuous translucent path, with a focused serialized-stroke regression.
- Action stripping assumed every dictionary's `A`/`Names` entries were action dictionaries. The focused regression now preserves unrelated keys and destination arrays while disabling actual action dictionaries.
- Automation's ambiguous page-label/value matching was corrected with explicit option values. This was a harness failure, not a page-navigation defect.

## Unsupported and unexercised

XFA, encrypted and already certificate-signed documents are deliberately refused. No certificate signing, OCR, AI processing or cloud document storage is offered. The bundled font supports Latin/extended Latin; unsupported characters produce a save error. Added objects remain individually editable during the current session and become ordinary page content in the exported file; native fields remain editable on reopening.

Genuine XFA/certificate fixtures, physical iPhone/stylus input, assistive-technology acceptance, physical paper and an unfamiliar human completing the whole form remain separate gates. No failing exported-field or geometry check remains in the exercised corpus.

`pnpm check`, build and audit pass in Paperwork. Composer and independent launcher releases use their existing clean pushed-main guards. Bounded run evidence stays in ignored `output/live/` (Paperwork) and `output/paperwork/` (Composer); temporary verification dependencies, reproduction copies and independent release clones are removed. No new QA service, GitHub Actions, account, paid SDK or document backend was added.
