# Local two-team programme demonstration

Reviewed 23 October 2026. This reproducible specimen exercises the governed request path against actual independent Guestbook source and real local databases/media. It is bounded evidence for #216/#219/#221/#255; production release identity remains in #11.

## Run and inspect

Reuse the installed Composer Node 22 dependencies and a clean existing Guestbook checkout at the exact current `composition.lock.json` Guestbook commit. The shared `appSettings` pin must match that lock, and the selected checkout must match both. Select its location with trusted host environment variable `COMPOSER_DEMO_GUESTBOOK`; the default is the sibling `../app-composer-guestbook` checkout. The script refuses a changed tracked checkout or a mismatched Composer source pin. It performs no installation, cloud calls, provider writes or vendor notifications.

```sh
COMPOSER_DEMO_GUESTBOOK=/absolute/existing/app-composer-guestbook node --experimental-transform-types scripts/platform-demo.mjs
COMPOSER_DEMO_GUESTBOOK=/absolute/existing/app-composer-guestbook node --experimental-transform-types --test tests/platform-demo.test.mjs
```

The normal test suite skips this optional lab only when its selected source directory is absent. A present but dirty, mismatched or incomplete checkout fails. Explicit qualification must run it with the reviewed source selected and retain a passing receipt. The first command emits a bounded JSON receipt. Save it under ignored `output/` when useful. `output/platform-demo-20261023.json` records the historical initial run at Guestbook `376129c8b48d29d26e982777084aa241966569c7`; it is not qualification of a later pin. Save each fresh selected-source run under a distinct evidence filename. The original local media excerpts retain their historical sources. Runtime/source changes require a fresh receipt; a fixture is not a production acceptance result.

For browser inspection, keep the owned loopback listener alive deliberately:

```sh
COMPOSER_DEMO_GUESTBOOK=/absolute/existing/app-composer-guestbook node --experimental-transform-types scripts/platform-demo.mjs --serve
```

The ready receipt prints each team's `localPage` and `localApp`. Open those exact loopback URLs while the process is alive. They use fictional data only. Stop with Ctrl+C or SIGTERM: the script closes its own listener/databases, removes its one `composer-platform-demo-*` temporary root, verifies removal and prints the final cleanup receipt. Normal execution and failures use the same `finally` cleanup. Do not preserve the root or sweep other runs' directories.

## What actually runs

| Part | Exercised implementation | Evidence boundary |
| --- | --- | --- |
| Platform requests/policy/leases | Current `managePlatform`, workspace membership, request store, existing resource adapter and publication functions. | Actors are trusted synthetic host fixtures. Access admission, EmDash dispatch/session lifecycle and human role acceptance are not exercised. |
| Independent application | Exact pinned Guestbook default fetch module and its imported resource, public rendering, permission, portability and PNG code, called through real loopback HTTP. The receipt records entrypoint/module paths and SHA-256 hashes. | Node 22 executes only that default fetch module. If `worker.ts` exactly re-exports the default from `./app.ts`, the lab executes `app.ts`; otherwise the older direct-fetch `worker.ts` is supported. The Workers entrypoint and named member service binding are not exercised; no `WorkerEntrypoint` shim is created. This is not workerd, managed Workers or a claim that full Composer runs unchanged on Node. |
| State | Separate on-disk Composer and Guestbook SQLite databases, actual forward migrations, foreign keys and transactional D1-compatible interface. | Local adapter semantics, not hosted D1 or process/node-loss qualification. |
| Media | Owned filesystem object storage implements the required R2 methods; real app media/export paths read the stored PNG. | Filesystem fixture, not an R2 durability/network qualification. |
| Composed page | Unchanged `StackView.tsx` transpiled using existing TypeScript and rendered by `react-dom/server` from actual immutable publication data. | Labelled local HTML wrapper. Astro routing/layout/assets, CSP and browser behaviour require their normal independent proof. |
| Public verification | Fixed host-side loopback forwarding serves actual resource HTML and actual StackView output through `PLATFORM_PUBLIC_FETCH`. | Canonical identities remain `composer.loftwah.com`; those URLs do not receive network requests. The seam is not requester-selected. |

## Observed journey

1. Fictional Atlas and Beacon establish separate standing policies and submit the same maintained Guestbook recipe through the generic request API. Both reach complete after the app contract, public resource HTML and composed publication checks. The created resources and workspaces differ.
2. Repeating each exact submission retains its request/resource identities and creates no new app operation. Team B cannot list Team A's platform scope or query Team A's actual app resource using Team B's proof.
3. Atlas requests a supported name/configuration update. Its stack and resource identities remain unchanged; Beacon's actual app resource row remains byte-for-byte unchanged.
4. A second Atlas update commits real activation in the app database, then the local HTTP server deliberately closes the socket before returning the acknowledgement. Composer retains needs-attention. Explicit resumption reconciles the app-owned durable operation receipt, reaches complete and adds no duplicate app operation/resource.
5. A sensitive-data update is denied by current policy and sends no app write. Its earlier verified publication remains the actual served service; rejected request intent does not rewrite the app.
6. One labelled synthetic approved pixel postcard is inserted directly into the app fixture and its owned media store. Guest admission remains closed. Actual public media returns matching bytes; the other resource returns 404. The real approved-portable endpoint exports one item with its actual SHA-256 and exact source/configuration identity.
7. Both databases pass `foreign_key_check`. Source pin/clean tracked bytes are rechecked. All owned temporary data and handles are removed unless the operator deliberately keeps `--serve` alive for inspection.

The receipt retains authored source hashes for the uncommitted/current modules, bounded HTTP paths/status/body hashes and operation identities, team/request/stack/resource identities, durable-operation count, lost-acknowledgement operation, renderer-source hash, export hash and cleanup result. It excludes credentials and media bytes.

This proves a useful local scoped-resource journey. It does not prove fresh-person admission, isolated per-team Worker/D1 provisioning, vendor integration, external notifications, complete disaster recovery, retirement, physical-device acceptance or a production deployment. The app-owned approved export is bounded and retains the existing live-source recovery limitations described in the Guestbook contract.

## Default fetch module and invited-member release boundary

The invited-member release selects Guestbook `9515b359bf268e6c79efbf6ad3497da132973c3e`. Its `src/worker.ts` imports `cloudflare:workers`, exports the named member service and exactly re-exports the default from `./app.ts`. A Node lab cannot load that Workers entrypoint unchanged. The source selector parses the actual reviewed entrypoint, follows only its exact default re-export, and executes the unmodified `src/app.ts` default handler. Comments, renamed exports, a different target or an additional default declaration cannot authorize that selection.

This is default-fetch-module qualification with actual SQLite and media, not a Node port of the new Worker entrypoint or named service binding. The receipt explicitly records those unexercised boundaries and rechecks both module hashes after the journey. Invited-member service isolation requires its separate workerd/production proof. Select a fresh clean checkout at the actual composition pin when rerunning; an older receipt or a changed local module cannot satisfy the new release.
