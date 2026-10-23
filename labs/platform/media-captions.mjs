// Shared by the maintained excerpt capture and receipt-driven native edits.
export const escapeCaption = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function captionHTML({
  font,
  heading,
  body,
  provenance = [],
  height = 156,
}) {
  const native = provenance.length > 0;
  return `<style>@font-face{font-family:Space;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;width:1600px;height:${height}px;background:#141a17;color:#f5f1e9;font:${native ? "26px/1.3" : "28px/1.35"} Space,system-ui;padding:${native ? "18px" : "22px"} 38px;border-left:9px solid #fc5b05}.heading{color:#ff9761;font-size:${native ? "18px" : "19px"};letter-spacing:${native ? ".05em" : ".07em"};margin:0 0 ${native ? "8px" : "10px"}}.body{margin:0;max-width:1500px}.provenance{font:12px/17px Space,system-ui;margin:10px 0 0;overflow-wrap:anywhere}.provenance span{display:block}</style><p class="heading">${escapeCaption(heading)}</p><p class="body">${escapeCaption(body)}</p>${provenance.length ? `<p class="provenance">${provenance.map((line) => `<span>${escapeCaption(line)}</span>`).join("")}</p>` : ""}`;
}

export function captionStamp(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

export const readableCaptionFormat = Object.freeze({
  maximumLines: 2,
  maximumCharactersPerLine: 32,
  gapMilliseconds: 40,
  minimumCueSeconds: 2,
  maximumCharactersPerSecond: 20,
  settings: "line:10% position:50% size:90% align:center",
});

// Balance word boundaries rather than leaving a final one-word flash cue.
function captionLines(text) {
  const words = text.split(" ");
  const limit = readableCaptionFormat.maximumCharactersPerLine;
  if (words.some((word) => word.length > limit))
    throw Error("A caption word exceeds the readable line limit.");
  const best = Array(words.length + 1);
  best[words.length] = { cost: 0, lines: [] };
  for (let i = words.length - 1; i >= 0; i--) {
    let line = "";
    for (let j = i; j < words.length; j++) {
      line += (line ? " " : "") + words[j];
      if (line.length > limit) break;
      const cost = (limit - line.length) ** 2 + best[j + 1].cost;
      if (!best[i] || cost < best[i].cost)
        best[i] = { cost, lines: [line, ...best[j + 1].lines] };
    }
  }
  return best[0].lines;
}

export function readableCaptionCues(segments) {
  if (!Array.isArray(segments) || !segments.length || segments.length > 512)
    throw Error("Use bounded source segments for readable captions.");
  const spans = [];
  for (const segment of segments) {
    const start = Math.round(segment.start * 1000);
    const end = Math.round(segment.end * 1000);
    const text = segment.cc ?? segment.body;
    if (
      !Number.isFinite(segment.start) ||
      !Number.isFinite(segment.end) ||
      start < 0 ||
      end <= start ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 4000 ||
      /[\u0000-\u001f\u007f]|-->/.test(text)
    )
      throw Error("Use finite ordered timings and plain source caption text.");
    const body = text.trim().replace(/\s+/g, " ");
    const previous = spans.at(-1);
    if (previous && start < previous.end)
      throw Error("Source caption segments overlap.");
    if (previous?.end === start && previous.body === body) previous.end = end;
    else spans.push({ start, end, body });
  }
  const cues = [];
  for (const span of spans) {
    const lines = captionLines(span.body);
    const groups = [];
    for (let i = 0; i < lines.length; i += 2)
      groups.push(lines.slice(i, i + 2));
    const total = groups.reduce(
      (sum, lines) => sum + lines.join(" ").length,
      0,
    );
    let weight = 0;
    for (const lines of groups) {
      const start =
        span.start + Math.round(((span.end - span.start) * weight) / total);
      weight += lines.join(" ").length;
      const end =
        span.start +
        Math.round(((span.end - span.start) * weight) / total) -
        readableCaptionFormat.gapMilliseconds;
      if (
        end - start < readableCaptionFormat.minimumCueSeconds * 1000 ||
        lines.join(" ").length / ((end - start) / 1000) >
          readableCaptionFormat.maximumCharactersPerSecond
      )
        throw Error(
          "Source span needs a concise maintained caption for readable timing.",
        );
      cues.push({
        start: start / 1000,
        end: end / 1000,
        text: lines.join("\n"),
      });
    }
  }
  return cues;
}

export function readableCaptionVTT(film) {
  const provenance = film.segments?.[0]?.provenance;
  if (
    !Array.isArray(provenance) ||
    !provenance.length ||
    provenance.some(
      (line) => typeof line !== "string" || /[\r\n]|-->/.test(line),
    )
  )
    throw Error("Keep recording provenance in the non-displayed VTT note.");
  const cues = readableCaptionCues(film.segments);
  const escapeVTT = (text) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return (
    "WEBVTT\n\nNOTE Recording provenance; full cuts and holds are in edit-manifest.json\n" +
    provenance.join("\n") +
    "\n\nNOTE Readable optional captions: concise maintained text, at most two short lines.\n" +
    "Consecutive identical bodies share their source span; 40ms gaps separate cues.\n" +
    "Full chapter headings and explanations remain in the transcript and film.\n\n" +
    cues
      .map(
        (cue, index) =>
          `${index + 1}\n${captionStamp(cue.start)} --> ${captionStamp(cue.end)} ${readableCaptionFormat.settings}\n${escapeVTT(cue.text)}\n`,
      )
      .join("\n")
  );
}
