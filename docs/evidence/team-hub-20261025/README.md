# Team Hub native local journey — 25 October 2026

This evidence exercises actual installed EmDash 1.3.1 and Composer application
code in an owned local preview fixture. It is not production or provider policy
acceptance. No production grants, users, content or IdP configuration changed.

The runtime began at source `eb88b9efddf500e95b1f7019944ef6864fd7b9af` with one
working-tree cleanup: removing the unused `teamHubWorkspace` import. The receipt
records SHA-256 hashes for the exact exercised runtime files; those files are
included unchanged in this evidence commit. Shared member-route registration
and middleware guard were added only to the fixture copy, matching the parent
integration interface documented in `docs/team-hub.md`.

Run on this host:

```sh
node --test tests/team-hub.test.mjs tests/member-access.test.mjs tests/workspace-access.test.mjs
pnpm check:types
node docs/evidence/team-hub-20261025/capture.mjs
# Optional explicit replay output:
# node docs/evidence/team-hub-20261025/capture.mjs --out output/team-hub/my-replay
```

The focused suite passed **26/26** including grant-table preservation, foreign
keys/cascade, legacy member compatibility, stale CAS, interleaved role/grant
changes, disabled users, cross-team and environment denials, private attachments
and fixed binding behavior. Types passed with zero errors and zero warnings.
Useful command output is retained under ignored `output/team-hub/` locally.

`capture.mjs` reuses the maintained native fixture preparer and passkey helper.
It uses this host's already installed Playwright/Chromium paths, creates one
owned temporary root, registers cleanup immediately, APFS-clones the existing
dependencies into that root, and deletes the tree after success/failure. It
installs no packages. The receipt confirms cleanup after the successful run.

Replay defaults to a new ignored `output/team-hub/native-replay-<timestamp>/`
directory, preserving these curated captures. `--out` explicitly selects another
output directory. The harness validates already integrated Team Hub read/write
permissions, methods, raw response, body limit and handler, then preserves them.
It preserves the existing document guard and Brand Studio middleware; only an
old source without Team Hub integration receives the missing imports/routes/guard
in its isolated fixture copy. Partial or changed interfaces fail before startup.
The fixture adds its owned-lab response marker to the existing security-header
anchor and resolves the upgraded preparer process-ownership helper to its actual
source. New replay receipts include the harness hash, source dirty state, shared
source hashes and the actual copied integration hashes.

The fixture removes production Access and uses local D1/R2 with no provider
bindings. Existing workspace/member Origin guards are adapted only to the
loopback origin; grant issuer/account identity remains unchanged. The explicit
`native-local` profile and preview resource namespace admit native local tests.
Accounts, passkey sessions and workspace memberships are created through actual
native/Composer APIs; no identity/session/member rows are inserted.

The successful journey:

- Real virtual WebAuthn sign-up/sign-in, native welcome dismissal and role 10
  actors; existing workspace invitation and recipient acceptance APIs.
- Explicit owner hub enablement and owner-selected app grants.
- Editor creates a request with a private text attachment, updates it and reads
  the two immutable saved versions. Viewer reads and downloads matching bytes.
- Viewer writes, wrong-team document/API/attachment access and anonymous access
  are refused. Anonymous private native API is 401; document denial is 403.
- Owner revokes the viewer through the UI; its next document and attachment
  request is refused. Native user disablement refuses the editor's next request.
  The independently created second team's request stays identical.
- Legacy `/me` member-session schema remains valid after the new app grants.
- No browser page errors; no horizontal overflow at 390 px. Eight captures show
  editor/viewer at 1440 and 390 px in both themes, plus the revoked response.

An initial harness assertion expected anonymous native API status 403; installed
EmDash correctly returned 401 before plugin dispatch. The assertion was corrected
and the full journey rerun successfully. This required no product auth change.

Editor desktop dark and phone light pixels were inspected directly. Independent
review also inspected editor phone dark and viewer desktop light, reread the
source and independently reran the 26 tests, with no blocking finding. Captures
are automated Chromium viewports, not physical-device or accessibility acceptance.

Production remains closed. The concrete missing Access document+API and mandatory
MFA contract, next-request revocation semantics, real private-service gate and
remaining knowledge/runbook work are recorded in [the implementation scope](../../team-hub.md).

## Integrated replay

The revised replay passed against integrated source
`5f7e2b30e5192c51632d5ce53c249086d4553999`, preserving existing Team Hub routes
and the combined Team Hub/Brand Studio middleware. All seven journey checks
passed, nine captures were produced, no page errors occurred and cleanup was
confirmed. The bounded [integrated receipt](integrated-receipt.json) is retained here; its
original and captures remain under ignored
`output/team-hub/native-replay-1792919447229/`; curated captures above
were not rewritten. The source was dirty only for the replay harness/README edits.
All nine recorded runtime/helper hashes still matched the source after the run.

The harness SHA-256 was
`6daa552b4198fe9aa96fd7c0cbd657749823cfa305691d66be6dc6a72665ad29`.
The fixture member plugin retained exact source bytes
(`796f5ef006c28c5f1149612c1bd6ad62f145530bf3524a878c2aad086c113e55`).
Middleware source hash
`975195440534b9fa561e0166e43777661b051f983e11c421c73b0fb42170ebcb`
became fixture hash
`393d4b8c5a9e4a5a12d75467b0ec127a8fbd18624070714c26f316bbfd58380a`
through the isolated-lab response marker alone. The fresh viewer phone dark
capture was inspected and remains readable without editing controls. No owned
Team Hub temporary roots or fixture processes remained after the run.

After that replay, the fixture preparer gained only the optional `--incident-lab` canary branch in the separate controlled-fault evidence slice. Team Hub does not select that flag; its shared/runtime bytes remain unchanged and the affected process/proposal suites passed 35/35.
