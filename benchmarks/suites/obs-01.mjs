// OBS-01 checks an offline fictional telemetry fixture.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check } from "./_checks.mjs";

const FIXTURE_URL = new URL("../fixtures/obs-01.json", import.meta.url);
const fixture = JSON.parse(readFileSync(FIXTURE_URL, "utf8"));

export const id = "obs-01";
export const name =
  "OBS-01 offline fixture: observed failure, independent recovery and unproven signal";

const { records, traces, logs, expected, scope } = fixture;

const byId = (id) => records.filter((record) => record.id === id);
const span = (spanId) => traces.find((entry) => entry.spanId === spanId);
const delay = (record) => Date.parse(record.queryableAt) - Date.parse(record.emittedAt);
const unproven = () =>
  expected.missingIds.some((id) => byId(id).length === 0) ||
  records.length !== new Set(records.map((record) => record.id)).size ||
  records.some((record) => record.classification !== "observed" || !record.traceId);

const observedIds = () => [
  ...new Set(
    records.filter((record) => record.classification === "observed").map((record) => record.id),
  ),
];

/** Assert a record's root span has real children and a log linked to one of them. */
function correlated(record) {
  assert.ok(record.traceId, `${record.id} has a trace id`);
  assert.ok(record.rootSpanId, `${record.id} has a root span id`);
  const root = span(record.rootSpanId);
  assert.ok(root, `root span ${record.rootSpanId} exists`);
  assert.equal(root.traceId, record.traceId, "root span shares the request trace");
  assert.equal(root.parentSpanId, null, "root span has no parent");
  assert.ok(root.childSpanIds.length > 0, "root span has child spans");
  for (const childId of root.childSpanIds) {
    const child = span(childId);
    assert.ok(child, `child span ${childId} exists`);
    assert.equal(child.traceId, record.traceId, "child shares the trace");
    assert.equal(child.parentSpanId, root.spanId, "child points at its root parent");
  }
  const linked = logs.find(
    (log) => log.traceId === record.traceId && root.childSpanIds.includes(log.spanId),
  );
  assert.ok(linked, `a log links the trace to a child span (${root.childSpanIds.join(", ")})`);
  return { root, children: root.childSpanIds, log: linked };
}

export function run() {
  return [
    check("observed-correlated-failure", "The failure is correlated across request, trace, child spans and log", () => {
      const [failure] = byId(expected.failureId);
      assert.ok(failure, "the failure request is present");
      assert.equal(failure.path, scope.path, "failure is on the selected app path");
      assert.equal(failure.status, 500, "the failing request's exact status is 500");
      const { root, children, log } = correlated(failure);
      assert.equal(root.status, "error", "root span records the error");
      assert.ok(
        children.some((id) => span(id).status === "error"),
        "a child span records the error",
      );
      assert.ok(observedIds().includes(failure.id), "the failure is counted as observed");
      assert.deepEqual(observedIds(), expected.observedIds, "observed identities match the answer key");
      const elapsed = delay(failure);
      assert.ok(elapsed >= 0 && elapsed < 300_000, "generation-to-queryable delay is bounded");
      return `Request ${failure.id} is HTTP ${failure.status} on ${failure.path}; root ${root.spanId} -> children ${children.join(", ")}; log ${log.id} links the trace. In the fixture, observed ${observedIds().length} of ${expected.generated} generated signals, queryable ${elapsed}ms after emission.`;
    }),

    check("observed-independent-recovery", "A later recovery and an untouched control are each independently correlated", () => {
      const [failure] = byId(expected.failureId);
      const [recovery] = byId(expected.recoveryId);
      const [control] = byId(expected.controlId);
      assert.ok(recovery && control, "recovery and control requests are present");

      assert.equal(recovery.status, 200, "the recovery request's exact status is 200");
      assert.equal(recovery.path, scope.path, "recovery is checked on the same affected journey");
      assert.ok(
        Date.parse(recovery.emittedAt) > Date.parse(failure.emittedAt),
        "failure comes first, recovery is later",
      );
      assert.notEqual(recovery.traceId, failure.traceId, "recovery uses an independent trace");
      const recovered = correlated(recovery);
      assert.equal(recovered.root.status, "ok", "recovery root span is healthy");
      assert.ok(
        recovered.children.every((id) => span(id).status === "ok"),
        "recovery child spans are healthy",
      );
      assert.ok(observedIds().includes(recovery.id), "recovery is counted as observed");

      assert.equal(control.status, 200, "the control request's exact status is 200");
      assert.equal(control.path, scope.controlPath, "the control is on a separate healthy path");
      assert.notEqual(control.path, scope.path, "control path differs from the affected path");
      assert.ok(
        control.traceId !== recovery.traceId && control.traceId !== failure.traceId,
        "control uses its own trace",
      );
      assert.ok(Date.parse(control.emittedAt) >= Date.parse(recovery.emittedAt), "control is checked after recovery");
      const untouched = correlated(control);
      assert.equal(untouched.root.status, "ok", "control root span is healthy");
      assert.ok(untouched.children.every((id) => span(id).status === "ok"), "control child spans are healthy");
      assert.ok(observedIds().includes(control.id), "control is counted as observed");

      // A shallow health 200 is explicitly not recovery evidence.
      for (const id of expected.shallowHealthIds) {
        const [probe] = byId(id);
        assert.ok(probe, "the shallow health probe is present");
        assert.equal(probe.status, 200, "the probe answered 200");
        assert.equal(probe.traceId, null, "the probe carries no trace");
        assert.equal(probe.rootSpanId, null, "the probe carries no root span");
        assert.equal(observedIds().includes(probe.id), false, "the probe is not observed journey evidence");
        assert.notEqual(expected.recoveryId, id, "the probe is not the recovery request");
      }
      return `Failure ${failure.id} (HTTP ${failure.status}) at ${failure.emittedAt}; recovery ${recovery.id} (HTTP ${recovery.status}, trace ${recovery.traceId}) at ${recovery.emittedAt} on ${scope.path} with linked log ${recovered.log.id}; control ${control.id} (HTTP 200) on separate path ${scope.controlPath}. Shallow health ${expected.shallowHealthIds[0]} excluded.`;
    }),

    check("duplicate-or-missing-unproven", "Missing and duplicate signals are recorded as unproven, not as observed", () => {
      const observed = observedIds();
      assert.equal(expected.missingIds.length, 1, "one record is expected missing");
      for (const id of expected.missingIds) {
        assert.equal(byId(id).length, 0, `${id} has no queryable record`);
        assert.equal(observed.includes(id), false, "a missing record is not observed");
      }
      assert.equal(expected.duplicateIds.length, 1, "one id is expected duplicated");
      for (const id of expected.duplicateIds) {
        const copies = byId(id);
        assert.equal(copies.length, 2, `${id} appears as an original and a retry`);
        assert.equal(
          observed.filter((entry) => entry === id).length,
          1,
          "the duplicate does not inflate the distinct observed count",
        );
        assert.ok(
          copies.every((entry) => entry.traceId === copies[0].traceId),
          "both copies share the trace",
        );
      }
      assert.equal(
        expected.generated,
        expected.observed +
          expected.missingIds.length +
          expected.unsupportedIds.length +
          expected.shallowHealthIds.length,
        "generated reconciles with observed and unproven classes",
      );
      assert.equal(
        records.length,
        expected.generated - expected.missingIds.length + expected.duplicateRecords,
        "queryable rows reconcile with generated, missing and duplicate counts",
      );
      assert.equal(unproven() ? "unproven" : "complete-fixture", expected.lossClaim);
      return `${expected.missingIds.length} generated record missing (${expected.missingIds.join(", ")}) and ${expected.duplicateRecords} duplicate retry (${expected.duplicateIds.join(", ")}) are unproven; observed stays ${observed.length} of ${expected.generated} generated. Loss claim: ${expected.lossClaim}.`;
    }),

    check("unsupported-signal-unproven", "An acknowledged but unsupported signal cannot pass, nor can a shallow 200", () => {
      const observed = observedIds();
      assert.equal(expected.unsupportedIds.length, 1, "one unsupported signal is expected");
      for (const id of expected.unsupportedIds) {
        const [signal] = byId(id);
        assert.ok(signal, "the unsupported signal is present");
        assert.equal(signal.status, 200, "the destination acknowledged it with HTTP 200");
        assert.equal(signal.classification, "unsupported", "it is classified unsupported, not stored");
        assert.equal(signal.traceId, null, "no correlated trace is available");
        assert.equal(signal.rootSpanId, null, "no root span is available");
        assert.equal(observed.includes(id), false, "an unsupported signal is not counted as observed");
        assert.ok(
          !logs.some((log) => log.traceId === signal.traceId),
          "no correlated log backs the acknowledged signal",
        );
      }
      const overall = unproven() ? "unproven" : "complete-fixture";
      assert.equal(overall, expected.overallStatus, "partial fixture coverage remains unproven");
      assert.equal(observed.length, expected.observed, "observed counts only correlated journey records");
      return `Signal ${expected.unsupportedIds[0]} was acknowledged HTTP 200 but stored no trace; it is unproven and excluded from the ${observed.length} observed records. Shallow health 200 is excluded; fixture coverage remains ${overall}.`;
    }),
  ];
}
