#!/usr/bin/env node
// MIT. Ingest the reviewed Studio media extract into one committed run record.
//
// The Studio itself is never called. `task.json` and `configurations.json` are
// the reviewed, public-safe extract; this runner verifies that every committed
// artifact still matches the bytes and digest recorded for it, that the pair is
// genuinely matched (same input and settings, different model), and that the
// blind side paths agree with the same hash rule the vote API uses. It then
// writes `run.json`, the record the page and export read.
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MEDIA_RECORD_SCHEMA,
  MEDIA_ASSET_ROOT,
  canonicalJson,
  configurationsOfMedia,
  mediaPairs,
  mediaRunIdFor,
  validateMediaRecord,
} from "../../src/lib/benchmark-media.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const taskFile = path.join(here, "task.json");
const configurationsFile = path.join(here, "configurations.json");
const runFile = path.join(here, "run.json");
const publicRoot = path.join(repoRoot, "public");

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const json = process.argv.includes("--json");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function compactDigest(file) {
  const bytes = readFileSync(file);
  return { bytes: statSync(file).size, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function composeRecord(task, configurations) {
  const sourceVersion = createHash("sha256")
    .update(canonicalJson({ task, configurations: configurations.configurations }))
    .digest("hex")
    .slice(0, 40);
  const partial = {
    schema: MEDIA_RECORD_SCHEMA,
    generatedAt: configurations.checkedAt,
    sourceVersion,
    inventory: task.inventory,
    source: configurations.source,
    task,
    sharedSettings: configurations.sharedSettings,
    configurations: configurations.configurations,
    notComparable: task.notComparable,
    provenance: {
      runner: "benchmarks/media/ingest.mjs",
      taskFile: "benchmarks/media/task.json",
      configurationsFile: "benchmarks/media/configurations.json",
      recordFile: "benchmarks/media/run.json",
      mode: "offline ingest; no Studio or provider call",
    },
  };
  const pairs = mediaPairs(partial);
  return {
    ...partial,
    pair: pairs[0]
      ? {
          id: pairs[0].id,
          ordinal: pairs[0].ordinal,
          orderKey: pairs[0].orderKey,
          sideA: pairs[0].trialA.id,
          sideB: pairs[0].trialB.id,
        }
      : null,
  };
}

function artifactErrors(record, task) {
  const errors = [];
  const configurations = configurationsOfMedia(record);
  for (const configuration of configurations) {
    for (const trial of configuration.trials) {
      if (trial.status !== "saved") {
        errors.push(`${configuration.id}/${trial.id}: a published pair must have two saved artifacts`);
        continue;
      }
      for (const [label, artifact] of [
        ["clip", trial.artifact],
        ["poster", trial.poster],
      ]) {
        if (!artifact?.path) {
          errors.push(`${configuration.id}/${trial.id}: ${label} path is missing`);
          continue;
        }
        const file = path.join(publicRoot, MEDIA_ASSET_ROOT, artifact.path);
        let actual;
        try {
          actual = compactDigest(file);
        } catch {
          errors.push(`${configuration.id}/${trial.id}: ${label} file is missing at public${MEDIA_ASSET_ROOT}/${artifact.path}`);
          continue;
        }
        if (actual.bytes !== artifact.bytes) {
          errors.push(`${configuration.id}/${trial.id}: ${label} is ${actual.bytes} bytes, recorded ${artifact.bytes}`);
        }
        if (actual.sha256 !== artifact.sha256) {
          errors.push(`${configuration.id}/${trial.id}: ${label} sha256 does not match the record`);
        }
      }
    }
  }
  const input = task.input ?? {};
  if (input.previewPath) {
    const file = path.join(publicRoot, MEDIA_ASSET_ROOT, input.previewPath);
    try {
      const actual = compactDigest(file);
      if (actual.bytes !== input.previewBytes) {
        errors.push(`input preview is ${actual.bytes} bytes, recorded ${input.previewBytes}`);
      }
      if (actual.sha256 !== input.previewSha256) {
        errors.push("input preview sha256 does not match the record");
      }
    } catch {
      errors.push(`input preview is missing at public${MEDIA_ASSET_ROOT}/${input.previewPath}`);
    }
  }
  return errors;
}

function identityErrors(record) {
  const errors = [];
  for (const configuration of configurationsOfMedia(record)) {
    const tokens = [configuration.id, configuration.model, configuration.label]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    for (const trial of configuration.trials) {
      for (const artifact of [trial.artifact, trial.poster]) {
        if (!artifact?.path) continue;
        const lower = artifact.path.toLowerCase();
        for (const token of tokens) {
          if (token.length >= 3 && lower.includes(token)) {
            errors.push(`${artifact.path} names ${JSON.stringify(token)}; blind assets must not`);
          }
        }
      }
    }
  }
  return errors;
}

function main() {
  const task = readJson(taskFile);
  const configurations = readJson(configurationsFile);
  const record = composeRecord(task, configurations);
  const errors = [];
  if (task.schema !== "benchmark-media-task/v1") errors.push("task.json schema is not benchmark-media-task/v1");
  if (configurations.schema !== "benchmark-media-configurations/v1") {
    errors.push("configurations.json schema is not benchmark-media-configurations/v1");
  }
  if (!task.inventory) errors.push("task.inventory is required");
  if (!configurations.checkedAt) errors.push("configurations.checkedAt is required");
  errors.push(...artifactErrors(record, task));
  errors.push(...identityErrors(record));
  const validation = validateMediaRecord(record, {
    expectedSourceVersion: record.sourceVersion,
  });
  errors.push(...validation.errors);
  const runId = mediaRunIdFor(record);

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: errors.length === 0,
          runId,
          sourceVersion: record.sourceVersion,
          pair: record.pair,
          artifacts: configurationsOfMedia(record).flatMap((configuration) =>
            configuration.trials.map((trial) => ({
              configuration: configuration.id,
              trial: trial.id,
              clip: trial.artifact
                ? { path: trial.artifact.path, bytes: trial.artifact.bytes, sha256: trial.artifact.sha256 }
                : null,
            })),
          ),
          errors,
        },
        null,
        2,
      )}\n`,
    );
  } else if (errors.length === 0) {
    console.log(`Media ingest is valid: ${runId}`);
    console.log(`Pair ${record.pair?.id}: side A ${record.pair?.sideA}, side B ${record.pair?.sideB}`);
    for (const configuration of configurationsOfMedia(record)) {
      for (const trial of configuration.trials) {
        console.log(
          `  ${configuration.id} ${trial.id}: ${trial.artifact?.width}x${trial.artifact?.height} ` +
            `${trial.artifact?.durationMs}ms, ${trial.artifact?.bytes} bytes, estimate ${trial.cost?.estimateMicro} micro`,
        );
      }
    }
  } else {
    console.error(`Media ingest failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:`);
    for (const error of errors) console.error(`  - ${error}`);
  }

  if (errors.length > 0) process.exitCode = 1;
  if (write && errors.length === 0) {
    writeFileSync(runFile, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`Wrote ${path.relative(repoRoot, runFile)}`);
  }
  if (check) {
    let existing;
    try {
      existing = readJson(runFile);
    } catch {
      console.error("benchmarks/media/run.json is missing; run with --write");
      process.exitCode = 1;
      return;
    }
    if (canonicalJson(existing) !== canonicalJson(record)) {
      console.error("benchmarks/media/run.json is stale; run with --write");
      process.exitCode = 1;
    } else if (errors.length === 0 && !json) {
      console.log("benchmarks/media/run.json is current");
    }
  }
}

main();
