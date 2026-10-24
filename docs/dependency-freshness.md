# Dependency freshness

`pnpm freshness` reports whether the stack Composer actually installs still sits
inside the versions this repository has reviewed. It answers one question: *is a
declared dependency outside the range we support?* It does not ask a registry
what the newest release is.

```sh
pnpm freshness          # human table, exit code below
pnpm freshness --json   # same report for scripts
```

```text
Dependency freshness (policy reviewed 2026-10-24)

  name                          current       supported      status
  node                          22.23.4       >=22.23.4 <23  ok
  pnpm                          12.8.1        12.8.1         ok
  astro                         7.4.2         ^7.4.2         ok
  @tanstack/react-router        1.163.2       1.163.2        ok
  emdash                        1.3.1         ^1.3.1         ok

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

## Boundaries

- The command is not part of `pnpm check`. A new upstream release should not fail
  an unrelated pull request; the report is a maintenance signal you run on
  purpose. `tests/freshness.test.mjs` keeps the parser, the exit codes and the
  committed policy honest.
- A green report does not mean the stack is current, only that it is still inside
  the reviewed window. It is not a vulnerability scan either; `pnpm audit` covers
  advisories, and the reviewed overrides live in `pnpm-workspace.yaml`.
- `package.json` pins important dependencies exactly. A green report therefore
  proves the installed version matches the reviewed one; it says nothing about
  releases the team has not reviewed.
- Dependency choices that are deliberately held are recorded in the lane's pull
  request and in the owning issues (#321, #316, #175), not inferred from this
  command.
