# Building-story local run

This lab reproduces the fictional Here / there → Linkarooie journey used by the [build story](/building). It uses the actual app source, Wrangler's local Workers runtime, local D1 and local R2 emulation. It does not deploy, connect a Cloudflare account or read the owner's hosted records.

## Requirements

- Node 22 and the pnpm version declared by each repository.
- The two public app repositories cloned beside this one at the pinned revisions, with their dependencies installed. The scripts copy these siblings but do not clone them:

  ```sh
  git clone https://github.com/loftwah/app-composer-guestbook ../app-composer-guestbook
  git -C ../app-composer-guestbook checkout 019ce0d117f9f89e472a5c7642d51d85301f7fcd
  (cd ../app-composer-guestbook && pnpm install --frozen-lockfile)
  git clone https://github.com/loftwah/app-composer-showcase ../app-composer-showcase
  git -C ../app-composer-showcase checkout 20ef9a50c19c7a3419dc06fdae020c6a677ed5cf
  (cd ../app-composer-showcase && pnpm install --frozen-lockfile)
  ```

  Keep both checkouts at their pinned revisions and do not edit or commit in them: the lab measures their `git rev-parse HEAD` and copies them into its owned temporary root.
- A native Wrangler install available through those repositories.
- A host Playwright package and Chrome for the captures. This repository does not ship a browser or a test runner. Install Playwright in a folder you own, for example:

  ```sh
  mkdir -p "$TMPDIR/composer-playwright"
  (cd "$TMPDIR/composer-playwright" && npm install playwright)
  ```

  Then point `PLAYWRIGHT_MODULE` at `$TMPDIR/composer-playwright/node_modules/playwright/index.mjs`. The capture launches your installed Chrome by default. Starting and seeding the Workers do not need Playwright.

Docker is **not** used by this procedure. The supported local runtime is Wrangler's `workerd`; a container would still download a platform-specific runtime and would still need a host browser for the screenshots. Docker support for this walkthrough remains unexercised.

## Start

The defaults are the original pair:

```sh
labs/building/start-local.sh
```

- Guestbook on `https://localhost:8788`
- Linkarooie on `https://localhost:8787`

To run beside another local Worker, select each loopback port separately:

```sh
GUESTBOOK_PORT=9788 LINKAROOIE_PORT=9787 labs/building/start-local.sh
```

Both values must be whole numbers from 1 to 65535, written without leading zeros, and they must differ. The script validates them before it creates the temporary root, copies either repository or applies migrations. It also stops before any of that when a selected port is already listening: it never stops, reuses or takes over an unrelated listener. Pick a free port instead.

The script creates one owned temporary root under `$TMPDIR/composer-build-199.*`, copies both repositories there, links their installed dependencies, applies local migrations, writes fictional local Worker configuration and starts:

- Guestbook on `https://localhost:$GUESTBOOK_PORT`
- Linkarooie on `https://localhost:$LINKAROOIE_PORT`

It writes the root's path to `output/build-199/local-root` and leaves a `run.env` inside that root with both selected ports and their exact URLs. Use a separate checkout for a second simultaneous run. The working repositories, their `.wrangler` state, owner records, sessions and credentials are not touched.
Each run has its own local service registry, and Wrangler picks free inspector ports for the two Workers.

## Seed

Generate or provide a real Init specification first. The committed article uses `public/downloads/building-199-init-spec.json`. You can replace it with a spec downloaded from `/init` and point `INIT_SPEC` at that file.

The default pair:

```sh
RESOURCE_ID=build199-trail-8 \
  INIT_SPEC=public/downloads/building-199-init-spec.json \
  node labs/building/seed-local.mjs
```

When you selected other ports, pass the exact URLs from the `run.env` inside the recorded root:

```sh
GUESTBOOK_URL=https://localhost:9788 \
  LINKAROOIE_URL=https://localhost:9787 \
  RESOURCE_ID=build199-trail-8 \
  INIT_SPEC=public/downloads/building-199-init-spec.json \
  node labs/building/seed-local.mjs
```

Both targets must be exact `https://localhost:<port>` URLs with different ports. The seeder rejects anything else before it contacts a Worker. It creates a fresh resource through the app-owned resource API, stages and activates the Guestbook settings, applies the Linkarooie profile and links, and links the exact source for contributions.

## Capture

The default pair:

```sh
RESOURCE_ID=build199-trail-8 \
  PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node labs/building/capture-journey.mjs
```

With selected ports, pass the same two exact URLs:

```sh
GUESTBOOK_URL=https://localhost:9788 \
  LINKAROOIE_URL=https://localhost:9787 \
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

The stop script reads `output/build-199/local-root`, stops only the processes registered by this run, checks listeners against that root before killing anything, and removes the temporary directory. It reads the selected ports from the run's `run.env`; a run started by an older default-only script still stops on `8788` and `8787`. It does not sweep other Wrangler sessions, repositories or browser profiles.

## What this does not prove

A local Worker run does not prove a Cloudflare deployment, a custom-domain release, a live owner configuration, external social unfurls, a physical-device pass or screen-reader acceptance. The hosted release path is separate; its exact source, Worker identity and live checks belong in Composer #11.
