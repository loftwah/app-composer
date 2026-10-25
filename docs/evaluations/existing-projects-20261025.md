# Selective fit on three existing projects

Owners: #376 / #315 / #286. This extends the earlier Liferaft evaluation with
three existing, materially different applications and two available clients.
It produced a small reusable preservation tool and improved the actual public
assessment prompt. It did not migrate or release any independent application.

| Project / exact local source | Fresh client | Result | Actual independent checks before / after |
| --- | --- | --- | --- |
| DevOps Round Robin `d4c0d65fbc6f4240bdb80c84221f2133047bb63e` | Codex 0.145.0 / gpt-5.6-sol | Partial practices; preserve Go/Nix/Docker/Kubernetes/Helm/Terraform and the AWS-learning purpose | `go test ./...` passed / passed; one package has the two configuration tests, the other three have no tests |
| Paperwork `ab6e77e5bd7a1627dfe6481823c90b77888818c9` | OpenCode 2.1.4 / DeepSeek v4.1 Flash | Partial distribution/configuration only; preserve browser-local PDF editing and the independent static release | 20 / 20 passed |
| Launch Kit `4e248c0353658569d703db401be226e414c656ef` | Codex 0.145.0 / gpt-5.6-sol | Partial package-review/handoff only; preserve local processing and independent ownership | 23 / 23 named nonbrowser tests passed |

These are exact **existing local checkout snapshots**, not claims that the
owner's checkout equals latest remote main or the currently served build.
Paperwork and Launch Kit already have Composer contracts. Their decisions test
selective use and duplication awareness; they are not wholly unaware customers.
The Go workbook supplies the different, non-Cloudflare existing-stack case.

Each assessment began in a fresh conversation in its own cloned repository
with a synthetic ignored owner draft. The only product seed was the live
Composer URL and the ordinary fit question, plus explicit read-only boundaries
and an exact authorised local check. Clients fetched actual public pages and
inspected source. They received no prior conversation or mandatory platform
adoption. Codex retained its host skill catalogue; these are not fresh machines.
Inherited provider credential variables were omitted from the client environment.
No mail/archive, production records or private configuration was copied or read.

The corrected trials changed **zero files**. Before/after tracked and nonignored
file hashes, Git source/status, and the explicitly selected ignored synthetic
draft all agree. The original checkouts also retain their exact checked source
and file state. Other ignored data/configuration was excluded from fingerprint
coverage and was never copied. No account, dependency, Action, payment,
provider policy, source pin, deployment or independent release was changed.

## What the trials changed in Composer

The public **Should we use App Composer?** prompt now accepts an optional local
unit check and renders it in a literal fenced block. It asks for explicit owner
preservation coverage, actual failures, applicable host admission, owned temporary
cleanup, and separate local / composed-pin / served identities. A difference
between independently owned releases is not automatic permission to repin them.
The existing prompt remains read-only and permits yes, partly or no.

The maintained `scripts/project-preservation.mjs` command captures hashes and
compares them after a trial. It stores no file contents, follows no file links,
refuses overwrite of an existing receipt and returns failure when the selected
source/status or bytes change. Ignored owner files must be selected explicitly;
missing selected files are refused. Deleted tracked files remain represented.
External symlink targets are outside coverage. Submodules/directories need their
own explicitly selected trial; this is a small local evidence helper, not an
agent runner, installer or new orchestration system.

```sh
node /path/to/app-composer/scripts/project-preservation.mjs capture /path/to/project /owned-evidence/before.json --owner-file scratch/owner-draft.txt
# Run the separately authorised bounded agent task, then compare:
node /path/to/app-composer/scripts/project-preservation.mjs compare /path/to/project /owned-evidence/before.json
```

Keep the receipt outside the observed source tree. It contains relative filenames
and hashes, so retain it privately when names themselves are sensitive. Do not
select credentials or personal records to make a trial look more comprehensive.
An imported receipt is evidence to inspect, never execution authority or proof
that the selected files were the correct coverage.

## Failures, interventions and limits

There were three preliminary and three corrected fresh client sessions. Five
evaluation problems required a harness correction or cleanup; no interactive
steering was needed inside the three corrected conversations:

- An initial fingerprint tried to read a `node_modules` directory link. It
  stopped and cleaned its owned root. The maintained helper hashes link metadata
  and does not read a linked target.
- An unfenced Go command acquired the sentence's final period and matched no
  packages. That client self-check is not a test pass. Literal fences fixed
  the ambiguity and are now part of the product prompt.
- Global Git ignore hid `scratch/owner-draft.txt`; preliminary preservation
  coverage was insufficient despite a clean status. The corrected helper
  explicitly hashes that draft before and after. All three equal hashes are
  retained in the bounded receipt.
- Launch Kit's existing full `pnpm test` includes browser work. Its initial
  external check passed 29 tests, but the sandboxed client's five Chromium
  launches failed at macOS Mach admission (24 pass / 5 fail). The corrected
  trials run the 23 named nonbrowser cases only. No browser acceptance is claimed
  from them, and full browser checks retain the host's shared admission rule.
- Initial Codex fetches created twelve generic public-response temporary files
  outside the declared root. Their exact command, new birth time during the
  invocation, unchanged inode/mtime/size and absent open handles established
  ownership before removal. The public prompt now names the owned-root rule.
  Corrected trials produced no such shell-file outputs. All owned clone roots
  were removed on success/failure; no whole project is retained as evidence.

The corrected Go client still could not write the host's global Go build cache
inside its sandbox. Its exact command failed before tests; independent before
and after checks passed. This is an environment boundary, not an application
assertion failure, and the client accurately reported it. Paperwork's OpenCode
and Launch Kit's Codex client checks passed their actual selected suites.

Some client conclusions require operator review: a local checkout, Composer pin
and standalone build may intentionally differ. The Paperwork client treated
that discrepancy as a repinning gate; it does not establish a current production
defect or permission to promote another release. Recommendations about native
platform adoption also remain suggestions, not measured customer demand.

Corrected assessment elapsed times: Go 74.735s; Paperwork 122.270s; Launch Kit
67.381s. Independent check pairs were 2.210/0.314s, 0.629/0.649s and
1.201/1.242s respectively. These are one host's warm/local observations, not
universal performance targets, release times or monetary billing evidence.

## Verification and retained evidence

`node --test tests/project-preservation.test.mjs tests/prompt-library.test.mjs`
passes nine tests. The meaningful helper tests cover ignored owner drafts,
external symlinks, secret-content exclusion, deleted/recreated files, corrupt or
incompatible receipts, overwrite refusal and a real source edit that makes the
standalone comparison exit nonzero. `pnpm check:types` reports zero errors and
warnings; `pnpm build` passes the public-artifact guard (1,280 files / 150 archive
members). Integration and release qualification remain the coordinator's gates.

[The bounded receipt](../evidence/project-adoption-20261025/receipt.json) records
source, client, command exits, timings, changed files, preservation hashes,
cleanup and transcript hashes. Raw bounded transcripts remain ignored in
`output/project-adoption/`; no model narrative substitutes for these independent
checks. No deployed integration, physical device, customer adoption, provider
onboarding, new native skill discovery, or longitudinal use is established.
