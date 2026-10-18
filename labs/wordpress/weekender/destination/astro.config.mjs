import { defineConfig } from "astro/config";
import { localMediaPolicy } from "./src/lib/local-media-policy.mjs";
import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import emdash from "emdash/astro";
import { d1, r2 } from "@emdash-cms/cloudflare";
import model from "./src/content-model.json" with { type: "json" };
const adminEntry = fileURLToPath(
  new URL("./src/lib/editor-fields.tsx", import.meta.url),
);
export default defineConfig({
  // Absent input stays closed. Select only this run's actual local Worker origin.
  image: localMediaPolicy(process.env.WEEKENDER_LOCAL_ORIGIN),
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  vite: { plugins: [tailwindcss()] },
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "disabled" }),
      storage: r2({ binding: "MEDIA" }),
      toolbar: false,
      plugins: [
        {
          id: "composer-content-fields",
          version: "1.3.0",
          format: "native",
          entrypoint: fileURLToPath(
            new URL("./src/lib/editor-compatibility.mjs", import.meta.url),
          ),
          adminEntry,
          options: {
            collection: model.collection,
            links: model.fields
              .filter((field) => field.type === "url" && !field.required)
              .map((field) => field.key),
            rows: model.fields
              .filter((field) => field.type === "repeater")
              .map((field) => ({
                key: field.key,
                links: field.fields
                  .filter((child) => child.type === "url" && !child.required)
                  .map((child) => child.key),
              })),
            adminEntry,
          },
          capabilities: ["content:write"],
        },
      ],
    }),
  ],
  devToolbar: { enabled: false },
});
