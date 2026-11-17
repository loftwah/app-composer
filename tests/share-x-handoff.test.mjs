// Focused regression for the standalone X artwork handoff (#604).
// The fixture is local: it proves the handoff carries the exact checked
// artwork values and stays outside the approval package and Bluesky approval.
import test from "node:test";
import assert from "node:assert/strict";
import {
  SHARE_X_HANDOFF_STATEMENT,
  shareXHandoffFilename,
  shareXHandoffMarkdown,
} from "../src/lib/share-x-handoff.ts";

const asset = {
  assetId: "workshop-image",
  title: "Workshop image",
  assetRevision: "v3-20261116",
  renditionUrl: "https://woodhouse.loftwah.com/campaign/workshop-preview.jpg",
  mimeType: "image/jpeg",
  byteLength: 4096,
  bytesSha256: "b".repeat(64),
  alt: "A paper tag under a press.",
  credit: "Foilbury Studio",
  projectUrl: "https://example.com/workshop",
  sourceUrl: "https://woodhouse.loftwah.com/campaign/provenance.txt",
  rightsConfirmedBy: "fictional-owner",
  rightsConfirmedAt: "2026-11-16T00:00:00.000Z",
};

const caption = "A public artwork draft. 🌏";
const exportText = `${caption}\n\nArtwork by ${asset.credit}\n${asset.projectUrl}`;

test("handoff carries the exact checked artwork values", () => {
  const markdown = shareXHandoffMarkdown({ caption, exportText, asset });
  assert.ok(markdown.includes(asset.renditionUrl));
  assert.ok(markdown.includes(asset.sourceUrl));
  assert.ok(markdown.includes(asset.assetRevision));
  assert.ok(markdown.includes(asset.alt));
  assert.ok(markdown.includes(caption));
  assert.ok(markdown.includes(exportText));
  assert.ok(markdown.includes(SHARE_X_HANDOFF_STATEMENT));
});

test("handoff keeps each selected value intact inside a fence", () => {
  const trickyAlt = "A `tag`\nunder a press.";
  const markdown = shareXHandoffMarkdown({
    caption,
    exportText,
    asset: { ...asset, alt: trickyAlt },
  });
  assert.ok(markdown.includes("```\n" + trickyAlt + "\n```"));
});

test("handoff stays separate from approval and Bluesky approval", () => {
  const markdown = shareXHandoffMarkdown({ caption, exportText, asset });
  assert.ok(!markdown.includes("composer.share-approval-package"));
  assert.ok(!markdown.includes("composer.bluesky-approval"));
  assert.ok(!markdown.includes("textHash"));
  assert.ok(!markdown.includes("mediaHash"));
  assert.ok(!markdown.includes("approval revision"));
  assert.ok(!markdown.includes("rightsConfirmedBy"));
});

test("filename is a Markdown file named from the asset and version", () => {
  assert.equal(
    shareXHandoffFilename(asset),
    "x-handoff-workshop-image-v3-20261116.md",
  );
  assert.equal(
    shareXHandoffFilename({ assetId: "plain", assetRevision: "v1 / beta" }),
    "x-handoff-plain-v1-beta.md",
  );
});
