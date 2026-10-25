# Real local native registry lifecycle — 25 October 2026

Issues #369 / #365 / #291. This extends the first read-only checkpoint with an actual installed third-party plugin in an isolated local EmDash runtime. It does not enable registry installation in Composer production.

`node labs/plugins/run-native-lifecycle.mjs --run-local-reviewed-plugin` ran from **10:57:03 to 10:57:32 UTC** (29.0 seconds) with Node 22.23.4, installed EmDash **1.3.1**, official Node production `WorkerdSandboxRunner` **0.9.5**, native Workerd **2026-10-13** and real local SQLite/files. It uses EmDash's native endpoint exports and installer, not a Composer installer. Only Astro's build-time empty virtual configuration and production `DEV=false` substitution are supplied by the host. No authoritative-record fixture, signature bypass, malicious-artifact override or sandbox bypass exists.

The fixed selected plugin is **Publish Check**, publisher `did:plc:p5t4ri3u4rr24wglznjsb5uv`, slug `publish-check`. Both **0.2.0** and **0.3.0** declare only structured `content.policy`, normalised by EmDash to `hooks.content-policy:register`. No network, mail, payment, public routes or MCP tools were accepted. Native verification read the actual publisher/artifact records. Build provenance is **absent-optional**, not verified. This is a bounded local execution review, not a general security endorsement.

[Exact successful receipt](plugin-native-lifecycle-20261025/receipt.json):

| Native operation | Observed result |
| --- | --- |
| Low-privilege synthetic local user attempts installation | 403 `FORBIDDEN` |
| Verify actual 0.2.0 and 0.3.0 signed records/artifacts | 200 / 200 |
| Installation with stale release CID | 400 `RECORD_VERIFICATION_DRIFT` |
| Install reviewed 0.2.0 with exact record consent | 201; active state; actual Workerd healthy |
| Read native settings; set `titleSuffix` | 200 / 200; fictional value saved |
| Disable / re-enable | 200 / 200; inactive/active state observed |
| Update with stale CID and explicit native confirmation | 400 `RECORD_VERIFICATION_DRIFT` |
| Update reviewed 0.2.0 → 0.3.0 | 200; exact new installed version; saved suffix preserved |
| Attempt downgrade to 0.2.0 | 400 `DOWNGRADE_NOT_ALLOWED` |
| Uninstall with default retention | 200; installed state removed; **15 native settings options retained** |
| Reinstall reviewed 0.3.0 | 201; saved suffix recovered through real native settings GET |
| Final uninstall | 200; owned temporary project/database/objects removed |

The publisher profile CID is `bafyreihe2zbg2lxktq5zgw5hvivjy7uwwfi3fjqtzq4a7sobequwkqoq7a`. Release CIDs are `bafyreiaeilifez6sbsqg7odgonxq4jmqcph77yq6pqf2czins5d5poiwp4` (0.2.0) and `bafyreicpqwjza2wvv2ocmmbrvcja63samif4csc6727dcb5zo4e2kgeh54` (0.3.0). The runtime's plugin ID was `r_hmnzxttniwtlt4hn`.

## Failures investigated and recovered

- The unbundled host initially lacked Astro's virtual config and `import.meta.env.DEV`; the local host now supplies those build-time values without changing installer or runner logic. These setup errors were not counted as plugin verification failures.
- Disabling install scripts left Workerd's Node fallback launcher in the temporary installation. Native lifecycle operations succeeded, but one pass stayed open until the 120-second lab timeout and a later restart reported an address collision. The [initial failed receipt](plugin-native-lifecycle-20261025/initial-shutdown-failure.json) remains. The lab now selects the exact already-downloaded platform binary inside its owned installation, equivalent to Workerd's ordinary postinstall result; it executes no install script. The successful pass exited cleanly and both owned processes and temporary roots were confirmed absent. Unrelated running Workerd processes were preserved.
- Native EmDash's default publisher policy is **escalation-only**. A same-permission update with an unconfirmed stale CID was accepted during an earlier isolated probe, matching installed source. The exact-review path therefore explicitly uses EmDash's native `confirmCapabilityChanges: true`, which exercises record-consent validation even without a scope increase. This is an important policy distinction: supplying a CID alone does not make the default update path exact-review enforcement.
- Actual native settings are in `options` under `plugin:{id}:settings:{key}`. The earlier `_plugin_storage`-only retention check was vacuous. The final pass verifies fifteen real options and successful setting restoration after reinstall. The encryption recovery note and fixed metadata helper were corrected accordingly.

## What this proves and what remains

This proves actual native **API lifecycle and configuration retention**, real publisher/artifact verification and actual Node Workerd execution. The local user/role is a synthetic isolated fixture; it is not real Access login, MFA, a native browser consent interaction or third-party code security certification. A permission-expanding actual release, revoked/yanked upstream release and failed malicious artifact were not executed; local negative contracts remain separately labelled.

Cloudflare Worker Loader, D1 `PluginBridge`, Workers Paid entitlement, 50 ms/10-subrequest enforcement, production registry configuration, real browser administration and public plugin output remain unqualified. The plugin's publication-policy behaviour was not used to publish content. No production settings, data, key, binding, service pin or independent app changed; no mail, payment, paid commitment or IdP policy action occurred.

The installed native settings demonstrated plaintext fictional configuration only. Production encryption remains degraded until its own approved key restoration and live settings/Connections verification. The now-complete production metadata observation found zero plugin options, zero native settings and zero recognised encrypted envelopes, alongside empty plugin storage and empty state-data columns. This is absence of current stored ciphertext at that observation, not key health or backup recovery.
