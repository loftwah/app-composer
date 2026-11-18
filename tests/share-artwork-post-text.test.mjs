import test from "node:test";
import assert from "node:assert/strict";
import { artworkPostText } from "../src/lib/share-artwork-post.ts";

const artwork = {
  title: "One platform. Independent apps",
  description:
    "App Composer. Japanese paper theatre viewed from backstage, handmade cut edges and colour gels.",
  credit: "Woodhouse · gpt-image-2.6-flare · Tabler Icons (MIT)",
  projectUrl: "https://composer.loftwah.com/",
  shareUrl: "https://woodhouse.loftwah.com/share/app-composer/",
  kitUrl: null,
  sourceUrl:
    "https://woodhouse.loftwah.com/campaign/20261114-atlas-lab/manifest.json",
};
const canonical =
  "https://composer.loftwah.com/share/artwork/atlas-04-composer-family";

test("post text is only displayed public fields plus the clean canonical URL", () => {
  const text = artworkPostText(artwork, canonical);
  assert.equal(
    text,
    [
      artwork.title,
      artwork.description,
      artwork.credit,
      artwork.sourceUrl,
      canonical,
    ].join("\n\n"),
  );
  assert.doesNotMatch(
    text,
    /\?|#|share=|back=|art=|\/api\/share-artwork-download/,
  );
});

test("post text omits absent displayed fields and keeps the canonical", () => {
  const text = artworkPostText(
    { ...artwork, description: "", projectUrl: null, sourceUrl: null },
    canonical,
  );
  assert.equal(
    text,
    [artwork.title, artwork.credit, canonical].join("\n\n"),
  );
});
