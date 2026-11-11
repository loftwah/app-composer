# Public prompt library

`/prompts` is a public task desk. Choose a job, enter a safe project reference and
the requested outcome, inspect the preview, then copy or download it. It makes
no model calls and performs no provisioning or privileged action.

`src/lib/prompt-library.ts` owns the module metadata, prerequisites and renderer.
The resource kit consumes the same `renderPrompt(id, values, { template })`
result. Setup/check/resume import the existing `readyTasks` handoffs directly;
the library is not a second setup engine. Content-model and composition jobs
link to the real Init editor and require its validated specification.

## Maintenance tasks

The library includes the project health pass and all 22 maintenance playbook
entries. `src/lib/maintenance-prompts.ts` owns the additional task definitions
and `maintenancePromptSourceMap`; `promptModules` includes them in the existing
registry. The same renderer supplies the page preview, clipboard and Markdown
download. Existing tasks and fragment links remain available.

New maintenance tasks start with assessment and reporting. The optional
**Changes already authorised** field describes the user's existing change
authority; leaving it blank keeps the task read-only. A proposed fix is not a
verified fix, and preparing or copying a prompt does not run an agent. Tasks
adapt to the selected project's actual stack, commands and release policy.

The source mapping deliberately reuses the incident, verification and operating
kit tasks where they already cover the requested work. The instruction task
combines repairing AGENTS.md with removing instruction overload.

| Source | Job | Public task |
| --- | --- | --- |
| H0 | Project health pass | `/prompts#health` |
| 1 | Find a serious bug | `/prompts#find-bug` |
| 2 | Investigate a specific error | `/prompts#incident` |
| 3 | Repair failing checks | `/prompts#fix-checks` |
| 4 | Review recent regressions | `/prompts#regressions` |
| 5 | Remove confirmed unused code | `/prompts#remove-unused` |
| 6 | Simplify unnecessary complexity | `/prompts#simplify` |
| 7 | Review dependencies and runtime support | `/prompts#updates` |
| 8 | Measure and improve performance | `/prompts#performance` |
| 9 | Exercise the actual user journey | `/prompts#verify` |
| 10 | Review accessibility | `/prompts#accessibility` |
| 11 | Review security boundaries | `/prompts#security` |
| 12 | Check retries, races and data integrity | `/prompts#data-integrity` |
| 13 | Inspect data-access/query waste | `/prompts#query-performance` |
| 14 | Align documentation and product claims | `/prompts#docs-check` |
| 15 | Find unfinished work | `/prompts#unfinished` |
| 16 | Independently review a change | `/prompts#review` |
| 17 | Verify delivery | `/prompts#verify` |
| 18 | Repair project instructions | `/prompts#instructions` |
| 19 | Verify skill discovery and use | `/prompts#skill-check` |
| 20 | Capture a useful reusable skill | `/prompts#capture-skill` |
| 21 | Reduce instruction overload | `/prompts#instructions` |
| 22 | Prepare the project's agent workflow | `/prompts#operating-kit` |

For source 22, `/prompts#setup` and `/prompts#local-agent` remain the relevant
companions when the environment or a supported connection also needs work.
The catalogue does not enable recurring tasks, connect an executor or change
Get Ready/Init specifications. Optional selections and supported execution
remain tracked by #428, with scheduling in #289 and agent access in #311.

## Local details and exports

Each job has a stable fragment such as `/prompts#change` or
`/prompts#incident`. Links contain only the module ID. Search and job navigation
retain typed details in memory. The project reference is reused across otherwise
untouched modules. No field values are sent to analytics or encoded in URLs.

Saving is an explicit **Save details on this device** action. Restore replaces
the prompt library's current entries with its versioned, validated saved data;
Clear removes only prompt-library entries from the tab and its own local-storage
key, `composer:prompt-library:v1`. Existing Init drafts are never read or written.
Do not enter keys, passwords or private customer records. Browser storage remains
available to other scripts on the same origin and people using that browser.

**Copy completed prompt** checks required fields and focuses the first missing
answer. **Copy template** explicitly displays and copies the bracketed template.
The preview is the copied text. Clipboard failure exposes a labelled selectable
textarea. Without JavaScript every complete template remains readable and can
be selected manually. Markdown download uses the completed renderer output.

Admin, authentication, webhook and commerce modules use **Assess and prepare**
where runtime/provider qualification is incomplete. Their presence does not
claim that a connector exists, that mail was delivered, or that a payment or
fulfilment occurred. Resource examples and agent prompts never grant authority.

Focused verification:

```sh
node --test tests/fast-delivery-prompt.test.mjs
```

This retained check protects the existing delivery prompt. For maintenance
changes, exercise the affected task through search/direct link, completed
preview, copy/download and save/restore as applicable. Check that missing
required context is reported and that default assessment prompts remain clear
about change authority. Use the current project release policy for integrated
checks and the affected phone/desktop journey. Production and provider
acceptance remain separate from source or local-browser evidence.
