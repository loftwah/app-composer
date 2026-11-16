# First real Bluesky posts — 17 November 2026

Two posts went live on the owner account `@loftwah.com` in the same session. They
prove different things and are recorded separately.

## 1. Real portfolio post — assisted route

- **Post:** https://bsky.app/profile/loftwah.com/post/3n2goytaw322y
- **Published:** 2026/11/17 01:03 AEDT · 2026/11/16 14:03 UTC
- **Account:** Loftwah `@loftwah.com` (`did:plc:axc7…`), verified in the signed-in
  browser before publishing.
- **Route:** assisted publishing in the owner's signed-in Chrome. This is *not*
  the Composer adapter and must not be read as integrated scheduling.
- **Source:** “Foilbury · Pippa in the lantern garden”,
  https://media.loftwah.com/p/9UX85ricWNKOeA96 — an illustration from the
  Foilbury card world, animated in the independently owned Media Studio.
- **Attached image:** the page poster, converted from a 1008 × 1792 PNG to a
  787 × 1400 JPEG (337,008 bytes, SHA-256
  `9dcc9d03308a432f89eb2ec6920b60e1f051f6f2fd1b327d3d3d3802e18b193e`).
- **Alt text as published:** “Painted poster: a black Labrador–Staffordshire
  cross sits in a moonlit garden under a crescent moon, lit by hanging lanterns
  among purple foliage and pale flowers. Cream lettering at the top reads PIPPA,
  with FOILBURY beneath.”
- **Verified from the public AppView:** text, image embed, alt text and the link
  facet (`https://media.loftwah.com/p/9UX85ricWNKOeA96`) all match the approved
  copy. The composer preview and the live permalink are captured in
  `output/overnight-20261117/`.

Credits in the post copy: original artwork Woodhouse, GPT Image 2.6 via Fal;
motion in Media Studio, MiniMax H3 Max Turbo; 5.2 s. No adoption, reach or
engagement claim is made from a single post.

## 2. Integrated post — Composer Share calendar → Bluesky

- **Post:** https://bsky.app/profile/loftwah.com/post/art2vwvg2vr75
- **Published:** 2026/11/17 01:30 AEDT · 2026/11/16 14:30 UTC
- **AT URI:** `at://did:plc:axc7n2yjep6ggdz7fuztluc4/app.bsky.feed.post/art2vwvg2vr75`
- **CID:** `bafyreifciui6dfvc6zgfm7m6o5da4iuwma7qevoygrvginh4c57f67b6mm`
- **Approval:** share item `Fictional Trail Notes` (published revision 30),
  approval revision 2, binding `7025af05…`, intended
  2026/11/17 01:28 AEDT · 2026/11/16 14:28 UTC.
- **Delivery:** attempt 1, terminal state `published`, receipt written by
  Composer. The approved content was an external link card to
  https://composer.loftwah.com/s/fictional-trail-notes.
- **Route:** the owner calendar at
  `/_emdash/admin/plugins/composer-stacks/share-calendar` with the encrypted
  Bluesky app-password connection. Nothing posted automatically; the send ran
  only after the exact approval and the explicit “I reviewed…” confirmation.

### Defect found and fixed by the first attempt

The first send (approval revision 1) reached the provider and was rejected:
`InvalidRequest — Invalid record key for app.bsky.feed.post: Invalid TID string
format`. Composer derived the deterministic record key as a 32-character digest,
which passes the generic record-key syntax but is not a Bluesky TID.

- Fix: `95a067f7328dfdc5eaeff123f17fc57e604e9c1b` maps the same
  `item + approval revision` input onto a 63-bit TID using the documented
  `234567abcdefghijklmnopqrstuvwxyz` alphabet, so retry and reconciliation still
  target one exact record. Provider behaviour was reproduced and confirmed with
  a short-lived app password that was revoked immediately; the probe record was
  deleted.
- UI fix: `301e149bc5b0172ee59fbfb08298efc2a61be56e` advances the calendar clock
  while the tab is visible, so a page left open across the intended time no
  longer needs a reload before Send enables.
- Live identity after both releases: Composer
  `301e149bc5b0172ee59fbfb08298efc2a61be56e`.

## What is still missing

- The Bluesky attachment is the generated stack share card. An owner cannot yet
  bind an arbitrary approved project image with its own alt text to the
  approval, which is why the real portfolio post used the assisted route.
- The customer “connect your social accounts” invitation link, Instagram, the
  Facebook Page and LinkedIn remain owner/provider work. X stays export-only.
- Engagement or reach claims need a later, deliberate measurement window; this
  record only proves publication.
