# Recover code, content and objects separately

Run `node labs/recovery/run.mjs output/recovery-drill/receipt.json` for a complete
owned local SQLite/object-directory drill. It starts a loopback application,
observes the actual failed journey, restores each layer and verifies the response
bytes. The command removes its temporary server, database, backups and objects in
`finally`, retaining only the bounded receipt you selected.

The drill demonstrates these distinct outcomes:

| Action | Observed result |
| --- | --- |
| Restore the prior release selection | The request works again; corrupted data and media remain corrupted |
| Restore the application content set | Original public content returns; corrupted object bytes remain |
| Restore the original object version | Media bytes match the retained baseline |
| Recheck access and publication | Revoked user remains 403; private draft and deleted item remain 404 |

This is a controlled local fixture, not a provider D1/R2 restore. Its selective
SQL is specific to its fictional schema and must not be applied to production.
The release selection is a finite local version switch, not a Worker rollback.
The content restore explicitly excludes current deletion tombstones and leaves
the access ledger intact. Copying the entire older database would undo those
later decisions and is not the recovery procedure demonstrated here.

For an actual independent app, the operator needs the app's own exact source,
configuration, migration compatibility, database recovery point, object manifest
and access/deletion ledger. Before any restore:

1. Select the account, app, environment and accountable owner. Record current
   source, schema, publication, grants/revocations and object versions. Preserve
   the failed state for investigation.
2. Compare the proposed recovery point with later deletions and revoked access.
   Keep those decisions outside the restored application content set, or merge
   them through the app's tested recovery contract. Stop when that contract is
   unknown.
3. Restore into an isolated target first. Check actual public, private, deleted,
   wrong-team and revoked-user journeys. Verify object hashes and MIME/decoded
   dimensions where media semantics require them.
4. Review exactly what changes and what is lost. A code rollback needs a
   compatible schema/bindings; a database restore cannot recreate missing object
   bytes. An object restore must not make hidden media public.
5. Use the independent app's guarded release/recovery process only with the
   relevant authority. Verify the user journey and retained access after the
   action; command success alone is insufficient.

The fixture is repeatable without cloud credentials, subscriptions or external
notifications. No production record, bucket, grant or configuration is read or
changed. Provider backup availability, real recovery-point loss, physical device
use and large-dataset timing are not established by this drill.
