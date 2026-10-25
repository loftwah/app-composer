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
