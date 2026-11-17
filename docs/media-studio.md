# Media Studio

Implemented for [#457](https://github.com/loftwah/app-composer/issues/457). An
independent, MIT image, video and sound studio that people select and configure
through Composer, then own and operate as its own application.

- Source: https://github.com/loftwah/composer-media-studio
- Live: https://media.loftwah.com
- New Composer Init briefs pin [Studio `b5ef8f6`](https://github.com/loftwah/composer-media-studio/tree/b5ef8f629c709c77c25b889bc3e61d0f5a6e90a6), verified live on 17 November 2026. Briefs pinned to `2640e67`, `c9ae600`, `a4f0e97`, `341a0fe`, `c3bcaff`, `1717dff`, `577e659`, `466b8f9`, `ac2012a`, `b0712b7`, `c3c80fc`, `c91184f`, `e2f4e83`, `52193c9`, `e911e99`, `53b473a`, `fec91ba`, `75cf69c`, `b8821b3`, `eb39262`, `27b75dc`, `2d456a5`, `e8b3778` or `409dff5` remain importable, including the original downloadable Paper & Light brief; their exact source and manifest digest are retained.
- Reuse decision: [studio Darkroom assessment](https://github.com/loftwah/composer-media-studio/blob/341a0feae8d552a1ae1abdbab5902d74764edee5/docs/darkroom-assessment.md)
- Media Studio uses Levi’s Darkroom for Studio Print, Film, Quick and Detail on the studio owner’s Workers AI account. Cloudflare Images fits Detail references that need resizing or format conversion. The studio checks Darkroom originals for private metadata before publication. You can recover a retained still without another paid request.

## First pack and reusable workflows

Every Media Studio build plan and agent handoff includes the first pack. The
brief and variation prompts adapt to the creator's own product and references.
Start in the private library. Keep the original, provenance and reviewed
exports separate. The owner decides on paid runs and public sharing. The
[Woodhouse Share production playbook](https://github.com/loftwah/woodhouse-new/blob/main/docs/creative/november-share-campaign.md)
supplies the composition, attribution and small-size review standard.

Use [ComfyUI's template setup](https://docs.comfy.org/interface/features/template)
and [typed subgraphs](https://docs.comfy.org/interface/features/subgraph) as
references for creative recipes. Use [n8n's reusable workflows](https://docs.n8n.io/build/flow-logic/break-workflows-into-smaller-parts.md)
and [failure handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md)
as references for operating them. The owner can take the guided path with the
app's own controls, account and assets. Compare by completed jobs.

| Job | Available today | Next block to prove |
| --- | --- | --- |
| Start from a good example | Init first-pack brief and five editable Studio recipes | Start from an approved example, choose permitted references and preview missing inputs and provider availability before a run |
| Create and refine | Reference variation, masks, outpaint, cutout and upscale | Combine typed transforms into a saved recipe and compare revisions against one retained master |
| Turn a scene into a finished clip | Saved takes, sound, storyboard and bounded render | Swap one take, reuse the remaining inputs and export landscape and portrait from the same project |
| Run and resume work | Studio result recovery and native EmDash [workflows](workflows.md) with scoped receipts | Reopen a multi-step recipe after an interruption and recover the paid step once using its existing operation ID |
| Hand finished work to publishing | Deliberate Studio publication and withdrawal; EmDash draft follow-ups | Review one rights-checked pack across Studio, Share and socials, then publish only the approved destinations with a receipt per destination |

[Studio #4](https://github.com/loftwah/composer-media-studio/issues/4) owns
creative execution. [Composer #289](https://github.com/loftwah/app-composer/issues/289)
owns workflow operations. [Composer #476](https://github.com/loftwah/app-composer/issues/476)
owns composition and the beginner's end-to-end proof under
[Composer #590](https://github.com/loftwah/app-composer/issues/590).

## What a person gets

**From Composer:** Init → *Media Studio* → name, creative direction, visibility,
still/video/sound defaults and bed length → saved specification (revision 3;
revision 1 and 2 drafts still validate; a retired Studio Draft choice is mapped
to FLUX.2 Klein 9B with a visible recovery notice) → portable export → the
chosen agent's handoff. The handoff pins the studio repository and
commit and tells the agent to create an owner-controlled copy with its own D1
database, R2 bucket, Workers AI binding, secrets, cron and release.

**In the studio:** real uploads (JPEG/PNG/WebP and WAV/MP3/M4A to 32 MB,
MP4/WebM to 64 MB), project collections, search and filters, an accessible
viewer, rename, download, delete, creative references, storyboards, project
export and deliberate public pages. These work with no model account.

**Generation and edits:** four still routes and one reference-guided variation
on the studio's own Cloudflare Workers AI account; masked fill and 25% outpaint
through FLUX.1 Fill; BiRefNet background removal and 2× Clarity upscale; two
image-to-video routes; Studio Score (10–30 s), Studio Voice and Studio Effect;
a browser mix with trim/gain/fades; and one bounded assembly route through the
studio's own fal.ai key. Every request shows an estimate and requires
confirmation. Originals, masks and results stay as separate assets with hashes
and parent links.

**Storyboards and assembly:** two to six saved takes (≤10.5 s each, ≤60 s total)
plus up to four saved music/voice/effect tracks. A browser mix with trim, gain
and fades becomes a new WAV; the source tracks stay in the manifest. Rendering
is one `fal-ai/ffmpeg-api/compose` call over 30-minute signed single-asset
links; the result is copied into the studio's R2. Editing a storyboard updates
it in place and keeps earlier renders. The 9:16 path keeps the selected order:
a deterministic 1080×1920 slate, one generated 720×1280 vertical slate video
retained and reused, then a compose of the selected takes and sound.

**Current provider block:** new fal `ffmpeg-api/compose` jobs are accepted,
then the model ends with "Unexpected status code: 403" and the result route
returns 403 ("Access denied: You do not have permission to use this
endpoint"). A verified webhook receiver now records the model's own error and
will save the master when execution succeeds. The in-product assembly and 9:16 controls are coded and
unit-tested but cannot produce a new master today. The article's 9:16
derivative was finished deterministically with local ffmpeg from the same saved
takes, sound and slate: 720×1280, SAR 1:1, DAR 9:16, 17.79 s. Published media,
downloads and render inputs support byte ranges.

## Provider truth

| Capability | Provider | Status at delivery |
| --- | --- | --- |
| Editorial still | Workers AI `@cf/leonardo/lucid-origin` | Verified live |
| Cinematic still | Workers AI `@cf/leonardo/phoenix-1.0` | Verified live |
| Photographic draft | Workers AI `@cf/black-forest-labs/flux-2-klein-9b` | Verified live at 1024 × 1280 on 15 November 2026; replaces the retiring SDXL Lightning draft |
| Reference variation | Workers AI `@cf/black-forest-labs/flux-2-klein-4b` | Verified live |
| Image-to-video | fal.ai Hailuo 2.3 Standard | Verified live: 5.875 s, 768 × 960, 589,717 bytes, saved in studio R2 |
| Image-to-video | fal.ai Kling 2.5 Turbo Pro | Verified live: 5.04 s, 1288 × 1608, 13,450,699 bytes, saved in studio R2 |
| Masked fill | fal.ai `fal-ai/flux-pro/v1/fill` | Verified live: 1280×704 variant, original + mask retained |
| Background removal | fal.ai `fal-ai/birefnet/v2` | Verified live: 1024×1024 transparent PNG |
| Upscale | fal.ai `fal-ai/clarity-upscaler` | Verified live: 2048×2048 PNG |
| Sound effect | fal.ai `fal-ai/elevenlabs/sound-effects/v2` | Verified live: 5.04 s, 44.1 kHz stereo |
| Assembly / in-product 9:16 | fal.ai `fal-ai/ffmpeg-api/compose` | Blocked: new jobs return 403 at the result route; earlier masters retained |

Model identifiers are server-owned and revalidated on every request. The studio
does not advertise Higgsfield's reference count, duration or resolution claims.
Reference variation keeps palette, ink quality and subject cues; it does not
promise identical composition or pixels, and the UI says so.

## Durable work and cost correctness

- Intent is persisted before dispatch; one unique client request id per project.
- An atomic dispatch lease prevents two workers submitting the same admitted job.
- Provider output is retained in R2 before the library record. A failed save is
  retried with the same bytes and no second inference call.
- One SQL admission reserves the monthly allowance for the whole project; two
  concurrent requests cannot oversubscribe it.
- Unknown provider outcomes keep their reservation and are never resubmitted.
- Cancellation shows what the provider confirmed; it is not represented as a
  refund.
- Deleted jobs and assets are tombstoned; a late completion is discarded instead
  of restoring media or a publication.
- A cron trigger advances asynchronous jobs after the browser closes; reopening
  the job continues from the same provider identity.

## Finishing and publishing

A published page exposes only the title, description and media, plus a download
link. Prompts, private filenames and other projects stay private. Withdrawing a
page stops new visits; copies already downloaded cannot be recalled. Video pages
can publish the source still as their poster.

The studio's **Use in Launch Kit** action downloads the still for Launch Kit's
existing import path; finishing stays in Launch Kit. A deliberately published
page is a normal HTTPS card destination for Linkarooie/Showcase, so the same
asset can appear in a composed app without copying private metadata.

## Sign-in and access

Composer already opens the studio through a short-lived, scoped handoff, without
asking the person for the standalone owner passphrase. The selected next sign-in
profile uses Cloudflare Access's native email codes and passkeys. Its explicit
account binding and real login demonstration remain delivery work; it is not
enabled by this documentation update.

The [Cloudflare integration brief](cloudflare-access-oyster.md) explains the user
journey, prerequisites, Composer/Studio/EmDash/Oyster responsibilities, existing
automation keys and the optional private-backend path. It needs no Pocket ID
server. Tailscale compatibility is considered, with no tailnet setup required.
The brief also records the current private-read revocation limit and the small
set of checks needed for the change, using the existing release process.

## Workspace-scoped media authority (#599)

Composer's optional Oyster/Prints capability is offered per creator workspace,
not per deployment. The workspace is derived server-side from the signed-in
account and its membership; a workspace id in a request body is only a selector
and is refused when the account is not a member. Nothing in the request supplies
the actor, the workspace or the permission.

| Surface | Authority | Allowed actions |
| --- | --- | --- |
| Native EmDash panel | Current workspace membership plus the workspace's `media-studio` grants (`studio-installation`), rechecked on every call | `status`, `generate`, `reconcile`, `import`, and — for a workspace owner who is also the deployment owner — `enable`, `disable`, `refresh`, `adopt`, `grant-agent`, `revoke-agent` |
| Agent (`POST /api/media-agent`) | Owner-issued agent grant: one workspace, an explicit permission subset, an expiry and a revocation | `status`, `generate`, `reconcile`, `import` only |

Permissions use the existing Media Studio vocabulary: `read` (status and job
lists), `generate` (dispatch and reopen, which can spend), `edit` (import into
the owned library) and `admin` (connection and grant administration). A member
without the needed permission is refused before any provider call. A workspace
owner receives the full set; everyone else needs an active grant row. Setup,
disable, credential references and agent grants are owner-admin only and are
unreachable from the agent route.

### Stored scope and receipts

Migration `0029_media_workspace_authority.sql` adds
`media_workspace_connections` (one connection per workspace, storing a
credential *reference* and the verified catalogue), `media_workspace_jobs`
(one canonical job table), `media_agent_grants` (SHA-256 of the token only) and
`media_scope_events` (owner receipts that name the owning record). The legacy
`media_capability` row and `media_jobs` rows are retained unchanged.

- A connection stores `OYSTER` or `OYSTER_CONNECTION_<NAME>`; the matching
  `_ORIGIN` / `_OWNER_KEY` values stay in Worker secrets. A stored row can never
  select an unrelated secret, and the credential's origin must equal the
  connection's host.
- A job id is derived from the workspace and the provider request id, so ids do
  not collide across workspaces. The provider request id stays globally unique:
  the same idempotency key replayed in the same workspace returns the recorded
  job without a second provider call, and replayed from another workspace fails
  closed without confirming that a row exists.
- An unknown or timed-out dispatch is recorded as `unknown`. It is never retried
  automatically; only the explicit `reconcile` call re-reads that provider
  identity.
- `disable` is this workspace's revocation: new dispatch and retained-result
  reads stop, and every job, imported file and receipt is kept. It never deletes
  media or changes the independent installation.
- Imported files are written once per job to `media-studio/<jobId>.<ext>` in the
  app's own R2 and are served from `/media-studio/asset/<name>`. That URL is
  public-by-URL, as before: withdrawing or deleting an owned file stays a
  separate explicit operation. The capability never returns another workspace's
  key, and an artifact can only be imported from a job row in the caller's scope.

### Legacy rows and the bounded credential transition

A pre-#599 row stores no workspace, account or environment, and the old handlers
ran with deployment-wide authority. **No automatic backfill guesses a
workspace:** every legacy job is copied once into owner custody
(`workspace_id = 'custody:owner'`, `scope = 'custody'`, `adopted_from =
'legacy:0027'`). Custody is visible only to the deployment owner, is never mixed
into a workspace list, and is read-only. The only provable ownership path is the
owner's explicit `adopt` action, which records the previous scope, the actor and
the time on the job and in `media_scope_events`; it makes no provider call.

The legacy deployment credential is transitional and bounded:

- `OYSTER_ORIGIN` / `OYSTER_OWNER_KEY` may back **one** workspace at a time, and
  only through an explicit owner `enable`. A second workspace is refused with
  `LEGACY_SCOPE_TAKEN` until it has its own
  `OYSTER_CONNECTION_<NAME>_ORIGIN` / `_OWNER_KEY` secrets and connection.
- The deployment-wide `MEDIA_AGENT_TOKEN` no longer admits workspace media
  calls. It is refused with `AGENT_SCOPE_REQUIRED`; the owner issues a
  workspace grant in the panel, replaces the agent's token with
  `MEDIA_AGENT_GRANT_TOKEN`, and the old secret can then be removed.

The panel shows an **Owner custody** section to the deployment owner whenever
pre-workspace jobs exist. It lists the retained count, the custody note, and each
job's date, kind, model, prompt excerpt, state and whether an imported copy is
kept. **Adopt into this workspace** asks for confirmation, names the previous
scope, states that no provider call is made, and sends the row's own
`updatedAt` as the compare-and-swap identity. A row that changed since it was
rendered is refused and the list reloads. A workspace switcher and grant
buttons remain presentation work over the same server actions.

## Ownership

The studio owns its D1 metadata, R2 bytes, Worker release and provider keys. It
runs after detaching Composer and has no licence callback. Composer stores only
the repository, commit and manifest digest. The owner passphrase, session secret
and provider key never enter a Composer specification, prompt, screenshot or
repository.

## Checks and evidence

- Studio: 15 focused tests covering spec validation, byte parsing, idempotent
  admission, one budget authority, save retry without regeneration, tombstones,
  unknown outcomes and the fal request/status/download contract.
- Composer: focused media-studio spec tests (source pin, defaults round trip,
  fail-closed settings, old-spec compatibility, recommendation switching,
  handoff/build plan) plus the existing suite.
- Live still, reference-variation and image-to-video generations were saved into
  owned storage and are visible at https://media.loftwah.com.
- Published pages: https://media.loftwah.com/p/JYCl_dWcb2yqya6h (still) and
  https://media.loftwah.com/p/LpATM63K8aXYVmL4 (video with poster).
- Launch Kit consumed the studio still and produced a 1200 × 630 profile card.
- Showcase lists **The wheel, in motion** as a published card linking to the
  studio page.

Exact commits, Worker versions, screenshots and remaining gates are recorded in
[#457](https://github.com/loftwah/app-composer/issues/457) and [#11](https://github.com/loftwah/app-composer/issues/11).

## Remaining gates

- Both asynchronous image-to-video routes were verified (Hailuo 2.3 Standard and
  Kling 2.5 Turbo Pro). A provider balance is still required for any paid
  generation; the studio reports a funding refusal honestly.
- Optional Oyster/Prints interoperability remains [#422](https://github.com/loftwah/app-composer/issues/422),
  not a prerequisite for this native studio.
- Physical-device capture and social unfurl caches remain separate from the
  browser checks.

