---
layout: "../../layouts/Article.astro"
title: "Why databases write the same data twice"
description: "How B-trees and LSM trees trade reads, writes and disk space, and what that means for choosing D1, Durable Objects, Queues or R2."
cover: "/articles/storage-pages-and-runs-20261127.png"
coverAlt: "A B-tree follows an index to an ordered leaf. An LSM tree flushes a memory table into sorted runs, then compacts overlapping runs and their delete markers."
coverCaption: "An original diagram of two storage layouts. The arrows show how data moves, without implying measured cost."
published: "2026-11-27"
---

A job has finished, its result file is in object storage, and your Worker has to record the outcome. If the Worker is interrupted after saving the receipt, the same completion may arrive again. That one small record gives you two questions to answer. Can you recognise the retry? How much work does your database do to store each change?

## Pages and sorted runs

[Open the full-size storage diagram](/articles/storage-pages-and-runs-20261127.png).

A **B-tree** keeps keys ordered in pages. A lookup follows branches to a leaf page. A range scan seeks to the start of the range and then walks keys in order. An insert or update can dirty a page, and a full page can split. SQLite uses B-trees for its tables and indexes. Its optional write-ahead log (WAL) saves changed pages before a checkpoint copies them back into the main database. WAL changes the write sequence while the database keeps its B-tree layout. [SQLite file format and WAL](https://www.sqlite.org/fileformat.html#b_tree_pages)

A **log-structured merge tree**, or LSM tree, buffers writes in a sorted in-memory table. Many implementations also record the writes in a WAL so that a crash does not discard data that has been acknowledged under the engine’s durability settings. The engine flushes the table into an immutable sorted run. A point lookup may consult several runs to find the newest value. Filters can skip some runs for point lookups. A range scan may still have to merge overlapping runs. Deletes create tombstones, which hide earlier values until compaction can discard both safely. [RocksDB write path and compaction](https://github.com/meta/rocksdb/wiki/RocksDB-Overview)

| Trade-off | What to measure |
| --- | --- |
| Write amplification | Bytes written per byte of logical change. Page writes, index updates, checkpoints and compaction can all add work. |
| Read amplification | Pages, bytes or runs inspected to serve a query. Measure point lookups and range scans separately. |
| Space amplification | Physical storage relative to live data. Track old versions, tombstones and temporary space needed during maintenance. |

A write-heavy workload may benefit from buffering. Compaction can later compete with readers and temporarily retain multiple copies of the same key. Either layout can also give up durability through configuration. When comparing engines, decide what must survive a crash and count latency, storage and recovery under equivalent guarantees.

## Match the storage to the job

| Job | Cloudflare starting point |
| --- | --- |
| Query receipts across projects with transactions and indexes | **D1** for shared relational records. Read its consistency contract before enabling read replicas. |
| Coordinate a single job or room | **SQLite-backed Durable Object** for state scoped to one object. Pick an ID that matches the entity that must coordinate. |
| Retry and batch background events | **Queues** delivers at least once. Use a stable event ID and let the consumer recognise duplicates. |
| Retain large originals and generated files | **R2** for object bytes. Keep keys, digests, ownership and visibility in the application’s authoritative records. |
| Serve read-heavy configuration | **Workers KV** where delayed updates are acceptable. Keep immediate permission decisions on the authoritative path. |
| Investigate telemetry | **Analytics Engine or Pipelines** where available, with a retention policy that fits the data. Keep operational receipts queryable in their owning application. |

App Composer’s [Worker configuration](https://github.com/loftwah/app-composer/blob/849dfc7f4d2fe36bc9913c377509d4f88e10ec85/wrangler.jsonc) declares D1 for its application data, R2 for media and KV for sessions. Its [workflow migration](https://github.com/loftwah/app-composer/blob/849dfc7f4d2fe36bc9913c377509d4f88e10ec85/migrations/0012_workflows.sql) stores durable run records. The Queue and Durable Object choices above are patterns for other workloads. [Cloudflare storage selection](https://developers.cloudflare.com/workers/platform/storage-options/) · [D1 read replication](https://developers.cloudflare.com/d1/best-practices/global-read-replication/) · [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)

## Try an interrupted delivery twice

Here is a local SQLite example. Copy it into a shell with `sqlite3` installed. The two inserts model delivery of the same event after an interruption.

```sh
sqlite3 :memory: <<'SQL'
CREATE TABLE receipts (
  job_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  PRIMARY KEY (job_id, event_id)
);
INSERT INTO receipts VALUES ('job-42', 'completed-1', 'job-42/result.webp')
  ON CONFLICT (job_id, event_id) DO NOTHING;
INSERT INTO receipts VALUES ('job-42', 'completed-1', 'job-42/result.webp')
  ON CONFLICT (job_id, event_id) DO NOTHING;
SELECT job_id, count(*) FROM receipts GROUP BY job_id;
SQL
```

The result is `job-42|1`. In a real consumer, derive IDs from the authorised project and job, compare the artifact key and digest on a duplicate, and acknowledge delivery after committing the receipt. An R2 upload and a SQL transaction can fail independently. Use an immutable object key, then reconcile unreferenced objects after the retry window. Retain deduplication records for as long as the event can be replayed and apply the source’s deletion and visibility policy before serving the file.

To decide whether batching helps, replay a fixed stream of synthetic completions with duplicate IDs. Compare individual and batched writes with the same transaction guarantees. Interrupt the consumer between commit and acknowledgement, then measure lost and duplicated receipts, latency and growth. The example above checks the SQL behaviour locally. It provides no Cloudflare throughput or cost measurements.
