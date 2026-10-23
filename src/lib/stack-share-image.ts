import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { shareImageReady } from "./share-image-ready.ts";
import wasm from '@resvg/resvg-wasm/index_bg.wasm?module';
import fontBuffer from '../assets/fonts/SpaceGrotesk.ttf.bin';
import brandBuffer from '../assets/composer-icon-20261022b-96.png.bin';
import { stackShareSvg } from './stack-share-svg.ts';
import type { PublishedStackShare, StackShareDetails } from './stack-sharing.ts';

// Cloudflare/Vite imports this as a precompiled WebAssembly.Module. Workers
// forbids compiling arbitrary WASM bytes; no fetch or runtime compilation occurs.
// The promise is shared by simultaneous requests in this isolate.
const font = new Uint8Array(fontBuffer);
// Import the selected 96px raster as bytes, like the bundled font. The SVG
// receives only this fixed image; neither rendering nor module setup fetches it.
const brandImage = `data:image/png;base64,${btoa(Array.from(new Uint8Array(brandBuffer), byte => String.fromCharCode(byte)).join(''))}`;
export async function renderStackShareImage(stack: PublishedStackShare, share: StackShareDetails): Promise<Uint8Array<ArrayBuffer>> {
  await shareImageReady(() => initWasm(wasm));
  const fontOptions = {font: {fontBuffers: [font], defaultFontFamily: 'Space Grotesk'}};
  const measure = (text: string, size: number, weight: number): number => {
    const safe = text.replace(/[<>&"']/g, character => `&#${character.charCodeAt(0)};`);
    const svg = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="200"><text x="0" y="100" font-family="Space Grotesk" font-size="${size}" font-weight="${weight}">${safe}</text></svg>`, fontOptions);
    const box = svg.innerBBox();
    const width = box?.width ?? 0;
    box?.free();
    svg.free();
    return width;
  };
  const renderer = new Resvg(stackShareSvg(stack, share, measure, brandImage), fontOptions);
  try {
    const image = renderer.render();
    try { return new Uint8Array(image.asPng()); }
    finally { image.free(); }
  } finally {
    renderer.free();
  }
}
