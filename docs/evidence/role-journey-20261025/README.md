# Role-pack and setup-guide surfaces — local render, 25 October 2026

Bounded visual evidence for the pages this lane changed: the [role-pack hub](/roles), one [role pack](/roles/qa) and the [project setup guide](/setup). Captured from a local Astro render of `86514680720702ce30157671652981e388b77f65` plus this branch's changes. No production deployment is claimed.

## How to reproduce

```sh
pnpm dev                      # local render; the dev script now generates src/lib/build.json first
node docs/evidence/role-journey-20261025/capture.mjs
```

`JOURNEY_ORIGIN` changes the origin (default `http://127.0.0.1:4377`). The script writes the images and `receipt.json` beside itself and exits non-zero if any layout or interaction check fails.

## What it exercised

- `/roles`, `/roles/qa` and `/setup` at **1440×1000** and **390×844**, dark and light.
- 24 images: a fold capture plus a full-page capture for each page and viewport.
- Horizontal overflow at document and body level, and every element whose box crossed the viewport edge.
- Console errors and failed requests; favicon 404s are separated out.
- Keyboard tab order from the top of `/roles` — the first fourteen stops, their outline style and width.
- “Copy prompt” on `/roles/qa`, with the clipboard read back and compared.
- The new in-page index on `/roles/qa`, checking that `#tests-title` lands on the negative-tests heading.
- Switching `/setup` to “New project”, the guide regenerating, the browser draft restoring after a reload, and “Copy setup guide” putting the whole guide on the clipboard.
- The theme control changing `data-theme`, persisting to storage and surviving a reload.

## Result

`receipt.json`: **24 captures, 18 checks, 0 problems**. No horizontal overflow at either width; no console errors beyond favicon requests; every interaction did what the page claims.

## Pixels reviewed, and the two fixes

I read the captures back at full size rather than trusting the measurements:

- **Role hub, desktop and phone, both themes.** The new proof strip (5 fresh-agent runs · 42 of 42 assertions · 0 human interventions) sat directly under the download action and read clearly. The first version put its two links inside the explanatory sentence, so “Read the evaluation” wrapped between the two words and read as a broken heading. The links now sit on their own 44px row. The phone fold ends on the third proof number, which is a deliberate stopping point rather than a cut-off sentence.
- **Role pack detail, desktop and phone.** The new index row (`The job · Inputs · Evidence · Returns · Worked example · Negative tests · Prompt`) removes most of the scrolling between the heading and a specific section. Its first version used 36px targets on the phone; they are now 44px, matching the rest of the site's touch targets.
- **Setup, desktop and phone, both themes.** The “Other paths” line added for the resume observation read “Interrupted setup: 1 recorded…”, a double colon after the bold label. It now uses an em dash and a middle dot between entries. The rest of the page, including the guide textarea and the recorded-trials block, needed no change.
- **Both themes.** The new proof labels use the existing muted colour and Space numerals; no new colour, gradient or illustration was introduced. Light-mode contrast was inspected in the exported pixels, not inferred.

## Boundaries

Same-origin local render only. The owner admin is behind Cloudflare Access and **no owner session was opened** — no authenticated screenshot is claimed here and none should be inferred. Browser emulation at 390px is not a physical phone, and no screen reader or native share sheet was exercised. The images show the pages this lane changed; they are not a review of the whole product.
