import { type ExperienceId, twentyOneQuestions } from "../lib/share-experiences.ts";
import {
  splitTwentyOneCards, twentyOneAnswered, twentyOneCount, twentyOnePairs,
} from "../lib/twenty-one-questions.ts";

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
  /** Canonical source links per exhibit. Interactive only: exports stay text-only. */
  hrefs?: (string | null)[];
  /** Frozen authored prompts for a private twenty-one-questions run. Card
   * exports only: results never travel in a link, so this stays in the tab. */
  questions?: string[];
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
  "this-or-that": [["#10333c", "#f3faf3", "#ff6a4d"], ["#e8ddc4", "#1c2a24", "#b3372a"], ["#10161d", "#dff1ff", "#9fd4ff"]],
  "twenty-one-questions": [["#f0e7d0", "#33202e", "#b06010"], ["#241a33", "#e9ddc6", "#d9a441"], ["#e7ecdc", "#22301f", "#5c7a3f"]],
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

/** The publisher line every exported card carries: the approved mark, the
 * product name and site, and one optional byline. Shared by every experience
 * renderer so single images and card sets sign off identically. */
function signCard(
  ctx: CanvasRenderingContext2D,
  mark: HTMLImageElement,
  width: number,
  margin: number,
  footer: number,
  ink: string,
  byline: string,
) {
  ctx.drawImage(mark, margin, footer, 36, 36);
  ctx.fillStyle = ink;
  ctx.font = "700 24px system-ui";
  ctx.fillText("Made with App Composer", margin + 47, footer + 16);
  ctx.font = "600 18px system-ui";
  ctx.fillText("composer.loftwah.com", margin + 47, footer + 40);
  if (byline) {
    ctx.textAlign = "right";
    ctx.font = "700 24px system-ui";
    ctx.fillText(byline, width - margin, footer + 26, width - margin * 2 - 370);
    ctx.textAlign = "left";
  }
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
  // A portrait Top Nine hangs a true square 3×3: the header cedes the frame's
  // extra height so each cell keeps its own width and square covers are not
  // cropped to fill 4:5. The square export and other games keep their sizes.
  const squareNine = format === "portrait" && result.game === "top-nine";
  const header = wide ? 120 : squareNine ? footer - width + margin - 30 : Math.round(height * .18);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, margin, width - 2 * margin, 3);
  ctx.fillStyle = ink;
  drawFit(ctx, result.title, margin, margin + 12, width - 2 * margin, header - 12, wide ? 66 : 105);
  if (result.items) {
    const cols = result.game === "tech-bingo" ? 5 : result.game === "this-or-that" ? 1 : 3;
    const rows = Math.ceil(result.items.length / cols);
    const rowY = margin + header + 12;
    const gap = wide ? 6 : 9;
    const cellW = (width - margin * 2 - (cols - 1) * gap) / cols;
    const cellH = (footer - rowY - (rows - 1) * gap - 18) / rows;
    result.items.forEach((caption, index) => {
      const x = margin + (index % cols) * (cellW + gap);
      const y = rowY + Math.floor(index / cols) * (cellH + gap);
      const marked = result.game === "tech-bingo" && Boolean(result.marked?.includes(index));
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
  signCard(ctx, mark, width, margin, footer, ink, result.byline);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export image")), "image/png");
  });
}

/** A twenty-one-questions export: the answered pairs split across several
 * portrait 4:5 cards by default, or the same set on a taller 9:16 Story canvas.
 * Both draw the same ordered, numbered groups; only the Story canvas lifts the
 * content into the viewer's safe area. Answers arrive only in the in-memory
 * snapshot the caller already holds. */
export async function renderExperienceCards(result: ShareExperienceResult, format: "portrait" | "story" = "portrait"): Promise<Blob[]> {
  // Both formats draw the same frozen prompt set the caller’s snapshot holds:
  // a malformed snapshot falls back to the built-in starter, never to a mix.
  const questions = Array.isArray(result.questions) && result.questions.length === twentyOneCount
    ? result.questions
    : twentyOneQuestions;
  const pairs = twentyOnePairs(result.items ?? [], questions);
  if (!pairs.length) throw new Error("No answers to export");
  const cards = splitTwentyOneCards(pairs);
  const [width, height] = resultSizes[format];
  const margin = Math.round(Math.min(width, height) * .067);
  // A Story sits under the viewer's profile row and reply bar. Keep the print
  // width and the card split, but lift the whole layout inside those insets so
  // no heading, answer or sign-off is covered by Story chrome. Portrait has
  // both insets at zero, leaving every 4:5 coordinate exactly as it was.
  const safeTop = format === "story" ? Math.round(height * .13) : 0;
  const safeBottom = format === "story" ? Math.round(height * .17) : 0;
  const top = margin + safeTop;
  const footer = height - safeBottom - margin - 42;
  const mark = await picture("/brand/composer-icon-20261022b-96.png");
  const [paper, ink, accent] = inks[result.game][result.skin] ?? inks[result.game][0];
  const answered = twentyOneAnswered(result.items ?? []);
  const inner = width - margin * 2;
  const blobs: Blob[] = [];
  for (const [card, group] of cards.entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image rendering is unavailable");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(margin, top, inner, 3);
    ctx.fillStyle = ink;
    drawFit(ctx, result.title, margin, top + 14, inner, 96, 64);
    ctx.font = "600 24px system-ui";
    ctx.globalAlpha = .75;
    ctx.fillText(`${answered} of ${twentyOneCount} answered · card ${card + 1} of ${cards.length}`, margin, top + 132, inner);
    ctx.globalAlpha = 1;
    // Rows share the body evenly, so a short last card breathes and a full
    // card shrinks its longest answers to fit instead of clipping them.
    const rowsY = top + 158;
    const rowH = (footer - rowsY - 24) / group.length;
    group.forEach((pair, row) => {
      const y = rowsY + row * rowH;
      if (row) {
        ctx.save();
        ctx.globalAlpha = .3;
        ctx.fillStyle = ink;
        ctx.fillRect(margin, y - 10, inner, 2);
        ctx.restore();
      }
      ctx.fillStyle = accent;
      const ask = fitText(ctx, `${pair.index + 1}. ${pair.question}`, inner, rowH * .42, 30);
      ask.lines.forEach((line, lineIndex) => {
        ctx.fillText(line, margin, y + 12 + ask.size + lineIndex * ask.size * 1.14, inner);
      });
      const answerTop = y + 12 + ask.lines.length * ask.size * 1.14 + 8;
      ctx.fillStyle = ink;
      drawFit(ctx, pair.answer, margin, answerTop, inner, y + rowH - 14 - answerTop, 36);
    });
    signCard(ctx, mark, width, margin, footer, ink, result.byline);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not export image");
    blobs.push(blob);
  }
  return blobs;
}
