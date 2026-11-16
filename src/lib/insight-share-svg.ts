// Server-rendered 1200×630 card for the shareable insight. It reuses the
// approved Composer orange/paper art direction, the owned brand tile, the
// independent app's own optical mark and the exact numbers and window.
import { wrapCardText } from "./stack-share-svg.ts";
import { appMarks } from "./app-marks.ts";
import {
  INSIGHT_CARD,
  INSIGHT_ORIGIN,
  INSIGHT_PATH,
  type RecordedOpensInsight,
} from "./activity-insight.ts";

type Measure = (text: string, size: number, weight: number) => number;
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
const lines = (
  value: string[],
  x: number,
  y: number,
  size: number,
  leading: number,
  fill: string,
  weight = 400,
) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}">${value
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index ? leading : 0}">${escapeXml(line)}</tspan>`,
    )
    .join("")}</text>`;

const palette = {
  orange: "#fc5b05",
  ink: "#17181b",
  paper: "#faf9f7",
  muted: "#5c616a",
  white: "#fff",
};

function brand(image: string, x: number, y: number, tile: number) {
  const pad = Math.round(tile * 0.12);
  return `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="${Math.round(tile * 0.22)}" fill="${palette.paper}"/><image x="${x + pad}" y="${y + pad}" width="${tile - pad * 2}" height="${tile - pad * 2}" href="${escapeXml(image)}"/>`;
}

function appMark(app: string | null, x: number, y: number, size: number) {
  const mark = app ? appMarks[app] : undefined;
  if (!mark) return "";
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">${mark}</svg>`;
}

function ranking(insight: RecordedOpensInsight) {
  const x = 738;
  const width = 398;
  const top = 158;
  const row = 56;
  const maximum = Math.max(1, ...insight.entries.map((entry) => entry.opens));
  const marks: string[] = [];
  for (const [index, entry] of insight.entries.entries()) {
    const y = top + index * row;
    const barWidth = Math.max(2, (width - 48) * (entry.opens / maximum));
    if (index === 0)
      marks.push(
        `<rect x="${x - 14}" y="${y - 34}" width="${width + 14}" height="${row - 4}" rx="6" fill="${palette.paper}" opacity="0.16"/>`,
      );
    marks.push(
      `<text x="${x}" y="${y}" fill="${palette.ink}" font-size="14" font-weight="600">${String(index + 1).padStart(2, "0")}</text>`,
      `<text x="${x + 34}" y="${y}" fill="${palette.white}" font-size="19" font-weight="600">${escapeXml(entry.label)}</text>`,
      `<text x="${x + width}" y="${y}" text-anchor="end" fill="${palette.white}" font-size="20" font-weight="600">${escapeXml(`${entry.opens.toLocaleString("en-AU")}${entry.limited ? "+" : ""}`)}</text>`,
      `<rect x="${x + 34}" y="${y + 9}" width="${barWidth}" height="3" rx="1.5" fill="${palette.ink}" opacity="${index === 0 ? 0.55 : 0.3}"/>`,
      `<text x="${x + width}" y="${y + 28}" text-anchor="end" fill="${palette.ink}" font-size="12" font-weight="500">${escapeXml(`${entry.shareLabel} of window`)}</text>`,
    );
  }
  return marks.join("");
}

export function insightShareSvg(
  insight: RecordedOpensInsight,
  measure: Measure,
  brandImage: string,
) {
  const { width, height } = INSIGHT_CARD;
  const lead = wrapCardText(insight.cardLead, 52, 600, 640, 2, measure);
  const windowLabel = insight.windowLabel;
  const source = INSIGHT_ORIGIN.replace("https://", "") + INSIGHT_PATH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${palette.orange}"/>
${brand(brandImage, 64, 44, 60)}
${lines(["App Composer", "Public analytics"], 138, 66, 20, 24, palette.ink, 600)}
${insight.leaders.length === 1 ? appMark(insight.leader.app, 1052, 24, 92) : ""}
<text x="${insight.leaders.length === 1 ? 1020 : 1136}" y="76" text-anchor="end" fill="${palette.ink}" font-size="14" font-weight="600">${escapeXml(`${insight.window.days} COMPLETE UTC DAYS · ${insight.surfaceLabel.toUpperCase()}`)}</text>
<text x="64" y="176" fill="${palette.ink}" font-size="16" font-weight="600">${escapeXml(insight.title.toUpperCase())}</text>
${lines(lead, 64, 238, 52, 58, palette.white, 600)}
<text x="64" y="432" fill="${palette.white}" font-size="132" font-weight="600">${escapeXml(insight.valueLabel)}</text>
${lines([insight.unit], 64, 468, 20, 0, palette.ink, 500)}
${ranking(insight)}
<rect x="0" y="500" width="${width}" height="${height - 500}" fill="${palette.paper}"/>
${lines([`${windowLabel} · ${insight.window.days} complete UTC ${insight.window.days === 1 ? "day" : "days"}`], 64, 538, 19, 0, palette.ink, 600)}
${lines([`${insight.entries.length} public apps · ${insight.surfaceLabel} · Successful public home-page requests; reloads and bots can count`], 64, 568, 15, 0, palette.muted)}
${lines([source], 64, 598, 15, 0, palette.ink, 600)}
<text x="1136" y="598" text-anchor="end" fill="${palette.muted}" font-size="13">Bounded requests · not people or conversions</text>
</svg>`;
}
