# Oddpull — App Composer headless-first dogfood inputs

**State:** proposed authoring inputs, **not** validated imports, generated code, a deployed app, approved identity, or a Composer source pin. Parent issue [#404](https://github.com/loftwah/app-composer/issues/404).

## Owner goal
Build a real independent capsule-collecting mini-app **through App Composer**. Headless domain engine first (CLI + skill; MCP after verifying auth), EmDash content/owner administration next, player GUI and X sharing last. **ODDPULL** is provisional; *A little weird, every time.* Do not treat this as trade mark or domain clearance.

## Actually dogfood Composer
1. Using production `/setup` and `/prompts#build`, export a truthful new-independent-app setup and build request.
2. Open `/init/content`; import each of `models/*.json` individually. Record validation failures, approved corrections, returned export(s) and exact source revision. Composer emits no multi-model bundle.
3. Review independent-app repository, author the headless service, run real CLI/agent tests; never claim the public forms wrote business logic.
4. Native EmDash owns collectible editorial fields, art and rights provenance. Game service owns immutable pool snapshots, random draws, receipts, authenticated player identity, inventory and abuse limits in independently managed D1, not CMS.
5. Use the shipped Programmer/Architect/Security/QA role packs plus `agent/oddpull-skill.md`. An unchecked local SKILL.md does not establish host installation/discovery.
6. Add admin/studio and player GUI only after an agent can complete a genuine free draw and inspect inventory, receipts and odds through a scoped headless interface.
7. Preserve isolated preview, exact revision pins, authorisation and human release approval. Do not deploy, spend, change live DNS, post to X or create production accounts as part of this lab.

## First local fixture behaviour
Original fictional series `Odd Ones — First Batch`: Night Shift Possum (60), Lunch Break Dragon (25), Senior Goblin (10), The Unpaid Wizard (5). The accompanying local chat-supplied pilot archive has a runnable no-dependency Node CLI, six passing tests, synthetic-only state and a project SKILL.md. **It was authored outside Composer**. Use it to reproduce intended behaviour, not as evidence of Composer generation or production fairness. Production requires transactional persistence and authenticated player subject.

## Proof expected
Exported setup/build prompts; both genuine imported-and-validated model JSONs + EmDash seeds; independent app source/commit, CLI/MCP output and tests; EmDash admin mutation and publish proof; exact unchanged production environment; clearly recorded Composer-versus-agent work.

See [App Composer's self-use club](../../docs/self-use-club.md) and [agent connection scope](../../docs/agent-connect.md).