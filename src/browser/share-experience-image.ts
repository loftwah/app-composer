import type { ExperienceId } from "../lib/share-experiences.ts";

export const resultSizes = {
  portrait: [1080, 1350], story: [1080, 1920], square: [1080, 1080], wide: [1200, 630],
} as const;
export type ResultFormat = keyof typeof resultSizes;
export interface ShareExperienceResult {
  game: ExperienceId;
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
  /** Canonical music links per exhibit. Interactive only: exports stay text-only. */
  hrefs?: (string | null)[];
  byline: string;
  skin: number;
  background: string;
}

/**
 * Cover art per exhibit, drawn only into the downloaded PNG. It arrives as its
 * own argument — never inside the result snapshot — so no link, draft or JSON
 * path can carry a person's photo bytes.
 */
export type ResultCover = HTMLCanvasElement;

const inks = {
  "pick-a-door": [["#1c102a", "#f8e9d0", "#ffbc65"], ["#e8d9bf", "#251d14", "#8b392c"], ["#182a21", "#eaffd4", "#a7e679"]],
  "top-nine": [["#361c60", "#fff1d5", "#ffbFA0"], ["#f3be78", "#25202a", "#692642"], ["#141f2c", "#e4f1ff", "#a4ccff"]],
  "tech-bingo": [["#841424", "#ffeed7", "#ffd08a"], ["#164934", "#fff6db", "#fdcb63"], ["#ece3d6", "#251a19", "#982b3d"]],
} as const;

function picture(path: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = path;
  return image.decode().then(() => image);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest bold size at or below `initial` whose wrapped text fits `height`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, width: number, height: number, initial: number) {
  let size = initial;
  let lines: string[] = [];
  do {
    ctx.font = `700 ${size}px system-ui`;
    lines = wrap(ctx, text, width);
    if (lines.length * size * 1.14 <= height) break;
    size -= 2;
  } while (size > 12);
  return { size, lines };
}

function drawFit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, initial: number) {
  const { size, lines } = fitText(ctx, text, width, height, initial);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + size + index * size * 1.14, width);
  });
}

export async function renderExperienceResult(
  result: ShareExperienceResult,
  format: ResultFormat,
  covers?: readonly (ResultCover | null)[],
) {
  const [width, height] = resultSizes[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable");
  const [paper, ink, accent] = inks[result.game][result.skin] ?? inks[result.game][0];
  const margin = Math.round(Math.min(width, height) * .067);
  const wide = format === "wide";
  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  const footer = height - margin - 42;
  const header = wide ? 120 : Math.round(height * .18);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, margin, width - 2 * margin, 3);
  ctx.fillStyle = ink;
  drawFit(ctx, result.title, margin, margin + 12, width - 2 * margin, header - 12, wide ? 66 : 105);
  if (result.items) {
    const cols = result.game === "tech-bingo" ? 5 : 3;
    const rows = Math.ceil(result.items.length / cols);
    const rowY = margin + header + 12;
    const gap = wide ? 6 : 9;
    const cellW = (width - margin * 2 - (cols - 1) * gap) / cols;
    const cellH = (footer - rowY - (rows - 1) * gap - 18) / rows;
    result.items.forEach((caption, index) => {
      const x = margin + (index % cols) * (cellW + gap);
      const y = rowY + Math.floor(index / cols) * (cellH + gap);
      const marked = result.marked?.includes(index);
      const cover = result.game === "top-nine" ? covers?.[index] : undefined;
      const inset = wide ? 9 : 15;
      ctx.fillStyle = marked ? accent : ink;
      ctx.fillRect(x, y, cellW, cellH);
      if (!cover) {
        ctx.fillStyle = paper;
        drawFit(ctx, caption || "—", x + inset, y + inset, cellW - inset * 2, cellH - inset * 2, wide ? 24 : cols === 5 ? 28 : 43);
      } else if (wide) {
        // Landscape strips are shallow: contain the art in a matted square and
        // keep the readable title beside it.
        const mat = cellH;
        const scale = Math.min(mat / cover.width, mat / cover.height);
        const dw = cover.width * scale;
        const dh = cover.height * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cover, x + (mat - dw) / 2, y + (mat - dh) / 2, dw, dh);
        ctx.strokeStyle = paper;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + (mat - dw) / 2, y + (mat - dh) / 2, dw, dh);
        ctx.fillStyle = paper;
        drawFit(ctx, caption || "—", x + mat + inset, y + inset, cellW - mat - inset * 2, cellH - inset * 2, 24);
      } else {
        // Square-ish cells hang the art edge to edge (cover) and keep the
        // title readable on a scrim of the same ink the solid cells use.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellW, cellH);
        ctx.clip();
        const scale = Math.max(cellW / cover.width, cellH / cover.height);
        const dw = cover.width * scale;
        const dh = cover.height * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cover, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
        ctx.restore();
        const fit = fitText(ctx, caption || "—", cellW - inset * 2, cellH * .5, 43);
        const captionH = fit.lines.length * fit.size * 1.14;
        const bandTop = y + cellH - captionH - inset * 1.2;
        ctx.save();
        ctx.globalAlpha = .84;
        ctx.fillStyle = ink;
        ctx.fillRect(x, bandTop, cellW, y + cellH - bandTop);
        ctx.restore();
        ctx.fillStyle = paper;
        const first = y + cellH - inset - captionH;
        fit.lines.forEach((line, lineIndex) => {
          ctx.fillText(line, x + inset, first + fit.size + lineIndex * fit.size * 1.14, cellW - inset * 2);
        });
      }
      if (marked && index !== 12) {
        ctx.strokeStyle = paper;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 7, y + cellH - 8); ctx.lineTo(x + cellW - 8, y + 8); ctx.stroke();
      }
    });
  } else {
    const art = await picture(result.background);
    const panelY = margin + header;
    const panelH = footer - panelY - 24;
    const panelW = wide ? Math.floor(width * .35) : width - 2 * margin;
    const imageH = wide ? panelH : Math.round(panelH * .68);
    const scale = Math.min(panelW / art.width, imageH / art.height);
    ctx.drawImage(art, margin + (panelW - art.width * scale) / 2, panelY, art.width * scale, art.height * scale);
    const textX = wide ? margin * 2 + panelW : margin;
    const textY = wide ? panelY + 15 : panelY + imageH + 16;
    drawFit(ctx, result.subtitle ?? "", textX, textY, width - textX - margin, footer - textY - 10, wide ? 39 : 48);
  }
  ctx.drawImage(mark, margin, footer, 36, 36);
  ctx.fillStyle = ink;
  ctx.font = "700 24px system-ui";
  ctx.fillText("Made with App Composer", margin + 47, footer + 16);
  ctx.font = "600 18px system-ui";
  ctx.fillText("composer.loftwah.com", margin + 47, footer + 40);
  if (result.byline) {
    ctx.textAlign = "right";
    ctx.font = "700 24px system-ui";
    ctx.fillText(result.byline, width - margin, footer + 26, width - margin * 2 - 370);
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export image")), "image/png");
  });
}
