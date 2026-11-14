import test from "node:test";
import assert from "node:assert/strict";
import { createStudioFrameLoop } from "../src/scripts/studio/studio-motion.js";

function display() {
  const pending = new Map();
  let id = 0;
  return {
    requestFrame(callback) {
      pending.set(++id, callback);
      return id;
    },
    cancelFrame(id) {
      pending.delete(id);
    },
    tick(timestamp) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(timestamp));
    },
    get pending() {
      return pending.size;
    },
  };
}

test("the workshop follows 60, 90 and 120Hz displays without skipping frames", () => {
  for (const hz of [60, 90, 120]) {
    const screen = display();
    const times = [];
    const loop = createStudioFrameLoop({
      requestFrame: screen.requestFrame,
      cancelFrame: screen.cancelFrame,
      canRender: () => true,
      render: (dt) => {
        times.push(dt);
        return true;
      },
    });
    loop.request();
    loop.request();
    assert.equal(screen.pending, 1, "multiple invalidations share one frame");
    for (let frame = 0; frame <= hz; frame += 1) screen.tick(frame * 1000 / hz);
    assert.equal(times.length, hz + 1);
    assert.equal(times[0], 0);
    assert.ok(Math.abs(times.reduce((sum, dt) => sum + dt, 0) - 1) < 1e-9);
    assert.ok(times.slice(1).every((dt) => Math.abs(dt - 1 / hz) < 1e-9));
    loop.dispose();
    assert.equal(screen.pending, 0);
  }
});

test("readiness follows a successful painted frame and is announced once", () => {
  const screen = display();
  const events = [];
  const loop = createStudioFrameLoop({
    requestFrame: screen.requestFrame,
    cancelFrame: screen.cancelFrame,
    canRender: () => true,
    render: () => {
      events.push("render");
      return false;
    },
    onReady: () => events.push("ready"),
  });
  loop.request();
  assert.deepEqual(events, []);
  screen.tick(0);
  assert.deepEqual(events, ["render", "ready"]);
  assert.equal(screen.pending, 0, "a static scene sleeps after its first paint");
  loop.request();
  screen.tick(1000);
  assert.deepEqual(events, ["render", "ready", "render"]);
  assert.equal(screen.pending, 0);
});

test("paused controls repaint once and resume without counting idle time", () => {
  const screen = display();
  let moving = true;
  const times = [];
  const loop = createStudioFrameLoop({
    requestFrame: screen.requestFrame,
    cancelFrame: screen.cancelFrame,
    canRender: () => true,
    render: (dt) => {
      times.push(dt);
      return moving;
    },
  });
  loop.request();
  screen.tick(0);
  screen.tick(1000 / 60);
  moving = false;
  loop.suspend();
  loop.request();
  screen.tick(2000);
  assert.equal(times.at(-1), 0);
  assert.equal(screen.pending, 0);
  loop.request();
  screen.tick(9000);
  assert.equal(times.at(-1), 0);
  assert.equal(screen.pending, 0);
  moving = true;
  loop.request();
  screen.tick(20000);
  assert.equal(times.at(-1), 0);
  assert.equal(screen.pending, 1);
  loop.dispose();
});

test("offscreen and hidden scenes stop and dispose cannot be revived", () => {
  const screen = display();
  let visible = true;
  const times = [];
  const loop = createStudioFrameLoop({
    requestFrame: screen.requestFrame,
    cancelFrame: screen.cancelFrame,
    canRender: () => visible,
    render: (dt) => {
      times.push(dt);
      return true;
    },
  });
  loop.request();
  screen.tick(0);
  visible = false;
  screen.tick(1000);
  loop.request();
  assert.equal(times.length, 1);
  assert.equal(screen.pending, 0);
  visible = true;
  loop.request();
  screen.tick(10000);
  assert.equal(times.at(-1), 0);
  loop.dispose();
  loop.request();
  screen.tick(20000);
  assert.equal(times.length, 2);
  assert.equal(screen.pending, 0);
});

test("a failed first render retains fallback and stops retrying", () => {
  const screen = display();
  const error = new Error("lost graphics context");
  const events = [];
  const loop = createStudioFrameLoop({
    requestFrame: screen.requestFrame,
    cancelFrame: screen.cancelFrame,
    canRender: () => true,
    render: () => { throw error; },
    onReady: () => events.push("ready"),
    onError: (failure) => events.push(failure),
  });
  loop.request();
  screen.tick(0);
  loop.request();
  assert.deepEqual(events, [error]);
  assert.equal(screen.pending, 0);
});
