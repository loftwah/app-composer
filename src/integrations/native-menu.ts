import type { AstroIntegration } from "astro";

// Astro's supported page-script hook reaches EmDash's injected admin shell.
// No vendor source override, header selector or additional React host is used.
export default function nativeMenu(): AstroIntegration {
  const entry = new URL("../browser/native-launcher.ts", import.meta.url)
    .pathname;
  return {
    name: "composer-native-menu",
    hooks: {
      "astro:config:setup": ({ injectScript }) => {
        injectScript(
          "page",
          `if (/^\\/_emdash\\/admin(?:\\/|$)/.test(location.pathname)) import(${JSON.stringify(entry)});`,
        );
      },
    },
  };
}
