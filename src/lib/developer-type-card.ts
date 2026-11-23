import { cloudflarePersonaOutcomes, type CloudflarePersonaId } from "./cloudflare-persona.ts";

/** The printable half of one Developer Type outcome. It is assembled from the
 * same trusted outcome definition the result panel reads, so an authored run
 * and a recipient's `#result=` link produce the same card. Answers, scores,
 * session state, the quiz address and the docs link never enter this copy;
 * `credit` is the only trademark line the artwork carries. */
export interface DeveloperTypeCardCopy {
  readonly archetype: string;
  readonly service: string;
  readonly tendency: string;
  readonly reason: string;
}

export function developerTypeCardCopy(id: CloudflarePersonaId): DeveloperTypeCardCopy {
  const outcome = cloudflarePersonaOutcomes[id];
  return {
    archetype: outcome.archetype,
    service: outcome.service,
    tendency: outcome.tendency,
    reason: outcome.reason,
  };
}

/** The compact credit printed above the App Composer sign-off. It keeps the
 * service designations honest without putting a second address, a product
 * icon or another organisation's identity on the card. */
export const developerTypeCardCredit =
  "Independent fan quiz by App Composer. Cloudflare, Workers, Durable Objects and Workers AI are trademarks or registered trademarks of Cloudflare, Inc.";
