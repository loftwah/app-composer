# Native approved-export evidence

`labs/platform/native-export.mjs` adds a read-only qualification step to the existing native lab. It starts no browser, service, provider session or runner and writes no file. The caller supplies its current authenticated operator page and lab metadata:

```js
const receipt = await qualifyNativeApprovedExport({
  owner: actors.owner,
  lab,
  teamA: { workspace, request, stack, instance, resource },
  approvedItemId,
  expectedMediaSha,
});
```

Call after the actual synthetic contribution is approved again and the compatible update completes, while its resource remains visible and unpaused. Export must precede any optional availability fault. The helper uses the fixed native `maintenanceRead?action=export` endpoint with a freshly read stack revision. Existing native capability, source, account, workspace, configuration, unresolved-operation and current-resource guards remain authoritative. Every browser request is a bounded GET and must reach the current owned local TLS bridge before its body is read. It uses current shared platform/stack/maintenance decoders; imported data cannot select another endpoint or credential.

The approved-portable contract declares at most eight original approved contributions. The helper requires the retained synthetic item to be included, checks actual decoded PNG bytes against both the declared digest and the previously measured public PNG digest, and rejects non-synthetic items. It repeats current native identity and selection checks afterwards to confirm that the request, policy, stack, publication and app resource stayed unchanged. Drift fails the check without a mutation or retry.

The returned receipt contains exact source and selection IDs, versions, plan/policy/configuration identities, declared approved-subset coverage, bounded media IDs/dimensions/byte counts/digests, manifest-JSON and transport-response hashes, and read-only observations. It returns neither base64, captions, authors, private items, credentials nor the full portable manifest. The caller may retain this bounded result in its existing native receipt.

`node --test tests/platform-native-export.test.mjs tests/creator-maintenance.test.mjs` exercises real Composer route/SQLite guards with explicitly labelled app/browser transport doubles, including byte limits, wrong bridge, altered scope/source/media, private coverage, missing synthetic item and post-export state or capability drift. These are not native browser/workerd evidence. A fresh admitted native run at the integrated source remains required.

Even when `coverage.complete` is true, it describes only the current approved-original subset. This is not a full backup: private records, credentials, restored copies and publication history are excluded. No restore is attempted or qualified; later control changes advance the source version. Production, offline and cross-account recovery remain unqualified.
