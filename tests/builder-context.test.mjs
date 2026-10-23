import test from "node:test";
import assert from "node:assert/strict";
import {
  builderHref,
  builderParameters,
  builderReturnHref,
  hasBuilderContext,
  WOODHOUSE_BUILDER_RETURN,
} from "../src/lib/builder-context.mjs";

const source = new URL(
  "https://composer.loftwah.com/demo?from=woodhouse-edition&qa=1&analytics=off&return=https://evil.example",
);
test("one named public builder context preserves its fixed frozen edition return", () => {
  assert.equal(
    WOODHOUSE_BUILDER_RETURN,
    "https://woodhouse.loftwah.com/editions/one-more-round/?report=8496128e32ddfd0bddf8da66#build",
  );
  assert.equal(
    builderHref(source, "/manage#analytics-proof"),
    "/manage?from=woodhouse-edition&analytics=off&qa=1#analytics-proof",
  );
  assert.equal(
    builderHref(source, "/init?start=workbench#starting-point"),
    "/init?start=workbench&from=woodhouse-edition&analytics=off&qa=1#starting-point",
  );
  assert.equal(
    builderHref(source, "/reports/r971f5140bbe0c84c8147a64b"),
    "/reports/r971f5140bbe0c84c8147a64b?from=woodhouse-edition&analytics=off&qa=1",
  );
});
test("unrecognised, duplicated and unrelated contexts never activate or propagate", () => {
  for (const url of [
    "/demo",
    "/demo?from=other",
    "/demo?from=woodhouse-edition&from=woodhouse-edition",
    "/studio?from=woodhouse-edition",
  ]) {
    const incoming = new URL(url, source);
    assert.equal(hasBuilderContext(incoming), false);
    assert.equal(builderHref(incoming, "/init"), "/init");
  }
});
test("context cannot decorate owner, external, download, image or API destinations", () => {
  for (const path of [
    "/studio",
    "/_emdash/admin",
    "/api/usage",
    "/reports/r971f5140bbe0c84c8147a64b/square.png",
    "/downloads/get-ready-core.tgz",
    "https://other.example/demo",
    "//other.example/demo",
  ])
    assert.equal(builderHref(source, path), path);
});
test("only explicit verification controls propagate; existing target scope is retained", () => {
  const url = new URL("/demo?from=woodhouse-edition&qa=2&analytics=on", source);
  assert.equal(
    builderHref(url, "/activity?days=7&surface=composed"),
    "/activity?days=7&surface=composed&from=woodhouse-edition",
  );
  assert.equal(
    builderHref(source, "#composition-workbench"),
    "#composition-workbench",
  );
  assert.equal(
    builderReturnHref(source),
    "https://woodhouse.loftwah.com/editions/one-more-round/?report=8496128e32ddfd0bddf8da66&analytics=off&qa=1#build",
  );
  assert.deepEqual(builderParameters(source), [
    ["from", "woodhouse-edition"],
    ["analytics", "off"],
    ["qa", "1"],
  ]);
  assert.deepEqual(builderParameters(new URL("/activity", source)), []);
});
test("a frozen-report form continues context only in its redirect, rejecting duplicate context", () => {
  const destination = "/reports/r971f5140bbe0c84c8147a64b";
  const posted = new URL(
    "/reports/new?from=woodhouse-edition&days=7&qa=1&analytics=off",
    source,
  );
  assert.equal(
    builderHref(posted, destination),
    destination + "?from=woodhouse-edition&analytics=off&qa=1",
  );
  posted.searchParams.append("from", "woodhouse-edition");
  assert.equal(builderHref(posted, destination), destination);
});
