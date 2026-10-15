# Get Ready

One reusable MIT engine for preparing an environment before an application idea. Reviewed 14 October 2026. This archive installs the same modules used by App Composer. It has no runtime package dependencies, install scripts, Composer database, EmDash or Woodhouse requirement.

The current local adapter verifies active Codex, Git/GitHub CLI/pnpm, the selected GitHub repository's push access, the Cloudflare account and an exact Hello source over HTTPS. Its supported setup operations prepare reviewed tools/source/ownership and a bounded Hello deployment. macOS Apple Silicon and Node 22 are the verified path. Other agents can supply the documented engine adapter; this does not certify their local installation. First accounts, registrar migration, broader operating systems and arbitrary application builds remain unfinished.

## Install the reviewed archive

Download the archive and matching JSON manifest from https://composer.loftwah.com/docs#standalone-get-ready. Check its SHA-256 against that manifest and review `SOURCE.json` and the source. The checksum detects a mismatch; it is not an independent signature. Download and retain the files together. This is a release archive, not a claim of npm registry publication.

In a local project chosen for this integration:

```sh
npm install --ignore-scripts --no-audit --no-fund ./get-ready-core.tgz
./node_modules/.bin/get-ready --help
./node_modules/.bin/get-ready --workspace /absolute/authorised/workspace --report
```

The last command runs checks and saves private progress inside the selected workspace. It can return a nonzero status with a redacted JSON report when setup is incomplete. It does not retry setup automatically. Run it from an authorised active agent runtime; credentials stay with local GitHub/Wrangler tooling or the approved Cloudflare runtime. Never put credentials in the package, report or chat.

For an already selected target, also provide `--account ACCOUNT_ID --reference-worker WORKER --reference-url HTTPS_ORIGIN --reference-repo OWNER/REPO`. Keep those references bound to the actual source and account; a public demo is not proof for your own workspace. Setup operations require their separate explicit flags and existing scope/permission checks. See https://github.com/loftwah/app-composer for operation details.

## Programmatic API

```js
import {runLocalReadiness, referenceTarget, readinessReport} from '@loftwah/get-ready';

const state = await runLocalReadiness({
  workspace: '/absolute/authorised/workspace',
  account: 'YOUR_SELECTED_ACCOUNT_ID',
  worker: 'your-reviewed-hello-worker',
  target: referenceTarget('https://your-reference.example', 'owner/repository'),
});
console.log(JSON.stringify(readinessReport(state)));
```

Use actual validated account/repository/origin values. With no `operation`, this performs checks and saves private progress only. The exported report omits the private evidence. `createReadinessSession`, `runReadinessSession` and `inspectReadiness` expose the same engine to an explicitly trusted adapter with the four supported checks. The host controls capabilities; imported reports never grant execution authority. `@loftwah/get-ready/report` validates and inspects redacted reports; `@loftwah/get-ready/preferences` carries bounded address and assistance intent, not readiness proof or execution authority.

The optional local MCP adapter has a separate installable archive at https://composer.loftwah.com/docs#local-get-ready-mcp with its own SDK dependencies and this same core snapshot. It is not bundled in this dependency-free core archive. This package opens no network listener and does not expose a hosted API. It makes provider calls only when a selected check/operation needs them. Read the source and supported boundary before integrating.


Readiness exports now use report version 2, including only a bounded `workingTree` observation: `clean`, `changed` or `unknown`. This reveals no file names, paths, repository identifiers, counts or content. It records what was observed when checked and does not grant source approval or alter capability freshness. `progressWorkspace(report)` supplies the same plain-language explanation used by Get Ready and Init; CLI text output also includes it. Version 1 imports remain readable, with local-work status unknown. Older consumers that only validate version 1 must update before consuming a version 2 export.

Local edits or commits in the same workspace/repository/account/target do not complete failed setup. Read-only checks preserve that unfinished intent for inspection without retrying it. Selecting another account/repository/target remains a separate scope; the earlier project-skill review keeps its existing preservation rule. No files are committed, stashed, reset or removed by this observation.

## Source and licence

`SOURCE.json` identifies the repository revision and SHA-256 of each packaged input. Local uncommitted builds are labelled as development snapshots. The production deployment guard publishes clean pushed main. The archive includes only the reviewed core allowlist, this README, package metadata, MIT licence and source record; no environment files, receipts, customer data or credentials. MIT notices must be preserved. These are release provenance records, not a vendor endorsement or security certification.

## Read-only domain diagnosis

`get-ready --inspect-domain example.com --account SELECTED_ACCOUNT_ID` is a separate read-only mode. It requires an existing authorised Cloudflare API token in the runtime, with Zone Read and DNSSEC Read access for the selected zone. No workspace, receipt, DNS change, zone creation or setup operation is performed. Other operation flags cannot be combined. The exit status is nonzero if DNS does not match or a check is incomplete; stdout can still contain a valid portable report.

The equivalent API is `diagnoseDomain({account,domain}, authorisedEnvironment)`, exported from this package. `inspectDomainReport(report)` derives the same dated findings used by Composer’s local report viewer. Account/zone IDs, credentials and raw provider errors are excluded. Domain names, assigned/observed nameservers and public DS record values are included; review a report before sharing it. API credentials are sent only to fixed Cloudflare API URLs, never the public DNS resolver. Requests have time/body bounds, refuse redirects and never retry automatically.

The host selects an exact full-setup zone, not an inferred parent or registrar. Partial/secondary/multi-signer setups stay unsupported. A nameserver mismatch or old DS record requires agent review of existing DNS/email, security and migration order before any MP-approved change. Recursive DNS can be cached; this does not prove current parent delegation, worldwide propagation, cryptographic DNSSEC correctness or an HTTPS app. Results expire after an hour for display; reports never grant execution authority.

Official references reviewed 14 October 2026: https://developers.cloudflare.com/api/resources/zones/methods/list/ , https://developers.cloudflare.com/api/resources/dns/subresources/dnssec/methods/get/ , https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/ , https://developers.cloudflare.com/dns/dnssec/ .


## Inspect the actual output project

```sh
get-ready --inspect-project /absolute/selected/project --purpose emdash-site
```

Or import `inspectProject` from `@loftwah/get-ready` (also `@loftwah/get-ready/project`) and call `inspectProject({workspace: '/absolute/selected/project', purpose: 'emdash-site'})`. Purposes are `auto`, `emdash-site` and `emdash-plugin`; optional `diagrams: true` records a requested, unprobed diagram capability. In CLI form use `--diagrams`. This separate diagnostic refuses readiness/setup/credential flags, opens no private receipt and executes no project code, Git configuration, lifecycle script, compiler or network request. Exit zero means an inspection completed, not that a project is ready. Its report always has `ready: false`.

Fixed reads inspect package declarations and the presence of build/test/check command names, known lockfiles, AGENTS/PRODUCT/DESIGN/UNSLOP/architecture documents and three canonical `.agents/skills/*/SKILL.md` entrypoints. Entry files are bounded, symlinks/hardlinks and observed concurrent replacement are refused, and other files are not crawled. No file is written or replaced. The report omits absolute paths, file bodies, command text and remotes; keep it private because hashes and dependency metadata still describe a project.

`matches-reviewed` means only that one entrypoint equals the pinned official source recorded in `source`. It does not verify referenced files, the installed package version, runtime compatibility, a user/plugin copy, agent discovery, documentation access or actual use. `unmatched-preserve` can be an older scaffold or authored copy; preserve and inspect it before considering any update. Project-local absence is not absence from the agent: inspect existing user/plugin scopes before proposing installation. The site purpose needs site/CLI guidance; plugin purpose needs plugin/CLI guidance. WordPress porting and D2 remain conditional. No skills installer or capability certification is included in this diagnostic.

The optional repository MCP exposes the same function when the trusted host adds `--project-purpose emdash-site` to its existing absolute workspace launch arguments. `get_ready_project` accepts no model-selected scope or arguments, makes no provider calls and leaves check/inspect evidence untouched. The SDK transport stays separate from this dependency-free archive.

Official references reviewed 14 October 2026: [EmDash agent skills](https://docs.emdashcms.com/agent-skills/) and [documentation MCP](https://docs.emdashcms.com/docs-mcp/). Entrypoint metadata records the reviewed MIT skills repository revision; it does not establish permission to execute or overwrite project instructions.


### Read a project observation independently

`validateProjectReport(report)` and `inspectProjectReport(report)` are exported from the core and browser-safe `@loftwah/get-ready/project-report` entrypoint. They use the same findings and purpose rules as filesystem inspection. The strict versioned boundary refuses unknown/private fields, incompatible sources, unsafe paths, injected advice, inconsistent hashes/states and fabricated installed/visible/exercised/readiness claims. Inspecting derives a one-hour stale caution; readiness always remains false. Re-export with the matching current Get Ready version if a source/schema is incompatible.

MP can open the separate JSON report at https://composer.loftwah.com/ready#project-check . The local-only viewer never uploads or persists it; clear removes its displayed metadata. A fictional example explains the view before inspection. An imported timestamp, fingerprint or matching hash does not authenticate the report or establish current scope/permissions. Existing environment and domain report formats stay separate. The browser request handoff contains no imported report data.


## Prepare missing EmDash site skills

This explicit local operation prepares the complete reviewed `building-emdash-site` and `emdash-cli` trees, with their MIT notice, inside the selected project’s `.agents/skills/`. It supports an exact declared EmDash **1.2.0**, Node 22 and an active Codex workspace. In a Git checkout, select the repository root; nested project folders are refused rather than silently preparing their parent. Other versions, updates and global installs remain outside this operation; plugin guidance is a separate explicit purpose described below. Installed EmDash compatibility still needs checking.

The agent first reads the actual current task’s skill catalogue, including enabled plugins. Map applicable namespaced EmDash skills to their canonical IDs. Pass those observations explicitly; `none` means the agent checked and found none, not “skip checking”. Known project/ancestor `.agents/skills` and `.claude/skills`, user `.agents/skills` and `.codex/skills`, and the selected `CODEX_HOME/skills` are also checked for existing copies. Other runtimes/scopes require separate inspection. Existing, partial, linked or authored skill copies are preserved. Their presence does not establish that they work.

```sh
# Only after checking the current agent catalogue and selecting this project:
get-ready --workspace /absolute/selected/project --prepare-site-skills \
  --available-skills none --report
```

If the agent already advertises both skills, use `--available-skills building-emdash-site,emdash-cli`. Missing skills use the archive’s pinned official source at `15dcb07160fb321aab93fa67c6d0cbfc1c33e90f`; preparation performs no network download, package install, project script, global change, account connection or cloud mutation. It preserves existing instructions, content and dependencies. Every copied file is digest-checked, including references. A repeat compares the whole prepared tree and returns `changed:false`; different/partial copies stay intact for agent review. Interrupted preparation retains files; inspect them rather than deleting or retrying automatically.

The same engine operation is available to independent consumers:

```js
const state = await runLocalReadiness({
  workspace: '/absolute/selected/project',
  operation: 'prepare-site-skills',
  availableSkills: [], // Current agent catalogue was inspected; neither is advertised.
});
console.log(state.operation);
```

A trusted custom engine adapter implements `prepareSiteSkills(availableSkills, {skillPurpose})`. The package also exports `prepareSiteSkills({workspace, availableSkills, purpose})` for that local adapter. Do not treat imported reports or a saved inventory as permission to prepare files. The existing `get_ready_project` MCP remains read-only; it cannot install skills. The optional MCP transport exposes this same preparation separately only when its trusted host supplies both `--allow-site-skill-setup` and the current `--available-skills` inventory. Its zero-argument `get_ready_prepare_site_skills` cannot select an inventory or scope. See the transport README; ordinary checks never prepare skills.

A successful preparation is **action-required**, even if the environment checks pass. That unresolved review survives ordinary check/resume without reinstallation. There is no automatic discovery certification; `--cancel` discards the pending intent, never verifies the capability. Its private operation evidence distinguishes prepared trees, exact existing trees, preserved copies and agent-advertised skills. It always reports `ready:false`, `agentVisible:'not-probed'`, `exercised:false` and installed EmDash `not-probed`. The redacted environment report shows the remaining review step without exporting this private evidence.

Next, confirm discovery in the actual selected agent task, then exercise one relevant read-only task against current official documentation. A runtime may need to refresh its skill catalogue; EmDash’s Codex plugin instructions specifically require a new task after plugin installation. This project-file preparation does not install that plugin or automatically start another task. Capture the actual source and successful use separately before claiming this capability works. No copied file, caller inventory or Hello deployment proves it.

Source: [official EmDash skill guidance](https://docs.emdashcms.com/agent-skills/), reviewed 14 October 2026. The bundled unmodified text retains Cloudflare Inc.’s MIT notice in each prepared skill directory.

### Prepare plugin guidance in the selected EmDash project

For plugin work in the same supported exact-declared EmDash 1.2.0 / Node22 / active Codex project root, explicitly select `--prepare-site-skills --skill-purpose emdash-plugin --available-skills none` after inspecting the actual skill catalogue. The historical operation name stays compatible. `skillPurpose: 'emdash-plugin'` selects the same engine operation programmatically; the direct preparation API uses `purpose: 'emdash-plugin'`. The default remains `emdash-site` and does not add plugin guidance. Plugin purpose prepares only `creating-plugins` and `emdash-cli`; site purpose prepares only `building-emdash-site` and `emdash-cli`. Both include complete pinned references and MIT notices. Unsupported purposes refuse before writes; purpose without explicit preparation is refused.

This supports plugin work inside a project declaring EmDash 1.2.0, not an SDK-only plugin repository or arbitrary version. No plugin is installed or enabled in EmDash, and no plugin code runs. Existing custom/partial/user/parent/plugin-provided instructions stay intact; a different purpose is a separate explicit preparation, never a check-side retry. Prepared files remain pending discovery/use review. Read the creating-plugins skill and applicable references in a fresh selected agent task, consult official EmDash documentation, and inspect a small fictional hook or route without granting it more capability.


## Reuse an existing Wrangler sign-in for supported operations

Reviewed 15 October 2026. The local account-routing/HTTPS check and explicit supported target-preparation/deployment/version checks can reuse the existing OAuth identity selected by pinned workspace Wrangler **4.143.1**. It checks that identity's membership in the host-selected account, asks Wrangler for its current credential through `auth token --json`, then uses it only for the selected account/Worker operation. Read-only checks still never deploy. Account, Worker, hostname and current GitHub source must still match. This applies to the same library, CLI and local MCP check; it opens no login browser or consent flow.

An explicitly supplied `CLOUDFLARE_API_TOKEN` takes precedence, including an invalid/expired/denied selection: the check never retries under another identity. A missing workspace Wrangler remains agent setup; a missing login remains authentication; account mismatch remains configuration; provider 401/403 keep authentication/permission recovery. Key/email credentials are unsupported by this adapter. Host-selected Wrangler directory/profile state is used unchanged; Composer does not select or create profiles. Wrangler may refresh its own existing OAuth cache. Never paste or print the output of its credential command.

Wrangler subprocess stdout/stderr are captured and error bodies discarded. Its persistent debug logs and telemetry are disabled for these workspace invocations, including when caller environment settings request logging. Credentials remain transient in process memory for fixed Cloudflare requests; no credential enters a report, receipt, archive, browser or model response. Normal check progress is still saved locally. The separate workspace-free domain diagnostic still requires an explicit runtime API token; this is not account provisioning or an expansion of permission.

Official command behaviour: [Wrangler authentication commands](https://developers.cloudflare.com/workers/wrangler/commands/general/#auth-token). The pinned implementation's `WRANGLER_WRITE_LOGS=false` is enforced because its default logger would also persist credential JSON; this is a version-bound adapter safeguard, not a promise for other Wrangler releases.


For `prepare-reference-target`, one credential is selected before the fixed availability reads and local configuration write. For an explicitly authorised maintained/owned starter deployment or update, the guarded adapter selects one credential only after source/configuration review and keeps it for the entire operation. All existing source ownership, tracked-byte, previous-version, target-collision, current-main and post-upload HTTPS checks remain required. An expired or denied selection does not retry an upload or switch to another login. The existing native source/permission rechecks remain in place; the operation grants no broader application build authority.

Source/GitHub probes keep the original host environment. Tests and the dry-run build receive no resolved credential and an isolated temporary HOME/config directory, so cached user logins cannot supply an unintended identity. Only the pinned isolated upload receives the selected transient token through its process environment. It keeps that isolated HOME, captures output, and forces disk logging/metrics off. Temporary release files contain no credential; the original login cache is retained. This is an environment boundary for reviewed code, not a sandbox for arbitrary source.

This extends the existing library/CLI operations; it adds no MCP cloud-write tool. The complete real OAuth consent/refresh/upload journey remains a separate acceptance gate until observed in an authorised customer/runtime. Focused OAuth adapter fixtures and a pinned fictional credential-command check do not substitute for that evidence. Existing API-token deployment and actual source/HTTPS verification retain their own measured release evidence.
