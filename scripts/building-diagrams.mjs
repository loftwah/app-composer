// Deterministic, editable diagrams for the build story. The coordinates and
// labels live here; the generated SVGs are the shipped light/dark plates.
import { writeFileSync } from "node:fs";
const palettes = {
  dark: {
    background: "#17181b",
    node: "#23252a",
    border: "#4a505a",
    text: "#f2f3f5",
    muted: "#b3b8c2",
    accent: "#ff9b55",
  },
  light: {
    background: "#faf9f7",
    node: "#efeeea",
    border: "#c9c7c1",
    text: "#22252b",
    muted: "#5c616a",
    accent: "#a63d08",
  },
};
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function node(p, x, y, w, h, title, sub, accent = false) {
  const lines = sub.split("\n");
  const start = y + 66 - (lines.length - 1) * 9;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${p.node}" stroke="${
    accent ? p.accent : p.border
  }" stroke-width="${accent ? 2 : 1.2}"/><text x="${x + w / 2}" y="${y + 32}" text-anchor="middle" fill="${
    p.text
  }" font-size="21" font-weight="650">${esc(title)}</text>${lines
    .map(
      (line, index) =>
        `<text x="${x + w / 2}" y="${start + index * 21}" text-anchor="middle" fill="${p.muted}" font-size="15">${esc(
          line,
        )}</text>`,
    )
    .join("")}</g>`;
}
function edge(p, d, label, x, y, dashed = false, anchor = "middle") {
  return `<path d="${d}" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linecap="round"${
    dashed ? ' stroke-dasharray="7 7"' : ""
  } marker-end="url(#arrow)"/>${
    label
      ? `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${p.muted}" font-size="13" paint-order="stroke" stroke="${p.background}" stroke-width="4" stroke-linejoin="round">${esc(label)}</text>`
      : ""
  }`;
}
function svg(p, width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${
    p.accent
  }"/></marker></defs><rect width="${width}" height="${height}" fill="${p.background}" rx="12"/><g font-family="Inter, system-ui, -apple-system, sans-serif">${body}</g></svg>`;
}
const architecture = (p) =>
  svg(
    p,
    1200,
    640,
    [
      node(p, 40, 60, 240, 100, "Visitor", "public pages over HTTPS"),
      node(p, 40, 200, 240, 100, "Invited owner", "Access + EmDash role"),
      node(p, 40, 340, 240, 100, "Authorised agent", "brief · source · checks"),
      node(p, 370, 140, 320, 140, "App Composer", "Astro pages + EmDash admin\nD1 / R2 binding", true),
      node(p, 790, 60, 370, 140, "Here / there", "independent Worker\nsubmit · review · media · D1 / R2"),
      node(p, 790, 250, 370, 140, "Linkarooie", "independent Worker\ncurate · feature · profile · D1"),
      node(p, 370, 390, 320, 110, "Source and release pins", "GitHub repositories\nmanifests + exact commits"),
      node(p, 790, 460, 370, 120, "Live identity", "Worker version + custom hostname\nbehaviour observed, not inferred"),
      edge(p, "M280 110 C325 110 335 185 370 190", "public pages", 300, 165, false, "start"),
      edge(p, "M280 250 C325 250 335 240 370 240", "owner admin", 300, 270, false, "start"),
      edge(p, "M280 390 C325 390 335 435 370 440", "commits", 300, 425, false, "start"),
      edge(p, "M530 390 L530 280", "pinned composition", 538, 345, false, "start"),
      edge(p, "M690 180 C735 180 745 130 790 130", "binding", 700, 118, false, "start"),
      edge(p, "M690 240 C735 240 745 320 790 320", "binding", 700, 305, false, "start"),
      edge(p, "M930 250 L930 200", "invitation + approved", 940, 228, false, "start"),
      edge(p, "M1040 390 L1040 470", "live identity", 1050, 432, false, "start"),
      edge(p, "M790 130 C760 130 750 300 750 470 C750 500 770 520 790 520", "live identity", 690, 355, false, "start"),
    ].join(""),
  );
const workflow = (p) =>
  svg(
    p,
    1200,
    560,
    [
      node(p, 40, 60, 240, 110, "Brief", "outcome + limits", true),
      node(p, 320, 60, 240, 110, "Get Ready", "environment + target"),
      node(p, 600, 60, 240, 110, "Init", "portable spec + handoff"),
      node(p, 880, 60, 240, 110, "Agent implementation", "source change + tests"),
      node(p, 880, 330, 240, 110, "Local run", "Workers · D1 · R2"),
      node(p, 600, 330, 240, 110, "Review", "phone · keyboard · failure"),
      node(p, 320, 330, 240, 110, "Guarded release", "source + Worker identity"),
      node(p, 40, 330, 240, 110, "Live verification", "hostname + behaviour"),
      edge(p, "M280 115 L320 115", "when needed", 300, 180),
      edge(p, "M560 115 L600 115", "verified target", 580, 180),
      edge(p, "M840 115 L880 115", "handoff", 860, 180),
      edge(p, "M1000 170 L1000 330", "run", 1010, 255, false, "start"),
      edge(p, "M880 385 L840 385", "rendered result", 860, 460),
      edge(p, "M600 385 L560 385", "accepted change", 580, 460),
      edge(p, "M320 385 L280 385", "deployed", 300, 460),
      edge(p, "M160 330 L160 260 L20 260 L20 115 L40 115", "next change", 28, 245, false, "start"),
      edge(p, "M720 330 C720 260 1000 260 1000 170", "fix + re-run", 800, 245, true),
    ].join(""),
  );
const contribution = (p) =>
  svg(
    p,
    1200,
    560,
    [
      node(p, 40, 60, 240, 110, "Visitor", "opens the profile"),
      node(p, 320, 60, 240, 110, "Guestbook form", "only while open", true),
      node(p, 600, 60, 240, 110, "Pending", "private item + media"),
      node(p, 880, 60, 240, 110, "Owner review", "approve · reject · hide"),
      node(p, 40, 330, 240, 110, "Profile card", "links to the source"),
      node(p, 320, 330, 240, 110, "Featured", "separate explicit choice"),
      node(p, 600, 330, 240, 110, "Approved in Guestbook", "public source record"),
      node(p, 880, 330, 240, 110, "Hidden", "media + source revoked"),
      edge(p, "M280 115 L320 115", "Leave a note", 300, 195),
      edge(p, "M560 115 L600 115", "submit", 580, 195),
      edge(p, "M840 115 L880 115", "private", 860, 195),
      edge(p, "M1000 170 L1000 330", "hide / revoke", 1010, 255, false, "start"),
      edge(p, "M920 170 C920 250 720 280 720 330", "approve", 790, 250, false, "start"),
      edge(p, "M600 385 L560 385", "approved note", 580, 470),
      edge(p, "M320 385 L280 385", "render", 300, 470),
      edge(p, "M880 440 C600 525 300 525 160 440", "next request removes card + media", 520, 535, true),
    ].join(""),
  );
for (const [name, render] of Object.entries({ architecture, workflow, contribution }))
  for (const [theme, palette] of Object.entries(palettes))
    writeFileSync(
      `public/diagrams/building-${name}-20261022-${theme}.svg`,
      render(palette),
    );
console.log("Rendered building diagrams.");
