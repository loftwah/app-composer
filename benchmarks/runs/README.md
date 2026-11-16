# Recorded runs

`/benchmarks/runs/<id>` reopens a committed comparison record with its D1 votes.
Votes are stored server-side but are **unauthenticated**: the reviewer label is
self-declared, defaults to `visitor`, and is not proof of who voted. The run page
must keep saying so. The id is derived from the record, never typed by hand:

```
<task-id>-v<task-version>-<source-commit-first-7>
launch-page-v1-1c97c3d
```

The registered records live in `src/lib/benchmark-runs.ts` (`committedRecords`).
Today there are two:

| Id | Committed record | Task |
| --- | --- | --- |
| `launch-page-v1-1c97c3d` | `benchmarks/results/compare.json` | `launch-page` v1 |
| `animate-a-still-v1-d20cbf5` | `benchmarks/media/run.json` | `animate-a-still` v1 (media) |

The media record is built by `benchmarks/media/ingest.mjs` from the reviewed
Studio extract in `benchmarks/media/task.json` and
`benchmarks/media/configurations.json`. Its blind page is `/benchmarks/media`,
its revealed page is `/benchmarks/media/runs/<id>`, and its id is derived the
same way from the record. Do not send a media id to `/benchmarks/compare` or
`/benchmarks/runs/…`; both redirect to the media pages.

Adding a run means committing a `benchmark-compare/v1` record (the comparison
runner writes it) and adding that import to `committedRecords`. The record is the
evidence; D1 holds only the unauthenticated votes. Do not hand-edit numbers to
make a page look complete.

## Export shape

`/benchmarks/runs/<id>/export.json` returns
`composer/benchmark-run-evidence/1`:

```json
{
  "schema": "composer/benchmark-run-evidence/1",
  "runId": "launch-page-v1-1c97c3d",
  "record": { "…the committed comparison record…": true },
  "votes": [],
  "votesAvailable": true
}
```

The run page builds the same object and passes it to the same view function, so
export and reopen cannot drift into two renderers. `votesAvailable: false` means
D1 could not be read; it is not the same as zero votes.

## What the blind page does not reference

The blind page links only to `/benchmarks/preview/<run>/<pair>/<side>/…`, which
resolves the committed trial files on the server. It never renders a trial id,
configuration id, model id, harness name or `/benchmarks/trials/…` path before a
choice is recorded. The underlying files stay committed for inspection after the
reveal; they are not the address the blind page uses.
