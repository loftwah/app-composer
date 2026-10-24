// Deterministic local capture for the Inbox journey fixture. Starts an isolated
// headless Chrome and an ephemeral local HTTP server, renders the committed
// fixture pages at 390 and 1440, measures overflow/focus and writes full-page
// PNGs plus receipt.json. No shared browser profile, production page or provider
// is used.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const htmlDirectory = process.argv[2];
const outputDirectory = process.argv[3] ?? here;
const chrome =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!htmlDirectory) throw Error("Pass the rendered HTML directory.");
if (!existsSync(chrome)) throw Error("Set CHROME_PATH to a Chrome binary.");
mkdirSync(outputDirectory, { recursive: true });

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
};
const server = createServer((request, response) => {
  const path = decodeURIComponent(
    new URL(request.url, "http://local").pathname,
  );
  const file = normalize(
    join(htmlDirectory, path === "/" ? "index.html" : path),
  );
  if (!file.startsWith(normalize(htmlDirectory)) || !existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const profile = join(htmlDirectory, "chrome-profile");
rmSync(profile, { recursive: true, force: true });
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const cleanup = () => {
  browser.kill("SIGKILL");
  server.close();
  rmSync(profile, { recursive: true, force: true });
};
process.on("exit", cleanup);

const active = join(profile, "DevToolsActivePort");
for (let attempt = 0; attempt < 200 && !existsSync(active); attempt++)
  await new Promise((resolve) => setTimeout(resolve, 50));
if (!existsSync(active))
  throw Error("Chrome did not expose its DevTools port.");
const [port] = readFileSync(active, "utf8").split("\n");
const target = await (
  await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", {
    method: "PUT",
  })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const waiting = new Map();
const loaded = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    message.error
      ? reject(Error(message.error.message))
      : resolve(message.result);
  }
  if (message.method === "Page.loadEventFired" && loaded.length)
    loaded.shift()();
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const waitForLoad = () =>
  new Promise((resolve, reject) => {
    loaded.push(resolve);
    setTimeout(() => reject(Error("Page load timed out.")), 15000);
  });
await send("Page.enable");
await send("Runtime.enable");

const matrix = [];
for (const file of readdirSync(htmlDirectory)
  .filter((name) => name.endsWith(".html"))
  .sort())
  for (const width of [390, 1440])
    for (const theme of ["dark", "light"]) matrix.push({ file, width, theme });

const receipt = {
  schema: "composer.inbox-journey-acceptance/1",
  observedAt: new Date().toISOString(),
  source: process.env.SOURCE_REVISION ?? "working tree",
  note: "Local fictional D1 fixture rendered through the actual JourneyDetail component and read model. No EmDash API transport, authentication session, provider delivery or production data is exercised.",
  fixtures: {
    database: "in-memory SQLite from migrations 0013 and 0017",
    briefs:
      "Fictional Trail Notes publication 11, fictional visitor book, no real person or club.",
  },
  captures: [],
};
const version = await send("Browser.getVersion");
receipt.browser = version.product + " (" + version.userAgent + ")";

for (const item of matrix) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: item.width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const load = waitForLoad();
  await send("Page.navigate", {
    url: base + "/" + item.file + "?theme=" + item.theme,
  });
  await load;
  await send("Runtime.evaluate", {
    expression: "document.fonts.ready",
    awaitPromise: true,
  });
  // Exercise a real keyboard Tab path, then focus the primary next action so this
  // capture shows its keyboard focus ring.
  await send("Runtime.evaluate", {
    expression: "document.body.tabIndex=-1;document.body.focus();",
  });
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  const measured = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const first = document.activeElement;
      const firstTarget = first ? first.tagName.toLowerCase() + ": " + (first.textContent || "").trim().slice(0, 40) : "none";
      const active = document.querySelector(".ce-next button") || document.querySelector(".ce-quiet") || document.querySelector(".ce-row");
      if (active) active.focus();
      const s = active ? getComputedStyle(active) : null;
      const outline = s ? s.outlineWidth + " " + s.outlineStyle + " " + s.outlineColor : "none";
      const tag = active ? active.tagName.toLowerCase() : "none";
      const text = active ? (active.textContent || "").trim().slice(0, 40) : "";
      const focusVisible = active ? active.matches(":focus-visible") : false;
      const focusable = [...document.querySelectorAll('button,select,a[href]')];
      const check = document.getElementById("rendered-check");
      const result = {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
        focusables: focusable.length,
        negativeTabIndex: focusable.filter((el) => el.tabIndex < 0).length,
        firstKeyboardTarget: firstTarget,
        keyboardTarget: tag + (text ? ": " + text : ""),
        keyboardFocusVisible: focusVisible,
        keyboardOutline: outline,
        renderedCheck: check ? check.textContent : "missing",
        chips: [...document.querySelectorAll(".ce-chip")].map((el) => el.textContent.trim()),
        flow: [...document.querySelectorAll(".ce-flow li")].map((el) => el.dataset.state),
        next: document.querySelector(".ce-next h3")?.textContent ?? null,
        h1: document.querySelector("h1")?.textContent ?? null,
        text: document.body.innerText,
      };
      return result;
    })()`,
  });
  const value = measured.result.value;
  const png = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: item.width,
      height: value.scrollHeight,
      scale: 1,
    },
  });
  const stem = item.file.replace(/\.html$/, "");
  const name = stem + "-" + item.width + "-" + item.theme + ".png";
  writeFileSync(join(outputDirectory, name), Buffer.from(png.data, "base64"));
  receipt.captures.push({
    file: name,
    page: item.file,
    viewport: item.width,
    theme: item.theme,
    scrollWidth: value.scrollWidth,
    scrollHeight: value.scrollHeight,
    overflow: value.overflow,
    focusables: value.focusables,
    negativeTabIndex: value.negativeTabIndex,
    firstKeyboardTarget: value.firstKeyboardTarget,
    keyboardTarget: value.keyboardTarget,
    keyboardFocusVisible: value.keyboardFocusVisible,
    keyboardOutline: value.keyboardOutline,
    heading: value.h1,
    flow: value.flow,
    next: value.next,
    chips: value.chips,
    containsEvidenceBanner: value.text.includes(
      "Local rendered acceptance · fictional fixture",
    ),
    containsRecipientAddress: /owner@example\.test|fictional-key/.test(
      value.text,
    ),
  });
  console.log(
    name +
      ": " +
      value.width +
      "px, scrollWidth " +
      value.scrollWidth +
      (value.overflow ? " OVERFLOW" : " no-overflow") +
      ", focus " +
      value.keyboardTarget +
      " (" +
      value.keyboardOutline +
      ")",
  );
}

writeFileSync(
  join(outputDirectory, "receipt.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
socket.close();
cleanup();
console.log("Wrote " + matrix.length + " captures and receipt.json");
