# Creator Hub native admin — 12 November 2026

Production is Composer `c100530eed8661ff6874e1cd9b2cd83a53181a49`, Worker
`f1f4a87d-0d39-4904-9326-c50b5c9c6f79`; `/build.json` matches.

The native EmDash panel now manages the Creator Hub reference pair as a separate
deployment from the original operator pair. The owner switches to **Creator Hub
reference** in **Manage mini-apps**; each app keeps its own Worker, D1 database,
Here / there R2 bucket, owner credential and reviewed source pin.

- Admin: `https://composer.loftwah.com/_emdash/admin/plugins/composer-miniapps/apps?site=creator-hub`
  (invited Composer administrator; Cloudflare Access sign-in required).
- Here / there: `https://creator-hub-guestbook.loftwah.com`, source
  `https://github.com/loftwah/creator-hub-guestbook` at
  `36797b8028682460c33fe092682bfbd63751ec1a`.
- Linkarooie: `https://creator-hub.loftwah.com`, source
  `https://github.com/loftwah/creator-hub-showcase` at
  `b7cd3b3e8f19dbbb76d33fb4266053da928cf586`.

## Observed native-admin path

A fictional guest sent a postcard through the public form. It appeared as
**Pending** in the panel. The owner approved it, and the same postcard became
public in Here / there and appeared in Linkarooie. The owner hid it again in the
panel; both public pages stopped serving it, and its item and media routes
returned `404`. The postcard was left hidden, so the public collection is clean.
The same hidden record was approved and hidden a second time on the final
`c100530` release to verify the deployed source, not an earlier candidate.

The panel previews both the approved Jules postcard and the hidden test postcard
as decoded images. The first release had a real defect: the preview request
omitted the selected deployment, so it asked the operator Guestbook for the
reference item. The follow-up release passes the site through, and the live panel
rendered two canvases with zero “Preview unavailable” messages.

## Checks

- `node --test tests/miniapp-reference-admin.test.mjs tests/miniapp-boundaries.test.mjs tests/promotion-boundary.test.mjs tests/collection-journal.test.mjs`
  passed on the candidate.
- `pnpm check:types` passed; the guarded `pnpm run deploy` ran the full check and
  production build once per release, applied no migration, uploaded the Worker
  and passed the live source, pinned-service, sharing, publication-privacy and
  anonymous-administration gates.
- `pnpm run deploy --miniapp-secrets` installed the two reference owner tokens
  once; later releases reused the existing Worker secrets.
- The deployed Worker lists `CREATOR_HUB_GUESTBOOK` and `CREATOR_HUB_SHOWCASE`
  service bindings. Preview still has no service bindings.

## Impeccable workflow

Resolved `/Users/deanlofts/.claude/skills/impeccable/SKILL.md`, ran its context
launcher for `src/plugins/miniapps-admin.tsx`, loaded the Operate playbook and
read the craft floor before editing. After the UI change the mechanical detector
reported one pre-existing `side-tab` warning in `miniapps-admin.css` line 14
(`.ca-invitation`); it is not part of this change.

## Rendered evidence

Captured at 1440 × 1000 and 390 × 844 in both themes. The admin had no horizontal
overflow at 390px; the document width equalled the viewport. Keyboard Tab stops
showed a visible 2–3px focus outline.

- `admin-desktop-dark.png`
- `admin-review-desktop-light.png`
- `admin-review-phone-dark.png`
- `admin-top-phone-light.png`
- `featured-desktop.png` — the featured postcard in Linkarooie before revocation
- `case-desktop-dark.png`
- `case-phone-light.png`

## Remaining limits

Both reference apps run in the operator's Cloudflare account and on the
operator's domain. This is not customer-owned onboarding, and no external
non-technical participant has run the journey. The panel proves review, approval,
hiding and featuring; it does not expose contribution deletion. Saved
visitor-book collection controls remain on the operator pair. The described
follow-up app change, source update/refusal and recovery, Fungi/Oyster,
Cloudflare-extension entry, video and participant validation remain open.
