import { initWasm } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm?module";
import fontBuffer from "../assets/fonts/SpaceGrotesk.ttf.bin";
import { dateLabel } from "./activity-view";
import { insightTextMeasure, renderInsightCard } from "./insight-card-render";
import type { PortfolioProject } from "./portfolio-projects";
import { formatPortfolioValue, type Period, type PortfolioMetric } from "./portfolio-report";
import { shareImageReady } from "./share-image-ready";
import { portfolioCardFormats, type PortfolioCardFormat } from "./portfolio-card-formats";

const font = new Uint8Array(fontBuffer);
const qualityLabel = { exact: "Recorded", partial: "Partial coverage", bounded: "Bounded count", sampled: "Sampled", unavailable: "Unavailable" };
const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const covers = import.meta.glob<ArrayBuffer>("../assets/portfolio/*.jpg.bin", { eager: true, import: "default" });

function coverImage(project: PortfolioProject) {
  const cover = covers[`../assets/portfolio/${project.art}.jpg.bin`];
  if (!cover) return "";
  const bytes = new Uint8Array(cover);
  let body = "";
  for (let i = 0; i < bytes.length; i += 8192) body += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/jpeg;base64,${btoa(body)}`;
}

export async function portfolioCard(project: PortfolioProject, metric: PortfolioMetric, period: Period, format: PortfolioCardFormat) {
  if (metric.value === null) throw new Error("Measure unavailable");
  await shareImageReady(() => initWasm(wasm));
  const cover = coverImage(project);
  const value = formatPortfolioValue(metric.value, metric.unit) + (metric.days.some((day) => day.capped) ? "+" : "");
  const measure = insightTextMeasure(font);
  const fit = (label: string, size: number, width: number, weight = 700) => {
    const actual = measure(label, size, weight);
    return Math.round(size * Math.min(1, width / (actual || 1)));
  };
  const palette = {
    amber: "#f3ac5e", red: "#f7a18f", blue: "#a9d5ee", green: "#bcd995", violet: "#c4b3ff", pink: "#f0b4db",
  };
  const ink = "#16151c";
  const tone = palette[project.tone];
  const { width, height } = portfolioCardFormats[format];
  const isWide = format === "landscape";
  const textWidth = isWide ? 480 : 950;
  const panelHeight = isWide ? height : format === "square" ? 370 : 522;
  const panelWidth = isWide ? 588 : width;
  const artHeight = isWide ? 336 : format === "square" ? 400 : 925;
  const artX = isWide ? panelWidth : 0;
  const artY = isWide ? 0 : panelHeight;
  const chartTop = isWide ? 388 : artY + artHeight + (format === "square" ? 70 : 120);
  const chartX = isWide ? 646 : 64;
  const chartWidth = width - chartX - 72;
  const baseline = height - (format === "portrait" ? 144 : 81);
  const peak = Math.max(1, ...metric.days.map((day) => day.value ?? 0));
  const step = chartWidth / period.days;
  const bars = metric.days.map((day, i) => {
    const x = chartX + i * step;
    const barWidth = Math.max(3, step - 5);
    if (day.value === null) return `<path d="M${x + 2} ${baseline}l5 -8" stroke="#bab2ce" stroke-width="2"/>`;
    if (day.value === 0) return `<circle cx="${x + barWidth / 2}" cy="${baseline - 1}" r="2" fill="${tone}"/>`;
    const barHeight = Math.max(1, day.value / peak * (baseline - chartTop - 24));
    return `<rect x="${x}" y="${baseline - barHeight}" width="${barWidth}" height="${barHeight}" rx="2" fill="${tone}"/>`;
  }).join("");
  const nameY = isWide ? 156 : 145;
  const valueY = isWide ? 329 : format === "square" ? 255 : 300;
  const labelY = isWide ? 392 : valueY + 48;
  const dateY = isWide ? 531 : panelHeight - 28;
  const date = `${dateLabel(period.from)} – ${dateLabel(period.to, true)} UTC`;
  const coverage = qualityLabel[metric.quality];
  const art = cover
    ? `<image x="${artX}" y="${artY}" width="${width - artX}" height="${artHeight}" preserveAspectRatio="xMidYMid slice" xlink:href="${cover}"/>`
    : `<text x="${artX + 52}" y="${artY + artHeight / 2}" font-size="${fit(project.name, 68, width - artX - 100)}" font-weight="700" fill="${tone}">${escapeXml(project.name)}</text>`;
  return renderInsightCard(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${ink}"/>
    <rect width="${panelWidth}" height="${panelHeight}" fill="${tone}"/>
    <g font-family="Space Grotesk" fill="${ink}">
      <text x="52" y="66" font-size="22" font-weight="600">App Composer / Portfolio analytics</text>
      <text x="52" y="${nameY}" font-size="${fit(project.name, 58, textWidth)}" font-weight="700">${escapeXml(project.name)}</text>
      <text x="52" y="${valueY}" font-size="${fit(value, format === "square" ? 100 : 126, textWidth)}" font-weight="700">${escapeXml(value)}</text>
      <text x="52" y="${labelY}" font-size="${fit(metric.label, 39, textWidth)}" font-weight="700">${escapeXml(metric.label)}</text>
      <text x="52" y="${dateY}" font-size="24">${escapeXml(isWide ? date : date + " · " + coverage)}</text>
      ${isWide ? `<text x="52" y="572" font-size="21">${coverage}</text>` : ""}
    </g>
    <g font-family="Space Grotesk" fill="#faf7ff">
      ${art}
      <text x="${chartX}" y="${chartTop}" font-size="${format === "portrait" ? 42 : 26}" font-weight="700">Daily values</text>
      <path d="M${chartX} ${baseline}h${chartWidth}" stroke="#a099b3"/>
      ${bars}
      <text x="${chartX}" y="${baseline + 36}" font-size="22">${escapeXml(dateLabel(period.from))}</text>
      <text x="${chartX + chartWidth}" y="${baseline + 36}" text-anchor="end" font-size="22">${escapeXml(dateLabel(period.to))}</text>
    </g>
  </svg>`, font);
}
