# Continuous train — 16 November 2026

Two working checkpoints from the same session. Both were played in the signed-in
owner browser (Composer workspace `dean`), not reconstructed from source.

## Released sources

| App | Source | Worker | Release |
| --- | --- | --- | --- |
| Media Studio | `2548f3c4c2104fc7422c9d5ed513fd29aa8d6549` | `2f548d23-fd67-4efb-94ca-d2e2d930e3c1` | 34.7 s |
| Media Studio | `4a2f981dce69` | `95b5ccbc-f09d-49f6-8a55-02c1203ef49e` | 23.2 s |
| App Composer | `4eb753d489f272ceb1350d3e717099812b9ecdcf` | `475e875a-77c7-4314-b80c-1b0702babdad` | 95.2 s |

Every release used the repository's own clean pushed-main guard. No new release
gate, service or credential was added.

## Checkpoint 1 — the public gallery got 97% lighter

`/gallery` page 1 used to download the full original for every image and a large
parent still for every film. The same 15 published works now request a stored,
regenerable preview:

| | Bytes for the same 15 works |
| --- | --- |
| Before (full originals and parent posters) | 27,390,952 |
| After (`/p/:slug/thumb`) | 743,858 |
| Reduction | **97.3%** |

The largest new preview is 94,718 bytes; the one published still that used to
serve 526,848 bytes now serves 13,480. Films show a real poster frame instead of
a “Watch” placeholder. A newly published cut's preview was 28,542 bytes.

The derivative is not an asset row: it never appears in the library, never
enters the portable bundle, and withdrawal stops `/p/:slug/thumb` with the page.
Existing publications were filled by **Publish → Make public previews faster**,
which only fills gaps and is safe to rerun. The measured page is
[the public gallery](https://media.loftwah.com/gallery).

Evidence: `gallery-after-1440.png`, `gallery-after-390.png`. 390 px had no
horizontal overflow. A 390 px and a 1440 px pass were inspected; Safari itself
was not available in this run.

## Checkpoint 2 — the loop a person can play

### App Composer: change, save, reopen, publish

1. Opened **Creator stacks** in the native EmDash admin as workspace `dean`
   (owner). Resumed **Fictional Trail Notes**, a fictional, rights-cleared demo
   stack.
2. Renamed the visitor-book instance **Trail postcards → Leave a postcard** and
   the shared view **Shared trail view → See approved postcards**, with captions
   that explain approval. Saved draft revision 25.
3. Reloaded the editor: both saved values were still there (reopen).
4. Publishing was refused with “Another window changed this stack”. The real
   cause was a Guestbook confirmed against different app settings; **Save and
   apply app settings** cleared it and the stack published revision 30.
5. The public page shows both new labels:
   <https://composer.loftwah.com/s/fictional-trail-notes>.

The refused step was a real product defect: the conflict panel named a window
that did not exist and offered a reload that would discard the edit. It now
names the app-confirmation cause and offers **Apply app settings**. Composer
`4eb753d`.

Evidence: `trail-before-1440.png`, `trail-after-1440.png`.

### Media Studio: edit, review, revise, prepare to share

The source was Foilbury's approved Pippa cabinet portrait and its saved clip.

1. **Cut 1.** Clipped 0.4–4.6 s of the saved clip to 9:16, 720 × 1280, filled
   the frame and exported on-device, then explicitly imported it into
   *Foilbury · Creative studies*: asset `asset_ad846a5481cc40fb8ed6412dce6164b2`,
   4.223 s, 1,902,672 bytes, SHA-256 `fe0df4eb…`.
2. **Private review.** Created room `rev_3cfc1d28…` pinned to that hash. As the
   reviewer (“Mara Quinn · reviewer”), left a timecoded note at **0:01.2** about
   the crop crowding the dog's ear, then recorded **Request changes** with a
   note to trim the head by 0.2 s.
3. **Cut 2.** Re-cut 0.6–4.6 s, same 9:16 HD frame: asset
   `asset_5b525cbd3a484958b6f76312e3790f30`, 4.031 s, 1,721,269 bytes, SHA-256
   `6a6f246f…`. A second room (`rev_d166eec9…`) was approved for that version.
4. **Prepare to share.** Published that exact asset:
   <https://media.loftwah.com/p/oCE3jwInl-G55yXf>. Page 200, media 200 with
   byte ranges (206 for `Range: bytes=0-99`), preview 28,542 bytes.
5. Cut 1, its room and its change request remain unchanged.

Evidence: `review-room-1440.png`.

### The chooser lands on evidence

**Compare models** in Foilbury opened on “A still image” and said there was
nothing to compare, although the project holds three motion models. It now
reads the project's saved takes once and lands on the first job with a pair.
Reopened live: it lands on **Motion from a still** with a take, and an explicit
`?job=` still wins. Studio `4a2f981`.

Evidence: `compare-motion-after-1440.png`.

### The tutorial follows the same path

<https://composer.loftwah.com/media-studio/tutorial> now has chapters for the
private review, the second cut and share preparation, project recovery, and the
model chooser, plus a **Play this now** list that opens the gallery, the
approved cut, the chooser and a published Composer stack. It states the measured
gallery numbers and the honest gate on recovery. Evidence:
`tutorial-top-1440.png`, `tutorial-revise-390.png` (390 px, no overflow).

## Boundaries kept

- The owner-held master, alternate cuts and prior recordings were not edited,
  published or deleted. Nothing named master-v4 is referenced here.
- Review approval is still feedback, not publish permission. Publishing remains
  a separate deliberate action.
- Portable project export needs the **standalone owner passphrase**; a Composer
  bridge session is refused by design. Export/inspection are validated; restore
  to a genuinely fresh D1/R2 target remains Studio #157 and was not attempted
  because that target and the passphrase are owner-held.
- Cloudflare Image Resizing is not enabled on this zone (`/cdn-cgi/image/…`
  returns 404). Previews are captured in the owner's browser and stored in the
  studio's own R2, so no transformation service or new cost was introduced.
- Safari, a physical phone, screen readers and provider-reported invoices were
  not exercised in this run.

## Checks

- Studio: `pnpm check` — 392 tests pass, 0 fail (`2548f3c` then `4a2f981`).
- Composer: `pnpm check:types` — 0 errors, 0 warnings; `deploy` ran the
  repository's existing check/build/privacy gates once (95.2 s total).
- Live: `/p/oCE3jwInl-G55yXf` page/media/thumb/range; gallery bytes; both
  tutorial widths; `/s/fictional-trail-notes` labels; `/compare` landing job.

## Checkpoint 3 — the postcard actions say what they do

Fresh-visitor check in a browser profile with no owner session.

| App | Source | Worker |
| --- | --- | --- |
| Linkarooie reference (`creator-hub-showcase`) | `3d343e6cb424b1927f4a4485006f52b6f2913b89` | `358beafb-ef07-4373-9fff-ccc3f34ea0d3` |
| Here / there reference (`creator-hub-guestbook`) | unchanged | unchanged |

The profile jump link **Guestbook postcards** is now **Leave a postcard**, with a
separate **See approved postcards** link. Both point at the same moderated
guestbook: `…/contribute` and the collection at the guestbook origin. The
guestbook app already used “Leave a postcard” for its own action, so only the
profile wording and the missing read path changed.

Checked signed out: the profile renders both links with those exact
destinations; the collection shows its approved item and a “Know the guest
code? Leave a postcard” path; `/contribute` shows **Leave a postcard.** with the
guest-code field and a **Send for approval** button. Approval and hiding are
unchanged.
