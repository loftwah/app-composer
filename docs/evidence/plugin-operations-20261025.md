# Plugin operations continuation — 25 October 2026

Issues #291, #365 and #369. Implementation base `4b96dd38c4205deea64092fbb10a2b6584d6f73c`; Node 22.23.4, EmDash/Cloudflare adapter 1.3.1, registry client 0.7.1 from the existing frozen dependency graph.

The native Trust Centre now leads with this site's actual installed inventory and compares registry observations only by exact publisher DID plus package slug. Native/build-time plugins retain their independent source release process. Numeric installed-versus-observed comparison distinguishes a newer observed release, an installed version ahead of the dated observation, the same version number, unsupported version syntax, unknown identity and stale evidence. Matching version numbers never certify installed release bytes or permissions. A red candidate does not declare an older installed release affected or a publisher malicious.

Security/trust and maintenance/compatibility are independently visible. Advisory coverage, installed manifest/public-route differences, publisher-signature verification and native installation remain unknown when unobserved. The comparison helper exposes added capabilities and outbound hosts only for matching, fresh, artifact-bound inspections; stale/mismatched receipts produce no permission comparison.

`node scripts/plugin-trust-refresh.mjs` uses the already installed official DiscoveryClient, four bounded read-only GETs for the two fixed reviewed identities, no redirects, a 10-second request timeout and a 512 KiB response ceiling. It emits a candidate JSON document to stdout for review; it cannot overwrite the shipped snapshot, install code, fetch artifacts or read private inventory. Changed release/artifact identities discard old manifest inspection. Failure retains the previous observation with `refreshFailed`; raw remote errors are discarded. On 25 October at 10:32:50 UTC the real official registry returned the same Freeform 0.1.4 and Stripe Checkout 0.10.3 identities as the previous observation. This was discovery only, not signature verification or installation.

## Native lifecycle boundary at the first checkpoint

`tests/plugin-native-readiness.test.mjs` calls the actual installed EmDash native registry install/update/uninstall endpoint exports against a real migrated, isolated local SQLite database and local object storage. It proves administrator permission denial, missing storage and missing sandbox refusal before any network or installation effect. For explicitly seeded fictional registry state, native uninstall retains plugin data by default, removes only selected data on explicit request and refuses a native/config-source row. Both owned temporary roots are removed and absence asserted.

The seeded state is not an installed plugin and this test is not a complete registry lifecycle. At that checkpoint no sandbox runner, Worker Loader binding or Workers Paid entitlement had been established. The subsequent Node/workerd native API lifecycle now qualifies actual local installation/configuration/update while keeping Cloudflare/provider acceptance separate. At this first checkpoint no third-party plugin code had been executed. The subsequent real local native lifecycle is recorded separately in `docs/evidence/plugin-native-lifecycle-20261025.md`; it does not qualify Cloudflare Loader, D1 bridge or production behaviour. Production is unchanged and remains closed to registry installation.

Official documentation rechecked: [sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/), [native installation](https://docs.emdashcms.com/plugins/installing/) and [discovery client](https://docs.emdashcms.com/plugins/registry-client/). Installed native endpoints and their failure codes were exercised; source declarations were not promoted to provider proof.

## Encrypted settings

A production metadata-only D1 observation at approximately 10:26 UTC returned `_plugin_storage` **0 rows**, `_plugin_state` **4 rows**, **0 nonempty data rows**, **0 writes**. The exact query was:

```sql
SELECT COUNT(*) AS plugin_storage_rows FROM _plugin_storage;
SELECT COUNT(*) AS plugin_state_rows,
  SUM(CASE WHEN LENGTH(data)>0 THEN 1 ELSE 0 END) AS nonempty_state_rows
FROM _plugin_state;
```

The initial two-table scope was incomplete: native EmDash 1.3.1 settings are stored in `options` as `plugin:{id}:settings:{key}`. A subsequent production metadata-only query at approximately 10:55 UTC returned **0 plugin-option rows, 0 native settings rows and 0 recognised encrypted envelopes**, with **0 writes**. It returned no option names or values. The fixed query helper `scripts/plugin-secret-inventory.mjs` and its tests cover this actual source layout; any nonempty option/collection/state store requires independent review even when no recognised envelope is found.

No secret or ciphertext value was read, printed, generated, rotated or replaced. The earlier invalid runtime encryption-key observation remains degraded until legitimate recovery. Restore a valid original from private owner storage if available; otherwise obtain explicit owner authority for a new key after another immediate metadata check, retain it with the backups and use the guarded/version-aware release path. Verify runtime startup, a real native secret settings path and the owned Connections path before claiming recovery. The complete empty-store observation establishes no current plugin ciphertext in the known stores; it does not grant rotation authority, validate the key or establish recoverability of older backups. Recheck all three stores immediately before any approved write.

## Checks and remaining acceptance

- `pnpm install --frozen-lockfile`: existing pins, no dependency change.
- `node --test tests/plugin-trust.test.mjs tests/plugin-release-comparison.test.mjs tests/plugin-trust-refresh.test.mjs tests/plugin-native-readiness.test.mjs`: 22 passing tests, zero failures.
- `pnpm check:types`: zero errors, zero warnings (72 informational hints).
- Impeccable mechanical check run on the changed native page/CSS. Root integration owns final browser pixels, complete checks/build, review and production promotion.

No production data/configuration or independent app source pins changed. The first checkpoint performed no installation; the later isolated native installation is separately recorded. No external mail, payment, secret operation, paid commitment or IdP change occurred. #291 and #369 remain gated; #365 progresses with useful read-only operation and maintained refresh/comparison tools. Physical-device, assistive-technology and live native browser acceptance are separate from these local tests.
