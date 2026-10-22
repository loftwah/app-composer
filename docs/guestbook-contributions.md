# Guestbook contributions from Linkarooie

Reviewed 22 October 2026. This is the shared explanation for the versioned contribution invitation used by Here / there and Linkarooie. The [build story](/building) demonstrates it with a local fictional run.

## The two jobs

- **Guestbook owns the note.** A visitor sends a short text postcard, which becomes a pending private record with a generated PNG. The owner can approve, hide, reject or delete it. Guestbook owns submission limits, media and revocation.
- **Linkarooie owns curation.** The profile may link one exact Guestbook resource. It can offer the real contribution form, explain that postcards are closed or paused, and separately feature a currently approved note. Featuring never publishes a pending note and never copies its text or media into Linkarooie.

A visitor note, an approved Guestbook item and a featured Linkarooie card are three different states. The interface says so in plain language.

## Versioned contract

Guestbook's `app.manifest.json` declares `guestInvitation` version 1. The public endpoint is:

```text
GET /r/:resource/api/invitation
```

It returns the current active configuration, `open | paused | closed | full`, `accepts`, the exact contribution and collection paths, and the supported limits (160-character message, 60-character alias, 1200 × 900 PNG up to 100,000 bytes). It never returns the guest code, owner credential, submission text or media.

`full` covers the 16-pending queue or 200 non-deleted item cap. The same state controls the Guestbook's own `/contribute` page, so a form is not shown when acceptance would immediately fail. Hiding the resource makes the endpoint unavailable (404).

Linkarooie checks this response through its configured `ITEM_PROVIDER` service binding. A malformed, redirected, foreign-origin or partial response becomes `unavailable`; it never becomes `open`. The saved reference is the exact resource and activated configuration selected by the owner. Acceptance follows that resource's current active configuration, so a reviewable configuration advance does not break the link.

## Stale owner tabs

The owner studio and the native collection control send the exact invitation setting they observed. Stopping or replacing is a conditional write against that setting: if another tab already changed it, the request returns a conflict and the newer choice survives. The owner sees a plain reload message. A missing expected setting is refused rather than treated as “stop whatever is current.” This is an expected-state guard, not a second permission system; the app still owns the record and the native owner authentication still applies.

## Owner controls

The native Composer **Collect from a saved visitor book** control reads the current state for the selected stack instance. It can link that exact book for contributions, replace the reference or stop inviting. Enabling is refused for a hidden or pending visitor book. The standalone Linkarooie studio exposes the same `GET/POST /api/invitation` boundary when the Composer studio is not configured.

The Linkarooie collection export includes the saved `guestbookInvitation` reference. Profile-settings portability deliberately does not: that file covers presentation fields, not app connections. Guestbook moderation, configurations and media remain in Guestbook.

## Public behaviour

- **Open:** a **Leave a note** panel links the Guestbook's real form. The form states that the owner shares the guest code separately and that the note stays private until approval.
- **Paused, closed or full:** the panel explains the state and keeps a link to approved notes. No send action is rendered.
- **Unavailable:** a quiet explanation is shown; no dead form or media link is rendered.
- **No linked source:** no contribution panel is shown.

## Verification and limits

The local fictional run exercised submission → pending → owner approval → explicit feature → hide at source. Hiding returned 404 for the item API and media and removed the card on the next Linkarooie render. Closing the Guestbook removed the send action while keeping the approved-note link.

This does not provide a public comment thread, photo uploads from the Linkarooie CTA, automatic featuring, notifications, replies, guest accounts, owner credential recovery or a general multi-tenant contribution service. A hosted deployment and the live owner configuration have their own evidence in Composer #11. The local run does not prove a production Cloudflare deployment.
