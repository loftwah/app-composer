# URL-only discovery on an existing project — 25 October 2026

Owning issues: #376 / #311 / #292. This follows the earlier fictional
[OpenCode/DeepSeek evaluation](url-first-20261025.md) with a distinct client and
model and a genuinely existing unrelated application.

## Existing project and decision

[Liferaft](https://github.com/loftwah/liferaft), source
`cf33b74fd54618aea933a3c94bfc4719c372198c`, is an existing local Electron mailbox
recovery application. Its source contains no Composer, EmDash or Cloudflare
instructions. A clean isolated clone retained its actual source, Bun lockfile,
settings and existing tests; no personal archive or message was opened.

Fresh **Codex CLI 0.145.0 / gpt-5.6-sol**, ephemeral session, started with only
the product URL and the ordinary fit question. It fetched the live homepage,
`/agent`, setup, Get Ready, Init, architecture, documentation, pipeline runbook,
release evidence and privacy. It returned **partial fit**: keep local Electron
and its privacy boundary; adopt useful verification/release practices. It
identified that release publication omitted the project's existing checks.

The successful session used a workspace-write sandbox with network enabled
but a read-only task. The checkout stayed byte-identical/clean. Inherited
Cloudflare/provider secrets were excluded from its process environment. The
client retained its configured personal skill catalogue; this is a fresh
conversation, not a new machine or universal client-discovery claim.

## One scoped adoption

A second fresh session received the Programmer pack and pipeline URLs and an
explicit authorisation to change only `package.json`: compose existing format,
test and typecheck commands in `check`, and run that check before the existing
build/publish sequence. It was forbidden to edit/run Actions, publish, tag,
commit, push, add dependencies or touch mail. No Composer runtime was adopted.

Before and after: format and type checks pass; **11 tests pass, 0 fail**. The
consolidated check passes. Controlled shims of the exact scripts prove a failed
check stops later checks and a failed release check stops build and publisher.
Only the two authorised package scripts changed; runtime source, dependencies,
lockfile, owner checkout and the existing tag-only workflow were preserved.
The agent returned the Programmer pack's evidence fields and did not
self-approve. Independent source review found no blocking issue.

The integration owner then committed/reviewed/merged
[Liferaft PR #2](https://github.com/loftwah/liferaft/pull/2), head
`fa54037f2c909609b87cafadd1ebe17f5743edbf`, merge
`f6c8afa907d41216757d6732a8f12dded19fa12b`. No release was run and no Action was
triggered. The existing application now refuses its publishing command when
its existing checks fail. This is a verification-practice adoption, not a
customer migration, product purchase or demonstrated packaged-app recovery.

## Failed attempts and limits

The configured CLI default `gpt-6.1-sol` was rejected by this CLI's ChatGPT
account. No global model/configuration changed; the successful run selected an
available cached model explicitly. An earlier read-only sandbox could not
resolve the live domain or create SQLite fixture directories; it fell back to
Composer source. That attempt is not counted as URL-only live acceptance.
The reported run enabled network, reached the actual pages and passed all 11
real project tests. No paid resource or new credential was created.

All clone/install/fixture roots were explicitly owned, registered for cleanup
and removed on success/failure. Only bounded logs, exact patch and checks stay
in ignored `output/adoption*`; no entire temporary project remains. No owner
checkout, dirty work or browser/session data was removed. No physical device,
packaged Electron smoke, signing, provider onboarding or longitudinal use is
claimed. The previous OpenCode fixture and this Codex real-project run are
distinct clients/projects; OpenCode was not re-exercised on this real project.

## Bounded evidence hashes

- `output/adoption/assessment.log`: `cc789d22a4a86dbca4b1dbdf167d9b1ca3cf9aa88176f7e0121bf8158101e5d5`
- `output/adoption/assessment.md`: `bb21d01b3451bd1d678f4e9a90295460080867246571d5c8b8b27b2d780c547a`
- `output/adoption-change/session.log`: `d7cc8bc15cfcc9242550447ef36a5108ad5b2cfe3851dad5d54b34aa5946ce3f`
- `output/adoption-change/adoption.patch`: `b781007ca96ccf6b6314cf5cb1edf912bdf38a0827a5ccdbcb6cc333d68668b4`
