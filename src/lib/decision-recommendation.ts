import projectData from "../data/decision-interview-projects.json";
import type { Decision } from "./portfolio-decision-contract.ts";

export const decisionRecommendationLifetimeMs = 14 * 24 * 60 * 60 * 1000;

export function publicDecisionProject(name: string) {
  const row = projectData.find(
    ([id, project]) => project === name || (id === "share" && name === "Share"),
  );
  if (!row) return undefined;
  const [id, , url, job, tasks, proof] = row;
  return { id: String(id), url, job, tasks, proof };
}

export async function decisionRecommendationKey(decision: Decision) {
  const input = JSON.stringify([
    decision.project,
    publicDecisionProject(decision.project),
    decision.question,
    decision.context,
    decision.category,
    decision.maxSelections,
    decision.allowAll,
    decision.sources,
    decision.options.map(({ id, title, pitch, outcome, pro, con }) => [
      id,
      title,
      pitch,
      outcome,
      pro,
      con,
    ]),
  ]);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
