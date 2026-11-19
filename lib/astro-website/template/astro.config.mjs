import { defineConfig } from "astro/config";

// Static baseline: plain HTML, CSS and Markdown. No adapter, CMS, database or
// remote service is required. The output in `dist/` can be served by Workers
// Static Assets or any static host. Set `site` here when a real hostname is
// known to emit canonical URLs; without it, no canonical link is generated.
export default defineConfig({
  output: "static",
});
