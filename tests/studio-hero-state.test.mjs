import test from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  drawingPose,
  lensRing,
  paperPoint,
  stationById,
  studioStations,
} from "../src/scripts/studio/studio-data.js";

test("the Paperwork sheet stays finite and curls further as it is fed", () => {
  const edge = (feed) => paperPoint(0.5, 1, feed)[1];
  assert.ok(edge(1) > edge(0));
  for (const feed of [0, 0.34, 0.7, 1]) {
    for (let u = 0; u <= 1; u += 0.25) {
      for (let v = 0; v <= 1; v += 0.25) {
        const [x, y, z] = paperPoint(u, v, feed);
        for (const value of [x, y, z]) assert.ok(Number.isFinite(value));
        assert.ok(Math.abs(x) < 1.3);
        assert.ok(y > 1 && y < 4.5);
        assert.ok(z > 1 && z < 4);
      }
    }
  }
  assert.equal(clamp(-2), 0);
  assert.equal(clamp(2), 1);
});

test("LDraw's drawing starts flat and rises into a dimensional structure", () => {
  const count = 15;
  const flat = drawingPose(count - 1, count, 0);
  const raised = drawingPose(count - 1, count, 1);
  assert.ok(flat.y < 0.2);
  assert.ok(raised.y > 3.5);
  assert.ok(raised.rise > 0.99);
  for (let index = 0; index < count; index += 1) {
    for (const lift of [0, 0.35, 0.7, 1]) {
      const pose = drawingPose(index, count, lift);
      for (const value of [pose.x, pose.y, pose.z, pose.rotY]) {
        assert.ok(Number.isFinite(value));
      }
      assert.ok(pose.rise >= 0 && pose.rise <= 1);
    }
  }
});

test("the three stations carry truthful product context and no live counts", () => {
  assert.equal(studioStations.length, 3);
  assert.equal(stationById("missing").id, "press");
  for (const station of studioStations) {
    assert.ok(station.href.startsWith("/"));
    assert.ok(station.linkLabel.length > 0);
    assert.ok(station.readout.length > 0);
    assert.ok(station.context.length > 0);
    assert.doesNotMatch(station.readout, /\b\d{2,}\b/);
    assert.doesNotMatch(station.context, /\b\d{2,}\b/);
  }
  const analytics = stationById("lens");
  assert.match(analytics.context, /not connected/i);
  assert.match(analytics.context, /documents|drawings/i);
  assert.equal(analytics.rings.length, 3);
});

test("the evidence lens cycles through its three rings", () => {
  assert.equal(lensRing("lens", 0).label, "Recorded requests");
  assert.equal(lensRing("lens", 3).label, "Recorded requests");
  assert.equal(lensRing("lens", -1).label, "Daily coverage");
  assert.equal(lensRing("lens", 1).label, "Supported actions");
});
