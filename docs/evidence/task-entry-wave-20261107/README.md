# Admin task-first wave — Creator stacks, Orders and Private enquiries

Scoped #313 delivery for three existing native EmDash admin pages. Each page now
opens with one current state and an action the page already supported. No new
API, record, permission, persistence, publication or execution path was added.
The parent epic remains open.

## Release identity

| Item | Value |
| --- | --- |
| Source | `22b220075999d0a0730ebffba63c1b57b9381b79` |
| Worker version | `2721ef50-a2bf-4108-b319-f64ec95410f7` |
| Origin | `https://composer.loftwah.com` |
| Release path | clean pushed `main` → `pnpm deploy` |
| Live `/build.json` | `22b220075999d0a0730ebffba63c1b57b9381b79` |
| Stack status | deployed source `22b220075999` |

The first code change was at `2026-11-07T13:55:54+11:00`. The final live check
finished at `2026-11-07T03:15:47Z`, about 20 minutes end to end. Two deploys
were needed: the first shipped the three leads, then live 390px inspection moved
the Creator stacks explanation below its lead and corrected the Orders state
copy. The second deploy carried only those presentation corrections. The full
check, build, remote migrations, upload and live gates consumed the longest
single stage (about 4 minutes); the rest was implementation and live viewport
inspection.

## What changed

### Creator stacks

- No stack: the existing name field and **Create stack** action lead. The
  separate create form is not duplicated.
- Governed workspace: the existing application-request link leads; the detailed
  governed explanation follows.
- Viewer or archived stack: the existing read-only state leads. A published
  read-only stack can still **Open public page**.
- Unsaved edits: **Save draft** leads, using the existing editor action and
  saved revision. Nothing is auto-saved or discarded.
- Saved draft: its saved and public revision state leads, with the existing
  **Publish** control when the role may publish.
- Published: its public revision leads with the existing **Open public page**
  destination.
- The long page explanation, Workspace access link, editor, preview and
  publication history follow the lead. Workspace, role and creator/governed mode
  stay above it.

### Orders

- The selected order, amount, provider, fulfilment, payment state and fictional
  evidence scope lead.
- An uncertain checkout action leads with the existing
  **Reconcile existing fixture action** and retained-actions link.
- A failed or uncertain fulfilment has no supported replay in the existing
  contract, so it leads with **Review retained actions** instead of inventing a
  second reconcile call.
- Pending or unpaid payment leads with **Inspect payment state** and the
  retained state; no payment action is offered.
- A paid Composer–Printful order still awaiting fulfilment leads with the
  existing **Prepare fictional Printful draft** action.
- Other paid/refunded fixture orders lead to the existing fixture controls.
- The fictional-lab boundary, links, Shopify catalogue, create form, filters,
  list, detail, fixture controls and history follow the lead.

### Private enquiries

- The first ready visitor book and its latest pending brief lead with the
  existing review state and an **Open review** link to the existing journey
  panel.
- With no pending brief, the page leads with the honest no-pending state; with
  no ready visitor book it leads to the existing Creator stacks setup path; a
  viewer sees the existing read-only state.
- The lead carries only the brief title already shown in the inbox list. No
  brief body, contact field or visitor identity enters a URL, notice or this
  evidence. The title itself is not recorded here.
- Filters, setup controls, list, journey panel, summary and form controls follow.
  Nothing is marked reviewed automatically.

The selection helpers are `src/lib/stacks-lead.ts`, `src/lib/orders-lead.ts` and
`src/lib/enquiries-lead.ts`. The pages reuse their existing `ca-*`, `or-*` and
`ce-*` styles and host theme tokens.

## Live verification

Measured in the authenticated Cloudflare Access owner session (`dean`, owner),
after the final deploy, by switching theme with the native admin theme button.
Positions are viewport pixels from the top. Theme was confirmed by the computed
body background. Every viewport reported `scrollWidth` equal to the viewport
width, so there is no horizontal overflow.

| Page | Viewport | Theme | Lead top → bottom | Title top | Action top → bottom | Meta top → bottom | Next content top | First viewport |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Creator stacks | 1440 × 1000 | light | 251 → 565 | 297 | 407 → 456 | 522 → 544 | 724 (editor) | yes |
| Creator stacks | 1440 × 1000 | dark | 251 → 565 | 297 | 407 → 456 | 522 → 544 | 724 (editor) | yes |
| Creator stacks | 390 × 844 | light | 341 → 754 | 383 | 552 → 601 | 690 → 737 | 988 (editor) | yes |
| Creator stacks | 390 × 844 | dark | 341 → 754 | 383 | 552 → 601 | 690 → 737 | 988 (editor) | yes |
| Orders | 1440 × 1000 | light | 302 → 638 | 365 | 476 → 524 | 573 → 617 | 660 (fictional-lab note) | yes |
| Orders | 1440 × 1000 | dark | 302 → 638 | 365 | 476 → 524 | 573 → 617 | 660 (fictional-lab note) | yes |
| Orders | 390 × 844 | light | 400 → 880 | 460 | 650 → 699 | 797 → 863 | 902 (fictional-lab note) | yes |
| Orders | 390 × 844 | dark | 400 → 880 | 460 | 650 → 699 | 797 → 863 | 902 (fictional-lab note) | yes |
| Private enquiries | 1440 × 1000 | light | 354 → 589 | 399 | none (no pending brief) | 545 → 568 | 617 (filters) | yes |
| Private enquiries | 1440 × 1000 | dark | 354 → 589 | 399 | none (no pending brief) | 545 → 568 | 617 (filters) | yes |
| Private enquiries | 390 × 844 | light | 435 → 812 | 477 | none (no pending brief) | 707 → 795 | 840 (filters) | yes |
| Private enquiries | 390 × 844 | dark | 435 → 812 | 477 | none (no pending brief) | 707 → 795 | 840 (filters) | yes |

The Orders dark 1440 capture used the collapsed navigation rail retained from
the phone resize; the light 1440 capture used the expanded sidebar. Both are
valid 1440 layouts and neither overflowed.

Keyboard focus moved from the page's Refresh control to the lead action with one
`Tab` on Creator stacks and Orders. On Private enquiries, `Tab` from **Refresh
inbox** reached **Export private inbox** because the live lead had no pending
action. Focus outlines were `2px solid rgb(199, 68, 0)` with `3px` offset in
light and `2px solid rgb(252, 91, 5)` with `3px` offset in dark.

The only console error was the existing Cloudflare Insights beacon blocked by
the admin Content Security Policy. No page API request failed.

Captures: [stacks 1440 light](stacks-1440-light.png) ·
[stacks 1440 dark](stacks-1440-dark.png) ·
[stacks 390 light](stacks-390-light.png) ·
[stacks 390 dark](stacks-390-dark.png) ·
[orders 1440 light](orders-1440-light.png) ·
[orders 1440 dark](orders-1440-dark.png) ·
[orders 390 light](orders-390-light.png) ·
[orders 390 dark](orders-390-dark.png) ·
[enquiries 1440 light](enquiries-1440-light.png) ·
[enquiries 1440 dark](enquiries-1440-dark.png) ·
[enquiries 390 light](enquiries-390-light.png) ·
[enquiries 390 dark](enquiries-390-dark.png). Exact measurements and capture
hashes are in [`metrics.json`](metrics.json).

## Live state observed

- Creator stacks: **Fictional Trail Notes**, owner, creator workspace, saved
  revision 20, public revision 11, published. The lead action opened the existing
  `/s/fictional-trail-notes` destination. No save or publish action was run.
- Orders: one fictional Stripe reading-club order, refunded/draft, account
  `1003dc1d…`, production installation. The lead linked to the existing fixture
  controls. No fixture observation or reconciliation was run.
- Private enquiries: first ready book **Here / there**, owner, production,
  account `1003dc1d…`. It had no pending brief. The summary showed no retained
  brief for that book; the second ready book also had no pending brief. The lead
  therefore exercised the existing no-pending path live. The pending-brief and
  **Open review** branches are covered by the focused selector tests. No brief
  was created, opened, reviewed or exported, and no private brief text appears in
  this evidence.

## Checks and remaining gates

- `pnpm check:fast -- tests/stacks-route.test.mjs tests/workspace-access.test.mjs tests/private-enquiries.test.mjs tests/admin-task-entry-wave.test.mjs` passed.
- `pnpm deploy` ran `pnpm check` once: 451 passed, 0 failed, 0 skipped.
- Publication guard: 1,290 files and 150 archive members inspected.
- Live source, pinned services, sharing output, publication privacy and the
  anonymous administration boundary passed.
- `/build.json` and Stack status matched `22b220075999`.
- The added selector tests cover create, governed, viewer, archived, unsaved,
  draft, published, uncertain/failed order operation, pending payment,
  fulfilment, observation, pending brief, pending-elsewhere and setup states.
  They also assert that brief body text cannot pass through the lead object.

This is three scoped admin journeys. It does not close #313 or claim
screen-reader, physical-device, browser zoom/reflow or every-admin-page
acceptance. It changes no workflow, order, enquiry, stack or publication record.
Guestbook release, composition promotion and the #412 mutation remain separate
work.
