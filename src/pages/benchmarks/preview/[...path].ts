import type { APIRoute } from "astro";
import { previewTrial } from "../../../lib/benchmark-runs.ts";

export const prerender = false;

// The blind comparison must not leak a configuration through a preview URL. The
// page links to /benchmarks/preview/<run>/<pair>/<side>/index.html, and this
// route resolves that opaque address to the committed trial files on the
// server. Nothing in the request, response or headers names the configuration.
//
// The files live under public/benchmarks/trials for direct inspection after a
// result is revealed. Vite bundles them here as raw strings so the route works
// on Cloudflare Workers without a filesystem or a self-fetch.
const published = import.meta.glob(
  "../../../../public/benchmarks/trials/**/*.{html,css}",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const assets = new Map(
  Object.entries(published).map(([key, body]) => [
    key.replace(/^.*\/public\//, "/"),
    body,
  ]),
);

/**
 * The produced page is mounted in a shadow root. Its stylesheet was written for
 * a document, so `:root`, `html` and `body` never match inside that shadow tree
 * and the page renders as light text on the card's white background. Rewrite
 * only those structural selectors, and keep every other declaration untouched.
 */
function previewCss(css: string): string {
  return String(css)
    .replace(/:root\b/g, ":host")
    .replace(/\bhtml\b/g, ":host")
    .replace(/\bbody\b/g, ".preview-body")
    .replace(/100vh/g, "100%");
}

function sanitise(html: string): string {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, (tag) =>
      /rel\s*=\s*["']stylesheet["']/i.test(tag) ? tag : "",
    )
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "");
}

export const GET: APIRoute = async ({ params }) => {
  const segments = String(params.path ?? "")
    .split("/")
    .filter(Boolean);
  if (segments.length !== 4) return new Response("Not found", { status: 404 });
  const [runId, pairId, side, asset] = segments;
  if (side !== "a" && side !== "b") return new Response("Not found", { status: 404 });
  if (asset !== "index.html" && asset !== "app.css")
    return new Response("Not found", { status: 404 });
  const resolved = previewTrial(runId, pairId, side);
  if (!resolved) return new Response("Not found", { status: 404 });
  const pathname = new URL(resolved.assetBase, "https://example.invalid").pathname;
  const directory = pathname.slice(0, pathname.lastIndexOf("/"));
  const body = assets.get(`${directory}/${asset}`);
  if (typeof body !== "string") return new Response("Not found", { status: 404 });
  const html = asset === "index.html";
  return new Response(html ? sanitise(body) : previewCss(body), {
    headers: {
      "Content-Type": html ? "text/html; charset=utf-8" : "text/css; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      ...(html
        ? {
            "Content-Security-Policy":
              "default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'",
          }
        : {}),
    },
  });
};
