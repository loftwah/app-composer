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

Use actual validated account/repository/origin values. With no `operation`, this performs checks and saves private progress only. The exported report omits the private evidence. `createReadinessSession`, `runReadinessSession` and `inspectReadiness` expose the same engine to an explicitly trusted adapter with the four supported checks. The host controls capabilities; imported reports never grant execution authority. `@loftwah/get-ready/report` validates and inspects redacted reports; `@loftwah/get-ready/preferences` carries bounded address intent, not readiness proof.

The optional local MCP adapter remains a separate thin transport in the source repository with its own SDK dependencies. It is not bundled here. This package opens no network listener and does not expose a hosted API. It makes provider calls only when a selected check/operation needs them. Read the source and supported boundary before integrating.

## Source and licence

`SOURCE.json` identifies the repository revision and SHA-256 of each packaged input. Local uncommitted builds are labelled as development snapshots. The production deployment guard publishes clean pushed main. The archive includes only the reviewed core allowlist, this README, package metadata, MIT licence and source record; no environment files, receipts, customer data or credentials. MIT notices must be preserved. These are release provenance records, not a vendor endorsement or security certification.

## Read-only domain diagnosis

`get-ready --inspect-domain example.com --account SELECTED_ACCOUNT_ID` is a separate read-only mode. It requires an existing authorised Cloudflare API token in the runtime, with Zone Read and DNSSEC Read access for the selected zone. No workspace, receipt, DNS change, zone creation or setup operation is performed. Other operation flags cannot be combined. The exit status is nonzero if DNS does not match or a check is incomplete; stdout can still contain a valid portable report.

The equivalent API is `diagnoseDomain({account,domain}, authorisedEnvironment)`, exported from this package. `inspectDomainReport(report)` derives the same dated findings used by Composer’s local report viewer. Account/zone IDs, credentials and raw provider errors are excluded. Domain names, assigned/observed nameservers and public DS record values are included; review a report before sharing it. API credentials are sent only to fixed Cloudflare API URLs, never the public DNS resolver. Requests have time/body bounds, refuse redirects and never retry automatically.

The host selects an exact full-setup zone, not an inferred parent or registrar. Partial/secondary/multi-signer setups stay unsupported. A nameserver mismatch or old DS record requires agent review of existing DNS/email, security and migration order before any MP-approved change. Recursive DNS can be cached; this does not prove current parent delegation, worldwide propagation, cryptographic DNSSEC correctness or an HTTPS app. Results expire after an hour for display; reports never grant execution authority.

Official references reviewed 14 October 2026: https://developers.cloudflare.com/api/resources/zones/methods/list/ , https://developers.cloudflare.com/api/resources/dns/subresources/dnssec/methods/get/ , https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/ , https://developers.cloudflare.com/dns/dnssec/ .
