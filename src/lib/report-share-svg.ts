import { wrapCardText } from "./stack-share-svg.ts";
import { appMarks } from "./app-marks.ts";
import {
  reportFormats,
  reportValueLabel,
  reportStoryLabel,
  reportEvidenceLabel,
  reportSurfaceLabel,
  type FrozenReport,
  type ReportFormat,
} from "./public-report.ts";

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
  rule: "#d7d2c8",
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

function chart(
  report: FrozenReport,
  x: number,
  y: number,
  width: number,
  height: number,
  compact = false,
) {
  const values = report.daily.map((day) => day.value);
  const maximum = Math.max(1, ...values.map((value) => value ?? 0));
  const step = width / Math.max(1, report.daily.length);
  const baseline = y + height - 2;
  const barWidth = Math.max(compact ? 2 : 4, step * 0.56);
  const marks: string[] = [];
  for (const [index, day] of report.daily.entries()) {
    const cx = x + step * (index + 0.5);
    if (day.value === null) {
      marks.push(
        `<path d="M${cx - 3} ${baseline - 8}l6 -8" stroke="${palette.muted}" stroke-width="2" stroke-linecap="round"/>`,
      );
    } else if (day.value === 0) {
      marks.push(
        `<circle cx="${cx}" cy="${baseline}" r="2.5" fill="${palette.muted}"/>`,
      );
    } else {
      const barHeight = Math.max(2, (day.value / maximum) * (height - 18));
      marks.push(
        `<rect x="${cx - barWidth / 2}" y="${baseline - barHeight}" width="${barWidth}" height="${barHeight}" rx="2" fill="${palette.orange}"/>`,
      );
    }
  }
  const first = report.daily[0]?.date ?? "";
  const last = report.daily.at(-1)?.date ?? "";
  return `<g>${marks.join("")}<line x1="${x}" y1="${baseline + 1}" x2="${x + width}" y2="${baseline + 1}" stroke="${palette.rule}" stroke-width="1"/><text x="${x}" y="${y + height + 18}" fill="${palette.muted}" font-size="${compact ? 14 : 16}">${escapeXml(first)}</text><text x="${x + width}" y="${y + height + 18}" text-anchor="end" fill="${palette.muted}" font-size="${compact ? 14 : 16}">${escapeXml(last)}</text></g>`;
}

function landscape(report: FrozenReport, measure: Measure, image: string) {
  const { width, height } = reportFormats.landscape;
  const headline = wrapCardText(report.headline, 58, 600, 810, 3, measure);
  const amount = reportValueLabel(report);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${palette.orange}"/>
${brand(image, 64, 52, 64)}
${lines(["App Composer", "Analytics report"], 148, 78, 22, 24, palette.ink, 600)}
${appMark(report.app, 1000, 40, 130)}
${lines(headline, 64, 214, 58, 66, palette.white, 600)}
${lines([`${reportEvidenceLabel(report)} · ${report.period.days} UTC DAYS`], 64, 374, 16, 0, palette.ink, 600)}
<rect x="0" y="404" width="${width}" height="${height - 404}" fill="${palette.paper}"/>
<text x="64" y="520" fill="${palette.ink}" font-size="116" font-weight="600">${escapeXml(amount)}</text>
${lines([report.unit], 64, 558, 24, 0, palette.ink, 500)}
${lines([`${report.period.from} – ${report.period.to} UTC · ${reportSurfaceLabel(report)}`], 64, 600, 17, 0, palette.muted, 400)}
${chart(report, 590, 454, 546, 88, true)}
<text x="590" y="588" fill="${palette.muted}" font-size="14">${escapeXml(reportStoryLabel(report))}</text>
<text x="590" y="615" fill="${palette.muted}" font-size="13">Recorded lower bound · not unique people</text>
</svg>`;
}

function square(report: FrozenReport, measure: Measure, image: string) {
  const { width, height } = reportFormats.square;
  const headline = wrapCardText(report.headline, 66, 600, 880, 4, measure);
  const amount = reportValueLabel(report);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${palette.orange}"/>
${brand(image, 64, 60, 72)}
${lines(["App Composer", "Analytics report"], 156, 90, 24, 26, palette.ink, 600)}
${appMark(report.app, 856, 52, 150)}
${lines(headline, 64, 270, 66, 76, palette.white, 600)}
${lines([`${reportEvidenceLabel(report)} · ${report.period.days} UTC DAYS`], 64, 602, 20, 0, palette.ink, 600)}
<rect x="0" y="650" width="${width}" height="${height - 650}" fill="${palette.paper}"/>
<text x="64" y="800" fill="${palette.ink}" font-size="160" font-weight="600">${escapeXml(amount)}</text>
${lines([report.unit], 64, 848, 28, 0, palette.ink, 500)}
${lines([`${report.period.from} – ${report.period.to} UTC`], 64, 898, 20, 0, palette.muted, 400)}
${chart(report, 64, 940, 952, 58, true)}
<text x="64" y="1042" fill="${palette.muted}" font-size="15">${escapeXml(reportStoryLabel(report))} · lower bound, not people</text>
</svg>`;
}

function portrait(report: FrozenReport, measure: Measure, image: string) {
  const { width, height } = reportFormats.portrait;
  const headline = wrapCardText(report.headline, 82, 600, 880, 5, measure);
  const amount = reportValueLabel(report);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${palette.orange}"/>
${brand(image, 72, 80, 84)}
${lines(["App Composer", "Analytics report"], 180, 116, 27, 30, palette.ink, 600)}
${appMark(report.app, 820, 64, 180)}
${lines(headline, 72, 340, 82, 94, palette.white, 600)}
${lines([`${reportEvidenceLabel(report)} · ${report.period.days} UTC DAYS`], 72, 670, 22, 0, palette.ink, 600)}
${lines(wrapCardText("A frozen public record from App Composer. No visitor identity or private record is included.", 30, 400, 860, 2, measure), 72, 726, 30, 40, palette.ink)}
<rect x="0" y="900" width="${width}" height="${height - 900}" fill="${palette.paper}"/>
<text x="72" y="1160" fill="${palette.ink}" font-size="210" font-weight="600">${escapeXml(amount)}</text>
${lines([report.unit], 72, 1220, 34, 0, palette.ink, 500)}
${lines([`${report.period.from} – ${report.period.to} UTC`], 72, 1280, 24, 0, palette.muted, 400)}
${chart(report, 72, 1360, 936, 180)}
${lines(wrapCardText(reportStoryLabel(report) + ". " + report.detail, 24, 400, 900, 4, measure), 72, 1660, 24, 32, palette.muted)}
<text x="72" y="1850" fill="${palette.ink}" font-size="20" font-weight="600">composer.loftwah.com</text>
</svg>`;
}

export function reportShareSvg(
  report: FrozenReport,
  format: ReportFormat,
  measure: Measure,
  brandImage: string,
) {
  return format === "landscape"
    ? landscape(report, measure, brandImage)
    : format === "square"
      ? square(report, measure, brandImage)
      : portrait(report, measure, brandImage);
}
