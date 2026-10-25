// Isolated local component/API harness. Exercises the actual React page and
// read handler with synthetic plugin-state rows. It is not an EmDash/Access
// authentication or production acceptance receipt.
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { managePluginTrust } from "../../../src/lib/plugin-trust.ts";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(
  process.argv[2] ?? join(repo, "output/plugin-trust-20261025"),
);
const root = mkdtempSync(join(tmpdir(), "composer-plugin-trust-"));
let browser, server;
const cleanup = () => {
  rmSync(root, { recursive: true, force: true });
};
process.once("exit", cleanup);
try {
  mkdirSync(out, { recursive: true });
  if (!process.env.PLAYWRIGHT_MODULE)
    throw Error(
      "Set PLAYWRIGHT_MODULE to an existing installed Playwright module; this harness installs nothing.",
    );
  const { chromium } = await import(
    pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  );
  const esbuildName = readdirSync(join(repo, "node_modules/.pnpm")).find(
    (name) => name.startsWith("esbuild@"),
  );
  if (!esbuildName)
    throw Error("Use the existing repository esbuild dependency.");
  const { build } = await import(
    pathToFileURL(
      join(
        repo,
        "node_modules/.pnpm",
        esbuildName,
        "node_modules/esbuild/lib/main.js",
      ),
    ).href
  );
  await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {PluginTrustPage} from './src/plugins/plugin-trust-page.tsx';createRoot(document.getElementById('root')).render(React.createElement(PluginTrustPage));`,
      resolveDir: repo,
      loader: "tsx",
    },
    outfile: join(root, "page.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": "'production'" },
  });
  let fail = false;
  const runtime = {
    PUBLIC_ORIGIN: "https://composer.loftwah.com",
    RESOURCE_ENVIRONMENT: "production",
    DB: {
      prepare() {
        return {
          all: async () => ({
            success: true,
            results: [
              {
                plugin_id: "fictional-native-plugin",
                version: "1.0.0",
                status: "active",
                source: "config",
                registry_publisher_did: null,
                registry_slug: null,
              },
            ],
          }),
        };
      },
    },
  };
  server = createServer(async (req, res) => {
    if (req.url.startsWith("/_emdash/api/")) {
      if (fail) {
        res
          .writeHead(503, { "Content-Type": "application/json" })
          .end(
            JSON.stringify({
              success: false,
              error: { message: "Synthetic failure" },
            }),
          );
        return;
      }
      const data = await managePluginTrust(
        {
          user: { id: "synthetic-admin", role: 50 },
          input: {},
          request: new Request(
            "https://composer.loftwah.com/_emdash/api/plugins/composer-stacks/pluginTrustRead",
          ),
        },
        runtime,
      );
      res
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        })
        .end(JSON.stringify({ success: true, data }));
      return;
    }
    if (req.url === "/page.js" || req.url === "/page.css") {
      res
        .writeHead(200, {
          "Content-Type": req.url.endsWith("css")
            ? "text/css"
            : "text/javascript",
        })
        .end(readFileSync(join(root, req.url.slice(1))));
      return;
    }
    const dark = req.url.includes("dark");
    res
      .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(
        `<!doctype html><html lang="en" style="color-scheme:${dark ? "dark" : "light"};--text-color-kumo-default:${dark ? "#f1f1f1" : "#242424"};--text-color-kumo-subtle:${dark ? "#b7b7b7" : "#666"};--color-kumo-base:${dark ? "#17181b" : "#fff"}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plugin Trust Centre — isolated component harness</title><link rel="stylesheet" href="/page.css"><body style="margin:0;background:var(--color-kumo-base)"><p style="font:14px system-ui;margin:12px 28px">FICTIONAL LOCAL COMPONENT / API HARNESS · no EmDash or Access authentication</p><main id="root"></main><script type="module" src="/page.js"></script></body></html>`,
      );
  });
  await new Promise((yes) => server.listen(0, "127.0.0.1", yes));
  const origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const page = await browser.newPage();
  const receipt = {
    schema: "composer.plugin-trust-component/1",
    observedAt: new Date().toISOString(),
    warning:
      "Actual React page and read handler, synthetic inventory. No native EmDash/Cloudflare Access authentication, installation, provider, production, physical-device or assistive-technology acceptance.",
    captures: [],
    checks: [],
  };
  for (const width of [390, 1440])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + "/?theme=" + theme);
      await page
        .getByRole("heading", { name: "This site's installed inventory" })
        .waitFor();
      await page
        .getByText("fictional-native-plugin", { exact: true })
        .waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (overflow) throw Error("Horizontal overflow");
      const summary = page.locator("summary").first();
      await summary.focus();
      await page.keyboard.press("Enter");
      await page.getByText("EGRESS_UNRESTRICTED", { exact: true }).waitFor();
      if (
        await summary.evaluate(
          (e) => getComputedStyle(e).outlineStyle === "none",
        )
      )
        throw Error("Missing visible focus");
      const file = `component-${width}-${theme}.png`;
      await page.screenshot({ path: join(out, file), fullPage: true });
      receipt.captures.push(file);
      receipt.checks.push({
        width,
        theme,
        overflow,
        keyboardDetails: true,
        focus: true,
      });
    }
  fail = true;
  await page.reload();
  await page.getByRole("alert").waitFor();
  await page.screenshot({ path: join(out, "component-api-error.png") });
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await page
    .getByRole("heading", { name: "This site's installed inventory" })
    .waitFor();
  receipt.checks.push({ apiFailureAndRetry: true });
  writeFileSync(
    join(out, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser?.close();
  await new Promise((yes) => (server ? server.close(yes) : yes()));
  cleanup();
}
