# Model retirement and capability freshness — 15 November 2026

This is the delivery record for the urgent Studio Draft retirement and the
read-only capability check. It is not a provider invoice or a claim that every
provider route is healthy.

## Live identities

| Surface | Source | Worker / version | Read-back |
| --- | --- | --- | --- |
| Media Studio | `2640e67b7224f9c3a2ada1b77e364769ac4039b5` | `e560dc4b-4c97-4ccd-a098-f4e2b89fa098` | `https://media.loftwah.com/build.json` |
| App Composer | `f26c94030e039c54c49d009d860b5b396736821f` | `8fa56e05-d986-43b5-8b51-45cb37c9a6f2` | `https://composer.loftwah.com/build.json` |

Studio releases in this slice: `3c121fb` (replacement, manifest, refresh),
`3c2ef85` (sound-effects v3), `e4081fc` (fal search id), `3c2606e` (Composer
selection), `820dbb8`/`2640e67` (#148 workbench completion).

## Why it was urgent

Cloudflare's public model page for
`@cf/bytedance/stable-diffusion-xl-lightning` lists **Planned Deprecation:
11/20/2026**. Studio Draft was still enabled on that endpoint. The replacement
had to land before the cutoff without rewriting saved jobs or imported briefs.

## What shipped

- **Studio Draft · FLUX.2 Klein 9B** (`studio-craft`) uses
  `@cf/black-forest-labs/flux-2-klein-9b` through the existing Darkroom
  multipart adapter. It supports square, portrait, landscape and wide frames.
  The planning estimate is US$0.016 for a 1.25 MP frame.
- The old `studio-draft` selection is retired. New work gets
  `410 model_retired` with the replacement. Saved jobs keep the exact SDXL
  endpoint and the label **Studio Draft · SDXL Lightning (retired)**; new jobs
  record `modelEndpoint` in their request JSON.
- Composer Media Studio spec revision 3 reads its eight Init choices from
  `config/media-studio-capabilities.json`. An imported revision 1/2 brief that
  selected `studio-draft` loads as `studio-craft` with a visible recovery
  notice before save.
- `GET https://media.loftwah.com/capabilities.json` publishes contract
  `media-studio-capabilities` v1: enabled models and endpoints, frames, costs,
  adapters, retired models, sources, checked-at/last-good and stable alerts.
- The existing every-minute Studio cron runs a read-only refresh at most daily.
  It reads public Cloudflare model pages, fal model search and models.dev. It
  never calls inference, changes a default, spends or writes an issue. An owner
  can run it now with `POST /api/capabilities/refresh`.
- The check found a second real drift: `fal-ai/elevenlabs/sound-effects/v2` was
  no longer in fal model search. Studio Effect now uses v3, whose published
  OpenAPI input has the same fields.

## Live manifest result

Checked `2026-11-15T12:00:22.518Z`:

- contract `media-studio-capabilities` v1;
- 8 Composer-selectable models (print, film, craft, quick, Hailuo, Kling, Score,
  Voice) plus the edit/render routes;
- retired `studio-draft → studio-craft` with the exact SDXL endpoint;
- `lastGoodAt` present and **0 open alerts**.

## Actual Studio adapter proof

In the owner session on `https://media.loftwah.com`, a real Studio Draft
request against project `prj_be2b53ca02d04c37aeaaf5996fbdb3cb` produced:

| Field | Value |
| --- | --- |
| Generation | `gen_4515ab469ca948dfbe5587bbf142c8ac` |
| Asset | `asset_13dfc4fdeca64149a1051c596730a36b` |
| Model / endpoint | `studio-craft` / `@cf/black-forest-labs/flux-2-klein-9b` |
| Status | `saved` |
| Frame | 1024 × 1280 JPEG, 459,080 bytes |
| SHA-256 | `b32781d2301dbfe72a1c67a966c6d6f1af7b12f04807a96483ce3b18a5c029f2` |
| Allocation | US$0.016 estimate (not an invoice) |

The image is a product plate: one matte burnt-orange stoneware cup, soft key
light, no hands, logos or text. It appears in History as **Studio Draft ·
FLUX.2 Klein 9B**.

A separate Workers AI binding probe also produced a 1024 × 1280 image
(519,884 bytes) with the same multipart shape. The ignored
`output/capability-qualification-20261115/` directory in the Studio checkout
holds the machine-readable receipt and the caption-render frame.

## Composer verification

- Live `https://composer.loftwah.com/init` serves
  `Studio Draft · FLUX.2 Klein 9B photographic` as the still option.
- Imported older spec with `studio-draft` maps to `studio-craft` and shows the
  recovery notice; covered by `tests/media-studio.test.mjs`.
- `node scripts/studio-capabilities.mjs --check` validates the snapshot and the
  retired mapping. It runs in the build/type-check path.
- Composer live source read-back is `f26c940`; the release gates and live
  sharing/publication probes passed.

## Remaining limits

- Provider invoices are not linked. The allocation is an estimate.
- The daily refresh is proven by the live manifest and tests; the next
  scheduled run is at the normal daily boundary.
- A manual refresh is owner-only; the browser session used for this receipt is
  the owner's Composer-bridged session.
- Composer's committed snapshot is deliberately refreshed by a reviewed release
  after the Studio manifest changes. The daily check surfaces drift first.
