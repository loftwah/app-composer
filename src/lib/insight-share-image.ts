import { initWasm } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm?module";
import fontBuffer from "../assets/fonts/SpaceGrotesk.ttf.bin";
import brandBuffer from "../assets/composer-icon-20261022b-96.png.bin";
import { shareImageReady } from "./share-image-ready.ts";
import {
  insightTextMeasure,
  renderInsightCard,
} from "./insight-card-render.ts";
import { insightShareSvg } from "./insight-share-svg.ts";
import type { RecordedOpensInsight } from "./activity-insight.ts";

const font = new Uint8Array(fontBuffer);
const brandImage = `data:image/png;base64,${btoa(
  Array.from(new Uint8Array(brandBuffer), (byte) =>
    String.fromCharCode(byte),
  ).join(""),
)}`;

export async function renderInsightImage(
  insight: RecordedOpensInsight,
): Promise<Uint8Array<ArrayBuffer>> {
  await shareImageReady(() => initWasm(wasm));
  return renderInsightCard(
    insightShareSvg(insight, insightTextMeasure(font), brandImage),
    font,
  );
}
