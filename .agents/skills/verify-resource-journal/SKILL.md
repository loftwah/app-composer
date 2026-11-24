---
name: verify-resource-journal
description: Check Creator stack resource-operation exclusivity when changing reservations, journal states, reconciliation, or the underlying migration.
---

Run `node --test tests/resource-journal-model.test.mjs` on the repository's pinned Node. The existing Jenkins candidate pipeline runs the same command.

Two stacks can read the same resource as free before either reserves it. At most one operation for that resource may stay open in `pending` or `unknown`. A lost reply keeps the reservation until the journal records a definitive outcome or the owner safely abandons it. Distinct resources can reserve concurrently.

The bounded model explores every ordering of two callers, each with one read, one reservation attempt, and possible local journal outcomes. SQLite executes the actual schema and models the indivisible database statements in `unfinished`, `operation`, and `record` in `src/lib/stack-resources.ts` and the abandoned-state write in the same file. The two callers have different stack locks. The model covers journal exclusivity, with provider calls, authorization, and remote idempotency outside its scope. Keep the existing route tests for those behaviors.

To replay the defect fixed by `91bb1394`, run `COMPOSER_RESOURCE_JOURNAL_HISTORICAL=1 node --test tests/resource-journal-model.test.mjs`. Expect a failure that names both stacks reading free and reserving the same resource. The historical run omits `migrations/0024_resource_operation_recovery.sql` and omits the abandonment transition that it introduced. Clear that variable for normal runs.

The runtime and migration were checked against `86b268c6cf77044a1ba6cfe7aa8d9a33421374ce`. If their transition or transaction boundaries change, review the model with the code, replay the failure and regular checks, and update this commit reference.
