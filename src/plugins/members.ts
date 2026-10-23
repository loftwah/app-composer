import { env } from "cloudflare:workers";
import { memberPlugin } from "../lib/member-plugin.ts";
import lock from "../../composition.lock.json";
export function createPlugin() {
  return memberPlugin(
    env,
    Object.fromEntries(lock.apps.map((app) => [app.id, app.commit])),
  );
}
