import { env } from "cloudflare:workers";
import { creatorPlugin } from "../lib/creator-plugin.ts";

export function createPlugin(options: { adminEntry: string }) {
  return creatorPlugin(options.adminEntry, env);
}
