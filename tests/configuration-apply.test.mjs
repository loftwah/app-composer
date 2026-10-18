import test from "node:test";
import assert from "node:assert/strict";
import { appSettings } from "../src/lib/app-settings.mjs";
import { applyConfiguration } from "../scripts/app-configuration.mjs";
import { activateStack } from "../src/lib/stack-activation.mjs";

const ids = ["guestbook", "showcase"];
const entry = (id) => ({
  id,
  url: "https://" + id + ".loftwah.com",
  source: { ...appSettings[id].source },
  configuration: Object.fromEntries(
    appSettings[id].fields.map((field) => [field.key, field.default]),
  ),
});
const stack = () => ({
  version: 1,
  name: "Fictional source guard",
  theme: "midnight",
  instances: ids.map((id) => ({
    id: "fictional-" + id + "-0001",
    app: id,
    label: id,
    config: {},
  })),
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const run = (kind, options) =>
  kind === "direct"
    ? applyConfiguration(ids.map(entry), options)
    : activateStack(stack(), options);
const refuse = async (kind, promise) => {
  if (kind === "direct")
    await assert.rejects(
      promise,
      /source changed|could not be checked|Workspace changed|immutable|read only|not extensible|Cannot assign/,
    );
  else {
    const result = await promise;
    assert.deepEqual(result.configured, []);
    assert.equal(result.failed[0].app, "guestbook");
    assert.equal(result.untouched[0].app, "showcase");
    assert.equal(result.publicationUnchanged, true);
  }
};
function transport({ source = () => null, beforeResponse, post } = {}) {
  const calls = [];
  const request = async (href, init = {}) => {
    const url = new URL(href),
      mounted = url.hostname === "composer.loftwah.com",
      id = mounted ? url.pathname.split("/")[1] : url.hostname.split(".")[0];
    calls.push({
      id,
      mounted,
      method: init.method ?? "GET",
      url: url.href,
      authorization: init.headers?.Authorization,
    });
    if (url.pathname.endsWith("/build.json")) {
      assert.equal(
        init.headers?.Authorization,
        undefined,
        "source checks never carry owner credentials",
      );
      assert.equal(init.redirect, "error");
      if (beforeResponse) await beforeResponse({ id, mounted });
      const value = source({ id, mounted });
      return Response.json(
        value ?? { revision: appSettings[id].source.commit },
      );
    }
    assert.equal(init.method, "POST");
    assert.equal(url.pathname, "/api/config");
    return post
      ? post({ id, url, init })
      : Response.json({ ok: true, config: JSON.parse(init.body) });
  };
  return {
    request,
    calls,
    posts: () => calls.filter((call) => call.method === "POST"),
  };
}

test("actual apply independently refuses standalone and mounted source drift with a no-op guard", async () => {
  for (const kind of ["direct", "activation"])
    for (const driftMounted of [false, true]) {
      const io = transport({
        source: ({ id, mounted }) =>
          id === "guestbook" && mounted === driftMounted
            ? { revision: "a".repeat(40) }
            : null,
      });
      await refuse(
        kind,
        run(kind, {
          credential: async () => "fictional-token",
          beforeWrite: async () => {},
          request: io.request,
        }),
      );
      assert.equal(io.posts().length, 0);
      assert.equal(
        io.calls.length,
        driftMounted ? 2 : 1,
        "stop at the first changed source; never retry",
      );
    }
});

test("every real configuration write follows credentials, both exact source checks and fresh workspace guards", async () => {
  const timeline = [];
  const io = transport({
    beforeResponse: ({ id, mounted }) =>
      timeline.push(
        "source:" + id + ":" + (mounted ? "mounted" : "standalone"),
      ),
    post: ({ id, init }) => {
      timeline.push("write:" + id);
      return Response.json({ ok: true, config: JSON.parse(init.body) });
    },
  });
  const result = await applyConfiguration(ids.map(entry), {
    credential: async (id) => {
      timeline.push("credential:" + id);
      return "fictional-token";
    },
    beforeWrite: async (app) => {
      timeline.push("guard:" + app.id);
    },
    request: io.request,
  });
  assert.deepEqual(result.configured, ids);
  assert.deepEqual(
    timeline,
    ids.flatMap((id) => [
      "guard:" + id,
      "credential:" + id,
      "guard:" + id,
      "source:" + id + ":standalone",
      "source:" + id + ":mounted",
      "guard:" + id,
      "write:" + id,
    ]),
  );
  assert.equal(io.posts().length, 2);
});

test("a guard cannot mutate the validated destination, source or exact settings", async () => {
  for (const kind of ["direct", "activation"])
    for (const mutate of [
      (app) => {
        app.url = "https://untrusted.example";
      },
      (app) => {
        app.source.commit = "a".repeat(40);
      },
      (app) => {
        app.configuration.title = "Unexpected overwrite";
      },
    ]) {
      const io = transport();
      let credentials = 0;
      await refuse(
        kind,
        run(kind, {
          credential: () => {
            credentials++;
            return "fictional-token";
          },
          beforeWrite: (app) => mutate(app),
          request: io.request,
        }),
      );
      assert.equal(io.calls.length, 0);
      assert.equal(credentials, 0);
    }
});

test("source changes during credentials, guard or either source response wait are detected by actual apply", async () => {
  for (const kind of ["direct", "activation"])
    for (const waiting of ["credential", "guard", "standalone", "mounted"]) {
      const started = deferred(),
        release = deferred();
      let changed = false,
        guards = 0;
      const io = transport({
        source: () => (changed ? { revision: "b".repeat(40) } : null),
        beforeResponse: async ({ mounted }) => {
          if (waiting === (mounted ? "mounted" : "standalone")) {
            started.resolve();
            await release.promise;
          }
        },
      });
      const result = run(kind, {
        credential: async () => {
          if (waiting === "credential") {
            started.resolve();
            await release.promise;
          }
          return "fictional-token";
        },
        beforeWrite: async () => {
          if (waiting === "guard" && guards++ === 0) {
            started.resolve();
            await release.promise;
          }
        },
        request: io.request,
      });
      try {
        await started.promise;
        changed = true;
        release.resolve();
        await refuse(kind, result);
        assert.equal(io.posts().length, 0);
      } finally {
        release.resolve();
      }
    }
});

test("workspace authority is checked again after credential and source-response waits", async () => {
  for (const kind of ["direct", "activation"])
    for (const waiting of ["credential", "standalone", "mounted"]) {
      const started = deferred(),
        release = deferred();
      let allowed = true;
      const io = transport({
        beforeResponse: async ({ mounted }) => {
          if (waiting === (mounted ? "mounted" : "standalone")) {
            started.resolve();
            await release.promise;
          }
        },
      });
      const result = run(kind, {
        credential: async () => {
          if (waiting === "credential") {
            started.resolve();
            await release.promise;
          }
          return "fictional-token";
        },
        beforeWrite: async () => {
          if (!allowed) throw Error("Workspace changed");
        },
        request: io.request,
      });
      try {
        await started.promise;
        allowed = false;
        release.resolve();
        await refuse(kind, result);
        assert.equal(io.posts().length, 0);
      } finally {
        release.resolve();
      }
    }
});

test("source drift after the first confirmed app leaves that result intact and the second unwritten", async () => {
  for (const kind of ["direct", "activation"]) {
    let firstConfirmed = false;
    const io = transport({
      source: ({ id }) =>
        id === "showcase" && firstConfirmed
          ? { revision: "c".repeat(40) }
          : null,
      post: ({ init }) => {
        firstConfirmed = true;
        return Response.json({ ok: true, config: JSON.parse(init.body) });
      },
    });
    const promise = run(kind, {
      credential: () => "fictional-token",
      beforeWrite: () => {},
      request: io.request,
    });
    if (kind === "direct") await assert.rejects(promise, /source changed/);
    else {
      const result = await promise;
      assert.deepEqual(
        result.configured.map((value) => value.app),
        ["guestbook"],
      );
      assert.equal(result.failed[0].app, "showcase");
      assert.equal(result.publicationUnchanged, true);
    }
    assert.deepEqual(
      io.posts().map((call) => call.id),
      ["guestbook"],
    );
  }
});

test("a committed write with a lost acknowledgement stays unconfirmed and never retries", async () => {
  let committed = 0;
  const io = transport({
    post: () => {
      committed++;
      throw Error("Fictional acknowledgement lost after commit");
    },
  });
  const result = await activateStack(stack(), {
    credential: () => "fictional-token",
    beforeWrite: () => {},
    request: io.request,
  });
  assert.equal(committed, 1);
  assert.equal(io.posts().length, 1);
  assert.deepEqual(result.configured, []);
  assert.equal(result.failed[0].app, "guestbook");
  assert.equal(result.untouched[0].app, "showcase");
  assert.match(result.failed[0].message, /acknowledgement lost after commit/);
  assert.equal(result.publicationUnchanged, true);
});
