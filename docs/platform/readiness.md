# Inspect an existing internal platform

Get Ready’s **Internal platform** path checks the existing installation through
the signed-in EmDash session. Choose the intended team, then select **Check
current setup**. A workspace in the address is a selection, never an access
grant. Invalid, repeated, unavailable or mismatched selections are refused rather
than replaced with a personal workspace.

The check reads current membership, the saved standing policy, scoped stack
inventory and the host-selected app connection. It confirms the account and
runtime only when the server supplies them. Older installations display **Not
observed**. The runtime is the existing Guestbook service; synthetic preview
intent does not establish isolated staging infrastructure.

The next step depends on the observation:

| Observed state | Supported next action |
| --- | --- |
| Empty workspace, no policy | An authorised operator/owner opens the protected policy setup. |
| Existing stacks, no policy | Preserve existing ownership. Review teams and select a separate empty workspace; adoption is still unsupported. |
| Paused or unsupported policy | The operator reviews its intended scope. |
| Missing app connection | Restore the existing connection; retain pending request identities. |
| Own unfinished request | Inspect and reconcile the existing operation before creating another request. |
| Enabled supported policy | An authorised editor requests using the team’s defaults; a viewer receives a reading action. |

Checks create no app or provider resource and write no saved individual draft.
Preparation, request submission, execution and observed completion remain
separate. The protected server rechecks current authority, policy, quota and
applicable approval for the action. Setup observations expire after five minutes
in this interface; the request server remains authoritative even within that
window. Changing account or workspace clears the displayed observation.

## Reusable observation

The dependency-free Get Ready core exports `platformObservation`,
`validatePlatformReport` and `inspectPlatformReport` through its main entry and
`@loftwah/get-ready/platform`. The browser projects the validated native response
into `app-composer.platform-observation`, version 1. It excludes request content,
login identities, resource identifiers, private exports, logs and credentials.
The optional setup snapshot is additive; existing environment report version 2
and private session formats are unchanged.

**Download private setup observation** exports selected workspace/account facts,
policy revision and own resumable request IDs. Treat the file as private. It is
neither a credential nor a readiness/preparation receipt. The installed CLI can
inspect that downloaded observation offline:

```sh
get-ready --inspect-platform /absolute/path/platform-observation.json
```

The same assessment powers the page and CLI. CLI output explicitly records
`mode: offline-observation`, `liveAccessChecked: false` and `ready: false`.
Imported timestamps and claims never grant live access or execute setup. The CLI
rejects mixed setup flags, linked/non-ordinary or oversized files and unknown
fields without echoing their content. No credential, session or readiness
directory is created.

The explicit member reader is tried first. Only a missing endpoint with HTTP 404
uses the first release’s creator reader. A denial, redirect, invalid response or
changed workspace never triggers that fallback. The native role and workspace
capability still decide whether reading is permitted.

Focused verification:

```sh
node --test tests/readiness-platform.test.mjs tests/readiness-state.test.mjs tests/core.test.mjs tests/readiness-report.test.mjs
```

These checks establish data/CLI behaviour, not authenticated browser or
production acceptance. Exact integrated source, native-session observations,
release checks and remaining gates belong in [issue #11](https://github.com/loftwah/app-composer/issues/11).
