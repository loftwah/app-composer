// One rendering path for the Worker route and the focused image test. The
// caller owns the resvg WASM module; assets are passed in so a Node test can
// render the identical SVG without the Astro `?module` imports.
import { Resvg } from "@resvg/resvg-wasm";

export type Measure = (text: string, size: number, weight: number) => number;

const fontOptions = (font: Uint8Array) => ({
  font: { fontBuffers: [font], defaultFontFamily: "Space Grotesk" },
});
const escapeXml = (value: string): string =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );

export function insightTextMeasure(font: Uint8Array, width = 1200): Measure {
  return (text, size, weight) => {
    const renderer = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="200"><text x="0" y="100" font-family="Space Grotesk" font-size="${size}" font-weight="${weight}">${escapeXml(text)}</text></svg>`,
      fontOptions(font),
    );
    try {
      const box = renderer.innerBBox();
      const measured = box?.width ?? 0;
      box?.free();
      return measured;
    } finally {
      renderer.free();
    }
  };
}

export function renderInsightCard(
  svg: string,
  font: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const renderer = new Resvg(svg, fontOptions(font));
  try {
    const image = renderer.render();
    try {
      return new Uint8Array(image.asPng());
    } finally {
      image.free();
    }
  } finally {
    renderer.free();
  }
}
