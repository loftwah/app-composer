import test from "node:test";
import assert from "node:assert/strict";
import { planPublisherReconciliation } from "../lib/wordpress/reconcile.mjs";
const a = "01M5S4HZ774APJ27KHHCGQ0S50",
  b = "01M5S47X1322YPDDT7C3F2R0CD";
function fixture() {
  return {
    sourceOrigins: ["https://old.example.test", "https://source.example.test"],
    source: {
      media: [
        {
          id: 1,
          url: "https://source.example.test/wp-content/uploads/photo.webp",
          sha256: "a".repeat(64),
          alt: "Source description",
          caption: "Source caption",
        },
      ],
      articles: [
        {
          id: 2,
          slug: "story",
          url: "https://source.example.test/2026/story/",
          featuredImage: 1,
        },
      ],
      pages: [],
    },
    media: [
      {
        id: a,
        sha256: "a".repeat(64),
        url: "/_emdash/api/media/file/owned.webp",
        alt: null,
        caption: null,
      },
    ],
    entries: [
      {
        id: b,
        collection: "posts",
        slug: "story",
        revision: "observed-1",
        data: {
          title: "Owner title",
          content: [
            {
              _type: "block",
              children: [{ text: "Keep the owner paragraph" }],
              markDefs: [
                {
                  href: "https://old.example.test/wp-content/uploads/photo.webp",
                },
                { href: "https://elsewhere.test/leave" },
              ],
            },
          ],
          featured_image: {
            provider: "external",
            src: "https://old.example.test/wp-content/uploads/photo.webp",
          },
        },
      },
    ],
  };
}
test("exact byte matches repair retired source references without changing owner prose or publication", () => {
  const f = fixture(),
    before = structuredClone(f),
    p = planPublisherReconciliation(f);
  assert.deepEqual(f, before);
  assert.equal(p.entryPatches[0]._rev, "observed-1");
  assert.equal(p.entryPatches[0].data.title, undefined);
  assert.equal(
    p.entryPatches[0].data.content[0].children[0].text,
    "Keep the owner paragraph",
  );
  assert.equal(
    p.entryPatches[0].data.content[0].markDefs[0].href,
    "/_emdash/api/media/file/owned.webp",
  );
  assert.equal(
    p.entryPatches[0].data.content[0].markDefs[1].href,
    "https://elsewhere.test/leave",
  );
  assert.equal(p.entryPatches[0].data.featured_image.id, a);
  assert.equal(p.mediaPatches[0].patch.alt, "Source description");
  assert.equal(p.entryPatches[0].status, undefined);
});
test("ambiguous or absent media bytes never pick a filename guess", () => {
  for (const ambiguous of [false, true]) {
    const f = fixture();
    if (ambiguous) f.media.push({ ...f.media[0], id: b });
    else f.media = [];
    const p = planPublisherReconciliation(f);
    assert.equal(p.unresolved.length, 1);
    assert.equal(p.entryPatches.length, 0);
  }
});
test("destination customisations and supplied media metadata survive", () => {
  const f = fixture();
  f.entries[0].data.featured_image = { provider: "local", id: b };
  f.media[0].alt = "Owner alt";
  f.media[0].caption = "Owner caption";
  const p = planPublisherReconciliation(f);
  assert.equal(p.entryPatches[0].data.featured_image, undefined);
  assert.deepEqual(p.mediaPatches, []);
});
test("unreviewed origins, duplicate slugs and non-owned destinations refuse", () => {
  for (const change of [
    (f) => (f.sourceOrigins = ["https://elsewhere.test"]),
    (f) => f.entries.push(f.entries[0]),
    (f) => (f.media[0].url = "https://foreign.test/photo.webp"),
    (f) => (f.sourceOrigins = ["https://source.example.test/path"]),
  ]) {
    const f = fixture();
    change(f);
    assert.throws(() => planPublisherReconciliation(f));
  }
});

test("an already-local featured image retains its owner alt, focal metadata and dimensions", () => {
  const f = fixture();
  f.entries[0].data.featured_image = {
    provider: "local",
    id: a,
    src: f.media[0].url,
    alt: "Owner image description",
    width: 800,
    height: 600,
    meta: { storageKey: "owned.webp", focalX: 0.25, focalY: 0.75 },
  };
  const plan = planPublisherReconciliation(f);
  assert.equal(plan.entryPatches[0].data.featured_image, undefined);
});
test("unresolved imported references gain a local identity without discarding owner image choices", () => {
  const f = fixture();
  f.entries[0].data.featured_image = {
    provider: "external",
    id: "",
    src: f.media[0].url,
    alt: "Owner image description",
    width: 800,
    height: 600,
    meta: { focalX: 0.25, focalY: 0.75 },
  };
  const next =
    planPublisherReconciliation(f).entryPatches[0].data.featured_image;
  assert.equal(next.id, a);
  assert.equal(next.provider, "local");
  assert.equal(next.alt, "Owner image description");
  assert.equal(next.width, 800);
  assert.equal(next.height, 600);
  assert.deepEqual(next.meta, {
    focalX: 0.25,
    focalY: 0.75,
    storageKey: "owned.webp",
  });
  assert.equal(next.src, undefined);
});
