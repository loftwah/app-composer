import assert from "node:assert/strict";
import test from "node:test";
import { readCreatorHubRelease } from "../src/lib/creator-hub-release.ts";

test("Creator Hub reuses a timed release observation and refreshes both identities", async () => {
  let time = 100_000;
  let requests = 0;
  let refresh = false;
  const request = async (url, options) => {
    requests++;
    assert.equal(url.pathname, "/build.json");
    assert.equal(options.redirect, "manual");
    if (url.hostname === "creator-hub.loftwah.com") {
      return Response.json({ app: "showcase", revision: refresh ? "bad" : "a".repeat(40) });
    }
    assert.equal(url.hostname, "creator-hub-guestbook.loftwah.com");
    return Response.json({ app: refresh ? "showcase" : "guestbook", revision: "b".repeat(40) });
  };
  const read = () => readCreatorHubRelease(request, () => time);

  const first = await read();
  assert.deepEqual(first, {
    checkedAt: 100_000,
    revisions: { showcase: "a".repeat(40), guestbook: "b".repeat(40) },
  });
  time += 59_999;
  assert.deepEqual(await read(), first);
  assert.equal(requests, 2);

  time++;
  refresh = true;
  assert.deepEqual(await read(), {
    checkedAt: 160_000,
    revisions: { showcase: null, guestbook: null },
  });
  assert.equal(requests, 4);

  time += 60_000;
  const redirect = () => Response.redirect("https://example.com/build.json");
  assert.deepEqual((await readCreatorHubRelease(redirect, () => time)).revisions, {
    showcase: null,
    guestbook: null,
  });
});
