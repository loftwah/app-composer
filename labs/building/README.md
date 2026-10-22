# Building-story local run

This lab reproduces the fictional Here / there → Linkarooie journey used by the [build story](/building). It uses the actual app source, Wrangler's local Workers runtime, local D1 and local R2 emulation. It does not deploy, connect a Cloudflare account or read the owner's hosted records.

## Requirements

- Node 22 and the pnpm version declared by each repository.
- The pinned dependencies installed in the two sibling repositories:
  - `../app-composer-guestbook`
  - `../app-composer-showcase`
- A native Wrangler install available through those repositories.
- A host Playwright package and Chrome for the captures. This repository does not ship a browser or a test runner.

Docker is **not** used by this procedure. The supported local runtime is Wrangler's `workerd`; a container would still download a platform-specific runtime and would still need a host browser for the screenshots. Docker support for this walkthrough remains unexercised.

## Start

```sh
labs/building/start-local.sh
```

The script creates one owned temporary root under `$TMPDIR/composer-build-199.*`, copies both repositories there, links their installed dependencies, applies local migrations, writes fictional local Worker configuration and starts:

- Guestbook on `https://localhost:8788`
- Linkarooie on `https://localhost:8787`

It writes the root to `output/build-199/local-root` and leaves a `run.env` inside the root. The working repositories, their `.wrangler` state, owner records, sessions and credentials are not touched.

## Seed

Generate or provide a real Init specification first. The committed article uses `output/build-199/init-spec.json`; without it, download a spec from `/init` and point `INIT_SPEC` at the file.

```sh
RESOURCE_ID=build199-trail-8 \
  INIT_SPEC=output/build-199/init-spec.json \
  node labs/building/seed-local.mjs
```

The seeder creates a fresh resource through the app-owned resource API, stages and activates the Guestbook settings, applies the Linkarooie profile and links, and links the exact source for contributions. It only accepts explicit `https://localhost:<port>` targets.

## Capture

```sh
RESOURCE_ID=build199-trail-8 \
  PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node labs/building/capture-journey.mjs
```

The capture script performs the real journey:

1. Visitor opens the profile and the Guestbook-owned form.
2. Visitor submits a fictional postcard and receives a pending receipt.
3. Owner approves it through the app-owned moderation contract.
4. Owner explicitly collects and pins it in Linkarooie.
5. Owner hides it at source; media and item API return 404 and the card disappears.
6. Owner closes and reopens the Guestbook; the profile explains both states without a dead form.
7. Phone and desktop states are captured, including the real form and the featured section.

Assertions, source revisions and screenshot hashes are written to `output/build-199/captures/report.json`. The article copies selected images to `public/guides/building/` with a separate provenance file.

## Stop and clean up

```sh
labs/building/stop-local.sh
```

The stop script reads `output/build-199/local-root`, stops only the processes registered by this run, checks listeners against that root before killing anything, and removes the temporary directory. It does not sweep other Wrangler sessions, repositories or browser profiles.

## What this does not prove

A local Worker run does not prove a Cloudflare deployment, a custom-domain release, a live owner configuration, external social unfurls, a physical-device pass or screen-reader acceptance. The hosted release path is separate; its exact source, Worker identity and live checks belong in Composer #11.
