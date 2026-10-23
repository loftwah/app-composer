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
