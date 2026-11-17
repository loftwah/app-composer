// Standalone manual X export. The approval package owns its own bytes and hashes.
import type { CatalogueAssetDescriptor } from "./share-calendar.ts";

export const SHARE_X_HANDOFF_STATEMENT =
  "Manual export. Review the prepared copy and artwork before posting in X.";

export interface ShareXHandoffInput {
  caption: string;
  exportText: string;
  asset: Pick<
    CatalogueAssetDescriptor,
    | "assetId"
    | "assetRevision"
    | "alt"
    | "renditionUrl"
    | "sourceUrl"
    | "credit"
  >;
}

// A fenced block keeps each selected value exact, including any backticks,
// newlines or Markdown characters it contains.
function fenced(value: string): string {
  const runs = value.match(/`+/g) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}\n${value}\n${fence}`;
}

function inline(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function shareXHandoffMarkdown(input: ShareXHandoffInput): string {
  const { asset } = input;
  return [
    "# X artwork handoff",
    "",
    `> ${SHARE_X_HANDOFF_STATEMENT}`,
    "",
    `- **Artwork:** ${inline(asset.assetId)} · revision ${inline(asset.assetRevision)} · credit ${inline(asset.credit)}`,
    `- **Image (exact checked rendition):** ${asset.renditionUrl}`,
    `- **Source:** ${asset.sourceUrl}`,
    "",
    "## Image alt text",
    "",
    fenced(asset.alt),
    "",
    "## Caption",
    "",
    fenced(input.caption),
    "",
    "## Ready-to-copy text",
    "",
    fenced(input.exportText),
    "",
  ].join("\n");
}

export function shareXHandoffFilename(
  asset: Pick<CatalogueAssetDescriptor, "assetId" | "assetRevision">,
): string {
  const version = asset.assetRevision
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `x-handoff-${asset.assetId}${version ? `-${version}` : ""}.md`;
}
