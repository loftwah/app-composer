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

The host retains authorised tools and credentials; this is not a sandbox for arbitrary source. One check runs at a time. Cancellation clears the cached result and does not force-stop an underlying bounded check or undo private progress. Full setup remains an explicit agent-operated library/CLI journey. A protocol connection is not a verified customer environment, actual agent entitlement or acceptance in a particular native MCP host.

## Source and recovery

`SOURCE.json` hashes every packaged input and records the exact Composer source revision. `lib/get-ready/SOURCE.json` records the same core snapshot as the standalone core archive. Preserve MIT notices. SDK dependency licences are installed with those packages. Core usage and setup boundaries are in `lib/get-ready/README.md`.

If the host cannot start the server, check its Node22 executable, absolute server path, dependency installation and explicit workspace privately. Invalid launch arguments fail without echoing private input. Reconnect to recheck; stale or imported reports grant no authority. Stop the host connection and remove its configuration through that host’s controls to disconnect. Uninstall the package through your integration folder’s package manager if no longer needed; private workspace receipts and cloud resources are not deleted by this package.

Official sources: https://github.com/modelcontextprotocol/typescript-sdk and https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server .
