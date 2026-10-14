# Get Ready MCP

Reviewed 14 October 2026. The optional local stdio transport exposes the same Get Ready engine to an authorised MCP host without a Composer source checkout, EmDash or Woodhouse. The archive includes an exact source snapshot of the dependency-free core, not a second readiness implementation. The transport adds the official MCP server SDK2.3.1 and Zod4.6.7 as runtime dependencies. It does not host an API or register itself in any agent.

## Install and select a workspace

Download the archive and matching source/checksum manifest from https://composer.loftwah.com/docs#local-get-ready-mcp . Check the archive SHA-256, review `SOURCE.json`, this README and the bundled source. The checksum detects mismatch; it is not an independent signature. This is a release archive, not npm registry publication.

In a separate local integration folder authorised for this purpose, use Node22:

```sh
npm install --ignore-scripts --no-audit --no-fund ./get-ready-mcp.tgz
```

Unlike the core archive, this install needs access to an approved npm registry for SDK dependencies (or an already populated cache). Keep the generated package lockfile and review its resolved dependencies before enabling the server. Installation does not start the server, configure a host, sign in or prepare your development environment.

Point your host’s supported local stdio configuration at the absolute installed executable and an explicit workspace:

```sh
/absolute/integration/node_modules/.bin/get-ready-mcp --workspace /absolute/authorised/project
```

Use the host’s own configuration format; this command is the server executable, not a client and not a command that prints a completed report. Its stdout is exclusively MCP messages. Keep secrets out of launch arguments and host configuration examples; use the host’s approved runtime credential handling. Review the selected host and workspace before enabling it. No configuration file is modified automatically.

The host may additionally select the known `--account ACCOUNT_ID --reference-worker WORKER --reference-url HTTPS_ORIGIN --reference-repo OWNER/REPO`. Missing target selections remain incomplete; there is no operator-account fallback. `--tools-workspace ABSOLUTE_PATH` reuses a separately prepared reviewed tool pair. `--project-purpose emdash-site` enables bounded project inspection. `--domain example.com --account ACCOUNT_ID` enables read-only domain diagnosis using already authorised scopes. Tool calls accept no model-selected paths, targets, setup commands or credentials.

## What the tools do

- `get_ready_check` rechecks the fixed environment through the shared doctor and saves private progress in the selected workspace. It returns only a redacted dated report. It does not install, authenticate, create repositories, change DNS, deploy or retry setup.
- `get_ready_inspect` reads this connection’s last completed redacted result. It makes no provider calls and does not open a different receipt.
- `get_ready_project`, when enabled by the host, reads fixed project metadata and preserved skill entrypoints without writes or project execution. Matching files do not prove agent discovery/use.
- `get_ready_domain`, when enabled by the host, reads the exact selected Cloudflare zone, nameservers and DNSSEC/DS observations. It does not change DNS or prove global propagation/HTTPS.

The host retains authorised tools and credentials; this is not a sandbox for arbitrary source. One check runs at a time. Cancellation clears the cached result and does not force-stop an underlying bounded check or undo private progress. Other setup steps remain an explicit agent-operated library/CLI journey. A protocol connection is not a verified customer environment, actual agent entitlement or acceptance in a particular native MCP host.

## Optional workspace tool preparation

Default launches expose no setup tool. Only a trusted host already authorised to prepare local tools may add `--allow-workspace-tool-setup` to the server launch. The programmatic scope equivalent is the boolean `allowWorkspaceToolSetup: true`; tool calls cannot enable it. This exposes the separate zero-argument `get_ready_prepare_tools` tool and invokes the existing core `install-workspace-tools` operation.

The supported operation requires active Codex on Apple Silicon macOS, Node22 and Git. Select the actual repository root, or an existing folder outside Git; a nested project is refused before parent-workspace writes. The installer checks usable existing tools first, otherwise downloads only the fixed verified GitHub CLI/pnpm pair into the selected workspace’s `.private/workspace-tools`. It preserves existing/partial copies, authored files and user profiles. It does not install global tools or skills, authenticate, create a repository, change DNS, create cloud resources or deploy.

The explicit tool response adds a bounded `preparation` result with its operation/state and, on completed preparation, whether files changed and whether tools came from the workspace or existing environment. This sits beside the ordinary readiness report; completed work does not enter that report’s unfinished-operation list. A failed/partial action does not claim that files were unchanged. Preparation alone does not prove GitHub access, Cloudflare access or HTTPS.

A completed workspace pair is reused by ordinary checks on this connection. Checks never retry setup. After reconnecting, explicitly select the prepared folder with `--tools-workspace /absolute/authorised/project`, or make a separate authorised preparation call to verify/reuse the existing pair. Cancellation can leave partial/completed local work and private progress; inspect it before explicitly retrying. It keeps other operations blocked until the bounded underlying call finishes, and never enables cached selection from a cancelled result.

To remove this capability, stop the connection and remove the allow flag from the host’s launch configuration. The package never changes that configuration itself. Existing tools, receipts and cloud resources are retained.

## Optional EmDash site guidance

Use this for an exact declared EmDash1.2.0 project on Node22 in an active Codex workspace. First inspect the selected task’s actual enabled skill catalogue, including plugin skills, and preserve existing guidance. Map applicable namespaced skills to `building-emdash-site`, `emdash-cli` or `creating-plugins`. The host must supply that current inventory and explicitly authorise this local preparation:

```sh
/absolute/integration/node_modules/.bin/get-ready-mcp \
  --workspace /absolute/authorised/emdash-project \
  --allow-site-skill-setup --available-skills none
```

`none` means the current catalogue was checked and none of those skills is advertised. When applicable skills are available, supply their canonical IDs as a comma-separated list, for example `--available-skills building-emdash-site,emdash-cli`. The allow flag without an inventory, or an inventory without the flag, is refused. The API equivalent is `allowSiteSkillSetup: true, availableSkills: []` after that observation. This is host authority for the selected local preparation, never an inventory chosen by a model tool call or an imported report.

The zero-argument `get_ready_prepare_site_skills` invokes the existing core `prepare-site-skills` operation. It adds only missing complete pinned official site/CLI trees, references and MIT notices in the selected root’s `.agents/skills`. It checks known project/ancestor/user scopes, including an explicitly selected `CODEX_HOME`, and preserves existing, partial, custom and agent-advertised copies. It performs no remote installer, package install, project execution, account connection, global edit or cloud deployment. The regular readiness checks still run with the host’s existing scope; this operation grants none of their missing permissions.

Its bounded preparation result records state and, on completion, `changed` and the pinned public source commit. Paths, skill bodies, raw inventory and private evidence are excluded. The report retains a prepared review and `ready:false`. An ordinary check never retries installation or certifies discovery/use. Cancellation can leave completed or partial files; inspect those before an explicit retry. Stop the connection and remove both flags to disable preparation; existing files stay intact.

After preparation, refresh the catalogue in a fresh task for **that project**. Confirm both relevant skills are enabled and resolve to the intended preserved or prepared copies. Ask that task to apply the skills to a small read-only review: inspect the actual schema and published-content query, consult current official documentation, and check the installed CLI’s help without running content mutations. Record discovery and actual use separately from preparation. CLI content creation publishes by default unless `--draft` is supplied. Do not use a help banner alone to establish the installed version: the tested EmDash1.2.0 package’s banner reported `v0.0.0`; inspect installed package metadata and lock/source identity separately.

On 14 October 2026, a fresh native Codex CLI0.145.0 inventory found neither skill in an isolated fictional generated EmDash project. The independently installed production core prepared the trees, a new native inventory discovered both as enabled project skills, and a fresh read-only Codex task used their references, official documentation and installed CLI help to review the collection, publication filter and draft flag. Source and saved host configuration were unchanged by the review. This proves that local Codex path; desktop/IDE plugin discovery, other runtimes, complete environment readiness and customer deployment remain separate checks.

## Optional maintained starter acquisition

A host already authorised to fetch the public Hello starter may add `--reference-destination /absolute/authorised/new-hello` to its launch. The programmatic scope is `referenceDestination`. This enables only zero-argument `get_ready_clone_reference`, invoking the existing core `clone-reference` operation. Model calls cannot choose another destination, repository or revision. The default launch exposes no acquisition tool; removing the destination and reconnecting disables it without deleting files.

Select an absent destination whose parent already exists, or an unchanged checkout of the actual maintained Hello main. The operation requires supported active agent tools and a fresh GitHub source read through the authorised local CLI. Git acquisition uses an isolated environment without service credentials or user hooks. Existing, modified and partial copies are preserved; only a verified unchanged checkout can return `changed:false`. Private progress can retain unfinished intent. An ordinary check never retries acquisition.

The bounded `preparation` result names `clone-reference`, its state and, on completion, `changed` plus the exact public source commit. It excludes the destination and raw evidence. Failed/partial work does not claim unchanged files. Acquisition neither installs project dependencies nor executes project code, creates a personally owned repository, authenticates, configures DNS or deploys.

The current connection keeps checking its original workspace. To inspect or prepare the acquired checkout, stop and have the host explicitly select it as `--workspace`; if tools were prepared elsewhere, also select that folder with `--tools-workspace`. A parent receipt is not readiness for the acquired checkout. Subsequent ownership, dependency preparation and deployment require their existing separately authorised library/CLI operations. Cancellation can leave a completed/partial checkout; inspect it before a separate retry.

## Source and recovery

`SOURCE.json` hashes every packaged input and records the exact Composer source revision. `lib/get-ready/SOURCE.json` records the same core snapshot as the standalone core archive. Preserve MIT notices. SDK dependency licences are installed with those packages. Core usage and setup boundaries are in `lib/get-ready/README.md`.

If the host cannot start the server, check its Node22 executable, absolute server path, dependency installation and explicit workspace privately. Invalid launch arguments fail without echoing private input. Reconnect to recheck; stale or imported reports grant no authority. Stop the host connection and remove its configuration through that host’s controls to disconnect. Uninstall the package through your integration folder’s package manager if no longer needed; private workspace receipts and cloud resources are not deleted by this package.

Official sources: https://github.com/modelcontextprotocol/typescript-sdk and https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server .
