import { type ExperienceId, twentyOneQuestions } from "../lib/share-experiences.ts";
import {
  splitTwentyOneCards, twentyOneAnswered, twentyOneCardSize, twentyOneCount, twentyOnePairs,
  twentyOneSquareCardSize,
} from "../lib/twenty-one-questions.ts";

export const resultSizes = {
  portrait: [1080, 1350], story: [1080, 1920], square: [1080, 1080], wide: [1200, 630],
} as const;
export type ResultFormat = keyof typeof resultSizes;

/** Grid columns for an items export. A five keeps its single full-width column
 * — the built-in This or That drawing is unchanged — while an authored nine
 * reuses the 3 × 3 grid the Top Nine exhibition already prints for exactly
 * nine short texts. One column at nine would squeeze portrait cells to about
 * a third of their height (and far less on square and landscape), dropping
 * option text toward the fit floor; the grid keeps every choice at the same
 * starting size the five uses, in taller cells than the five-row layout. */
export function resultColumns(game: ExperienceId, itemCount: number): 1 | 3 | 5 {
  if (game === "tech-bingo") return 5;
  if (game === "this-or-that") return itemCount === 9 ? 3 : 1;
  return 3;
}
export interface ShareExperienceResult {
  game: ExperienceId;
  title: string;
  subtitle?: string;
  items?: string[];
  marked?: number[];
  /** Canonical source links per exhibit. Interactive only: exports stay text-only. */
  hrefs?: (string | null)[];
  /** Explicit ranked board: occupied slots print #1–#9 in every format.
   * Absent keeps unordered favourites, so old links and drafts stay as they were. */
  ranked?: boolean;
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

/** The numbered chip an explicitly ranked Top Nine prints in one occupied slot.
 * It uses the board's accent and paper, so all three skins keep their contrast. */
function rankChipHeight(size: number) {
  return Math.round(size * 1.5);
}

function drawRank(
  ctx: CanvasRenderingContext2D,
  rank: number,
  x: number,
  y: number,
  size: number,
  paper: string,
  accent: string,
) {
  const label = `#${rank}`;
  const pad = Math.round(size * .34);
  const height = rankChipHeight(size);
  ctx.save();
  ctx.font = `800 ${size}px system-ui`;
  const width = Math.ceil(ctx.measureText(label).width) + pad * 2;
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = paper;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + pad, y + height / 2 + 1);
  ctx.restore();
  return height;
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
    const cols = resultColumns(result.game, result.items.length);
    const rows = Math.ceil(result.items.length / cols);
    const rowY = margin + header + 12;
    const gap = wide ? 6 : 9;
    const cellW = (width - margin * 2 - (cols - 1) * gap) / cols;
    const cellH = (footer - rowY - (rows - 1) * gap - 18) / rows;
    // An explicitly ranked Top Nine numbers each occupied slot in every
    // format; an unordered board keeps exactly the previous drawing.
    const ranked = result.game === "top-nine" && result.ranked === true;
    const rankSize = Math.max(13, Math.min(30, Math.round(Math.min(cellW, cellH) * (wide ? .16 : .1))));
    const rankFor = (caption: string, index: number) => ranked && caption.trim() ? index + 1 : 0;
    result.items.forEach((caption, index) => {
      const x = margin + (index % cols) * (cellW + gap);
      const y = rowY + Math.floor(index / cols) * (cellH + gap);
      const marked = result.game === "tech-bingo" && Boolean(result.marked?.includes(index));
      const cover = result.game === "top-nine" ? covers?.[index] : undefined;
      const inset = wide ? 9 : 15;
      const rank = rankFor(caption, index);
      ctx.fillStyle = marked ? accent : ink;
      ctx.fillRect(x, y, cellW, cellH);
      if (!cover) {
        ctx.fillStyle = paper;
        let top = y + inset;
        let room = cellH - inset * 2;
        if (rank) {
          const used = drawRank(ctx, rank, x + inset, top, rankSize, paper, accent)
            + Math.max(6, Math.round(inset * .5));
          top += used;
          room -= used;
        }
        drawFit(ctx, caption || "—", x + inset, top, cellW - inset * 2, Math.max(room, rankSize), wide ? 24 : cols === 5 ? 28 : 43);
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
        let titleY = y + inset;
        let titleH = cellH - inset * 2;
        if (rank) {
          const used = drawRank(ctx, rank, x + mat + inset, titleY, rankSize, paper, accent)
            + Math.max(6, Math.round(inset * .5));
          titleY += used;
          titleH -= used;
        }
        drawFit(ctx, caption || "—", x + mat + inset, titleY, cellW - mat - inset * 2, Math.max(titleH, rankSize), 24);
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
        if (rank) drawRank(ctx, rank, x + inset, y + inset, rankSize, paper, accent);
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
 * portrait 4:5 cards by default, a taller 9:16 Story canvas, or Square cards
 * carrying at most four pairs each so their type and white space stay measured.
 * Every format draws the same ordered, numbered groups; only the Story canvas
 * lifts content into the viewer's safe area. Answers arrive only in the
 * in-memory snapshot the caller already holds. */
export async function renderExperienceCards(result: ShareExperienceResult, format: "portrait" | "story" | "square" = "portrait"): Promise<Blob[]> {
  // All formats draw the same frozen prompt set the caller’s snapshot holds:
  // a malformed snapshot falls back to the built-in starter, never to a mix.
  const questions = Array.isArray(result.questions) && result.questions.length === twentyOneCount
    ? result.questions
    : twentyOneQuestions;
  const pairs = twentyOnePairs(result.items ?? [], questions);
  if (!pairs.length) throw new Error("No answers to export");
  // Square has less vertical room than 4:5, so it groups four ordered pairs
  // per card; portrait and Story keep their existing six-pair split.
  const cards = splitTwentyOneCards(pairs, format === "square" ? twentyOneSquareCardSize : twentyOneCardSize);
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
