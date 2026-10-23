import test from "node:test";
import assert from "node:assert/strict";
import {
  builderHref,
  builderParameters,
  builderReturnHref,
  hasBuilderContext,
  WOODHOUSE_BUILDER_RETURN,
  builderNavigationRedirect,
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

test("all observed native reader exits retain exclusion, including client-created launcher links", () => {
  const book = new URL(
    "/guestbook/r/55226db0-675a-400b-ab31-0d79fb6a33fd/c/1/?from=woodhouse-edition&analytics=off&qa=1",
    source,
  );
  const readers = [
    "/",
    "/guestbook/",
    "/showcase/",
    "/guestbook/item/5b4cf3ad-b3c1-4b56-8099-8e3e6d6d39bd",
    "/init",
    "/ready",
    "/learn",
    "/init/content",
    "/docs#standalone-get-ready",
    "/architecture",
    "/guide",
    "/explore",
    "/review",
    "/activity",
    "/apps",
  ];
  for (const path of readers) {
    const target = new URL(builderHref(book, path), book);
    assert.equal(target.searchParams.get("analytics"), "off", path);
    assert.equal(target.searchParams.get("qa"), "1", path);
    assert.equal(target.searchParams.get("from"), "woodhouse-edition", path);
  }
  // The existing native launcher replaces its links after rendering. A normal
  // document GET still retains context using only its same-origin Referer.
  const redirect = builderNavigationRedirect(
    new Request(new URL("/showcase/", book), {
      headers: { Referer: book.href, "User-Agent": "Mozilla/5.0" },
    }),
  );
  assert.equal(redirect.status, 302);
  const showcase = new URL(redirect.headers.get("Location"));
  assert.equal(showcase.searchParams.get("analytics"), "off");
  const next = builderNavigationRedirect(
    new Request(new URL("/", book), { headers: { Referer: showcase.href } }),
  );
  assert.equal(
    new URL(next.headers.get("Location")).searchParams.get("qa"),
    "1",
  );
  assert.equal(
    builderNavigationRedirect(
      new Request(showcase, { headers: { Referer: book.href } }),
    ),
    null,
    "already marked destinations cannot loop",
  );
  for (const path of [
    "/guestbook/owner",
    "/showcase/owner",
    "/_emdash/admin",
    "/api/usage",
    "/guestbook/r/55226db0-675a-400b-ab31-0d79fb6a33fd/api/items",
    "/guestbook/media/fictional",
    "/reports/r971f5140bbe0c84c8147a64b/square.png",
    "/downloads/get-ready-core.tgz",
  ]) {
    assert.equal(builderHref(book, path), path);
    assert.equal(
      builderNavigationRedirect(
        new Request(new URL(path, book), { headers: { Referer: book.href } }),
      ),
      null,
      path,
    );
  }
  assert.equal(
    builderNavigationRedirect(
      new Request("https://composer.loftwah.com/showcase/", {
        headers: { Referer: "https://other.example/?analytics=off" },
      }),
    ),
    null,
  );
  assert.equal(
    builderNavigationRedirect(
      new Request("https://composer.loftwah.com/showcase/", {
        method: "POST",
        headers: { Referer: book.href },
      }),
    ),
    null,
  );
});
test("unrecognised, duplicated and unrelated contexts never activate or propagate", () => {
  for (const url of [
    "/demo",
    "/demo?from=other",
    "/demo?from=woodhouse-edition&from=woodhouse-edition",
    "/_emdash/admin/plugins/composer-stacks/stacks?from=woodhouse-edition",
  ]) {
    const incoming = new URL(url, source);
    assert.equal(hasBuilderContext(incoming), false);
    assert.equal(builderHref(incoming, "/init"), "/init");
  }
});
test("context cannot decorate owner, external, download, image or API destinations", () => {
  for (const path of [
    "/_emdash/admin/plugins/composer-stacks/stacks",
    "/_emdash/admin",
    "/api/usage",
    "/reports/r971f5140bbe0c84c8147a64b/square.png",
    "/downloads/get-ready-core.tgz",
    "https://other.example/demo",
    "//other.example/demo",
  ])
    assert.equal(builderHref(source, path), path);
});
test("the public Creator stacks explanation retains context without decorating its protected editor", () => {
  const studio = builderHref(source, "/studio");
  assert.equal(studio, "/studio?from=woodhouse-edition&analytics=off&qa=1");
  const entry = new URL(studio, source);
  assert.equal(hasBuilderContext(entry), true);
  assert.equal(
    builderHref(entry, "/manage#analytics-proof"),
    "/manage?from=woodhouse-edition&analytics=off&qa=1#analytics-proof",
  );
  const editor = "/_emdash/admin/plugins/composer-stacks/stacks";
  assert.equal(builderHref(entry, editor), editor);
  assert.equal(
    hasBuilderContext(new URL(editor + "?from=woodhouse-edition", source)),
    false,
  );
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
  // Invalid editorial context must not resume measurement for an excluded visit.
  assert.equal(
    builderHref(posted, destination),
    destination + "?analytics=off&qa=1",
  );
});

test("published stack to its native visitor book keeps exclusion and the fixed edition return", () => {
  const stack = new URL(
    "/s/fictional-harbour-notes?from=woodhouse-edition&analytics=off&qa=1",
    source,
  );
  const book = "/guestbook/r/55226db0-675a-400b-ab31-0d79fb6a33fd/c/1/";
  const opened = builderHref(stack, book);
  assert.equal(opened, book + "?from=woodhouse-edition&analytics=off&qa=1");
  const incoming = new URL(opened, source);
  assert.equal(
    builderHref(incoming, book + "contribute"),
    book + "contribute?from=woodhouse-edition&analytics=off&qa=1",
  );
  assert.equal(builderHref(incoming, "/guestbook/owner"), "/guestbook/owner");
  assert.equal(
    builderHref(
      incoming,
      "/guestbook/r/55226db0-675a-400b-ab31-0d79fb6a33fd/api/items",
    ),
    "/guestbook/r/55226db0-675a-400b-ab31-0d79fb6a33fd/api/items",
  );
  assert.equal(builderReturnHref(incoming), builderReturnHref(source));
  const manual = new URL(
    "/s/fictional-harbour-notes?analytics=off&qa=1",
    source,
  );
  assert.equal(builderHref(manual, book), book + "?analytics=off&qa=1");
});
