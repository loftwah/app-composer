# Hosted Linkarooie contribution journey — 7 November 2026

Scoped [#196](https://github.com/loftwah/app-composer/issues/196) hosted proof. The
remaining gate was a configured contribution journey on the owner's live
profile. This now exercised the actual authenticated owner session in Chrome:

**visitor profile → permitted Guestbook contribution → pending receipt → owner
review/approval → explicit feature on Linkarooie → source hide/revocation.**

No fixture, mock form or direct database write was used. The submissions,
approval, feature and revocation all went through the apps' supported owner and
public APIs.

## Live identities

| Surface | Revision |
| --- | --- |
| App Composer | `bbe9e2246a853b37904ae22a55350f3d2ad3cf43` / Worker `4c2683dd` |
| Guestbook | `e668c84cf45c8a16ba36015c7bce13c014cf3a38` / Worker `68cc5da7` |
| Linkarooie | `131fe0144e1690bd68e95be8330cdcd9059d3b3f` / Worker `583f07ac` |

The owner session is the existing Cloudflare Access-protected Composer admin.
The stack is **Fictional Trail Notes** (workspace `dean`), visitor book
`2056b6dd-bd53-4fe0-afeb-d2985cd417c4`, configuration 1.

## What happened

1. The live Linkarooie page at https://composer.loftwah.com/showcase/ rendered
   the **Leave a note** contribution action with the real Guestbook href:
   `/guestbook/r/2056b6dd-bd53-4fe0-afeb-d2985cd417c4/c/1/contribute`.
2. The fictional postcard submitted for #412 was already a private pending
   resource item. It was approved in the native Composer **Manage saved visitor
   book content** review surface, which lists pending/approved/hidden items and
   calls the app-owned resource moderation API.
3. The approved item was explicitly featured in Linkarooie through **Collect
   from a saved visitor book → Feature approved contribution**. Linkarooie saved
   the exact source reference:
   `2056b6dd-bd53-4fe0-afeb-d2985cd417c4 / c/1 / 926163b2-2f41-40eb-a99d-141075c94e61`
   and saved card `c978bb77-9853-4a4b-ae16-bf00b5fb95c7`.
4. The live Linkarooie page then rendered the featured capability-proof postcard
   with its source item link.
5. The **Use this Guestbook for contributions** action linked the same visitor
   book for intake. The live page now showed **Leave a note** with an open
   invitation state.
6. The owner **hid** the postcard at source in the Guestbook review surface. The
   next public requests removed it from Linkarooie and from the Guestbook
   resource collection; its media and detail routes returned `404`. The
   contribution action stayed live and open.

The deliberate end state is **hidden/private**, not publicly featured. The
screenshots retain the featured state for evidence; the profile is left clean.
This also proves that hiding at source revokes the Linkarooie presentation
without deleting the app-owned record.

## Checks

- Linkarooie live page contained the capability-proof card and the real
  `contribute` href while featured.
- Guestbook resource collection after hide: `items: []`.
- Guestbook media after hide: `404` (`This image is unavailable.`).
- Guestbook item detail after hide: `404` (`This contribution is not public.`).
- Linkarooie live page after hide: no capability-proof card; **Leave a note**
  remains.

## Evidence

- `linkarooie-featured-1440.jpg` and `linkarooie-featured-390.png`: live profile
  with the featured card and contribution action.
- `linkarooie-revoked-1440.jpg` and `linkarooie-revoked-390.png`: live profile
  after source hide; card gone, action remains.
- `stack-content-review-1440.jpg`: native review surface with the pending/approved
  and hidden records, including the app-owned moderation controls.

Physical-device, screen-reader and native software-keyboard acceptance remain
separate. This receipt closes the hosted configured journey gate for #196.
