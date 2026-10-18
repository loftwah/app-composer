import test from "node:test";
import assert from "node:assert/strict";
import { localMediaPolicy } from "../src/lib/local-media-policy.mjs";

test("local image policy stays closed unless an exact owned origin is selected", () => {
  assert.equal(localMediaPolicy(undefined), undefined);
  assert.deepEqual(localMediaPolicy("http://localhost:53981"), {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "53981",
        pathname: "/_emdash/api/media/file/**",
      },
    ],
  });
});

test("local image policy refuses malformed and broader authority", () => {
  for (const value of [
    "",
    null,
    {},
    ["http://localhost:53981"],
    "https://localhost:53981",
    "http://127.0.0.1:53981",
    "http://localhost",
    "http://localhost:0",
    "http://localhost:65536",
    "http://user:secret@localhost:53981",
    "http://localhost:53981/",
    "http://localhost:53981/_emdash/api/media/file/",
    "http://localhost:53981?path=/_emdash/api/media/file/",
    "http://localhost:53981#fragment",
    "http://LOCALHOST:53981",
    "http://localhost:053981",
    " http://localhost:53981",
    "https://composer.loftwah.com",
    "http://localhost.example.test:53981",
  ])
    assert.throws(
      () => localMediaPolicy(value),
      /exact owned localhost origin/,
    );
});
