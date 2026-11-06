# Dependency freshness

`pnpm freshness` reports whether the stack Composer actually installs still sits
inside the versions this repository has reviewed. It answers one question: *is a
declared dependency outside the range we support?* It does not ask a registry
what the newest release is.

```sh
pnpm freshness          # human table, exit code below
pnpm freshness --json   # same report for scripts
pnpm freshness:remote   # explicit registry comparison; writes config/dependency-remote.json
```

```text
Dependency freshness (policy reviewed 2026-11-06)

  name                          current       supported                              status
  node                          22.23.4       >=22.23.4 <23 || >=24.22.1 <25 || ...  ok
  pnpm                          12.8.1        12.8.1                                 ok
  astro                         7.4.5         ^7.4.5                                  ok
  @tanstack/react-router        1.163.2       1.163.2                                 ok
  emdash                        1.4.0         ^1.4.0                                  ok

Summary: 27 ok, 0 drift, 0 unknown, 0 unresolved
```

## What it reads

| Input | Role |
| --- | --- |
| `package.json` | The declared dependencies and the `packageManager` pin. |
| `pnpm-lock.yaml` | The resolved version for each declared dependency. |
| `node_modules/<name>/package.json` | The version actually installed, when present. |
| `config/dependency-policy.json` | The reviewed supported range for each package and runtime. |

The command reads only those files. It makes no network request, starts no child
process and reads no environment credential or secret, so it works on a clean
checkout and offline. `current` is the installed version when it can be read and
the locked version otherwise; `supported` is the policy range; `unknown` means
the dependency has no policy entry at all.

## Explicit remote comparison

`pnpm freshness:remote` is the opt-in network mode. It compares each locked
version with the official npm registry, then writes the dated report to
`config/dependency-remote.json` for the native EmDash **Stack status** page. It
sends only public package names and locked versions, plus the same names in the
anonymous bulk-advisory query. It never sends paths, project data, environment
values or credentials, and it cannot install, update or deploy anything.

The classifier keeps the useful questions separate:

| Signal | Meaning |
| --- | --- |
| `security-urgent` | The registry advisory response names the locked version. |
| `unsupported` | The locked version or runtime is outside the reviewed policy. |
| `breaking-major` | A newer major exists; plan compatibility work separately. |
| `feature-opportunity` | A newer minor exists inside the same major. |
| `compatible-patch` | A newer patch exists inside the same major. |
| `current` | The registry latest matches the locked version. |
| `unknown` | Metadata, advisories or the registry itself could not be trusted. |

A newer patch or minor is shown as an available release, not a warning. The
Stack status page raises a blocker only for a security advisory, an unsupported
deployed version, a breaking major or an unknown registry comparison. A missing,
malformed, mismatched, slow or unreachable registry response becomes `unknown`
with the reason; it never invents a `latest` value. Timeouts and retries are
bounded, and remote mode exits `4` only when a security advisory affects a locked
version. An ordinary `pnpm freshness` run remains offline and unchanged.

The committed registry report is deliberately dated. If it is older than 14 days
the native page shows `unknown`, not a stale latest value. Generate a fresh report
before a dependency review and commit it with the policy decision.

Supported ranges use the ordinary npm reading of `*`, an exact version, `^`,
`~`, `>=`, `<=`, `>`, `<`, space-separated AND and `||`. A bare `7` or `7.4` is
accepted where padding with zero means the same thing; a range the command
cannot read is refused instead of guessed.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Every declared dependency and runtime is covered and inside its supported range. |
| `1` | A covered dependency resolved outside its supported range, or its version could not be resolved. |
| `2` | A declared dependency has no policy entry. |
| `3` | The policy, lockfile or manifest could not be used. |
| `4` | Remote mode found a security advisory affecting a locked version. |

`2` wins over `1` so an uncovered dependency is never hidden behind a drift
report.

## Changing the policy

`config/dependency-policy.json` is reviewed state, not an allowlist to widen when
a report is inconvenient. Moving an entry means the same work as the upgrade
itself: read the release notes, run `pnpm check` and `pnpm build`, and record the
reason when the range is deliberately narrow. Two entries carry that reason
today: `@tanstack/react-router` is pinned because `@emdash-cms/admin` pins the
same exact version and a floating upgrade splits TanStack's React context, and
`typescript` stays on 6 because `@astrojs/check` peers on `^5 || ^6`.

The `node` row is the runtime you are actually running, so it drifts whenever the
local Node is not one of the reviewed lines. That is the intended signal. On
Node 24 or Node 26 the report stays `ok`; an unsupported line shows `1 drift`
for that row alone. The decision, the evidence and the conditions for moving the
line are in [the Node runtime decision](node-runtime.md).

## Boundaries

- The command is not part of `pnpm check`. A new upstream release should not fail
  an unrelated pull request; the report is a maintenance signal you run on
  purpose. `tests/freshness-policy.test.mjs` and
  `tests/freshness-remote.test.mjs` keep the parser, exit codes, registry
  handling and committed policy honest.
- A green report does not mean the stack is current, only that it is still inside
  the reviewed window. It is not a vulnerability scan either; `pnpm audit` covers
  advisories, and the reviewed overrides live in `pnpm-workspace.yaml`. The remote
  mode's advisory lookup is a dated observation, not continuous monitoring.
- `package.json` pins important dependencies exactly. A green report therefore
  proves the installed version matches the reviewed one; it says nothing about
  releases the team has not reviewed.
- The native **Stack status** page is generated at build time from this policy,
  the lockfile, local install metadata and the committed registry report. It is
  read-only, makes no registry call and cannot change a pin or deploy anything.
- Dependency choices that are deliberately held are recorded in the lane's pull
  request and in the owning issues (#321, #316, #175), not inferred from this
  command.
