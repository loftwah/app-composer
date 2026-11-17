import { z } from "zod";
import { readBoundedJson } from "./share-catalogue-asset.ts";

export const studioFilmPath = "/media-studio/watch/studio-social-kit";

export const shareFilms = [
  { id: "studio-social-kit", title: "One image. Four social sizes.", href: `${studioFilmPath}.mp4`, revision: "f7f72173c14167a47f86e83b3078eff5ebeef8e6e4248734edec1c5a3f1f3c2a" },
  { id: "studio-teaser", title: "Media Studio in 30 seconds", href: "/media-studio/films#studio-teaser", detail: "30 seconds · Vertical teaser", revision: "6726f9dfe1c6e9ef1724700dd8c7c701cdaffcc973e673c17cbb9b68fdee25a0" },
  { id: "take-it-with-you", title: "App Composer · Take it with you", href: "/brand/campaign/take-it-with-you-20261118.mp4", detail: "10.5 seconds · A workshop commercial made in ElevenCreative", revision: "187134b76dc0687d95e263d7b3bb2b7cf6507affb4204e61c2badaeff567d046" },
  { id: "studio-showcase", title: "Build an owned Media Studio", href: "/media-studio#watch", detail: "82 seconds · From Init to a published result", revision: "a5e2636d05ccc4a2adc978a2573f0238143c0feab09f6c427fd043605561a345" },
  { id: "pippa-clip", title: "Clip Pippa’s animation", href: "/media-studio/tutorial#pippa-demo", detail: "Studio demo · Video Clip", revision: "12f4e3331a61d404ddfeaace4f525d3446926daee549836d50b01289a325f390" },
  { id: "after-hours-trim", title: "Trim the After Hours track", href: "/media-studio/tutorial#audio-trim-demo", detail: "Studio demo · Audio Trim on a phone", revision: "3c8459e4be21f88ed8e63d094d2a38a83124380178d1d28e121176b2232bb1c5" },
  { id: "paper-light", title: "Paper & Light", href: "https://media.loftwah.com/p/Na9FNUB_VhzZ7zA9", detail: "A finished film assembled in Media Studio", revision: "f2658e4afa20463a88dd346cff7b8c19dcf94f37c675a7651ce76a421c68cc67" },
  { id: "setup-to-software", title: "From setup to software", href: "https://woodhouse.loftwah.com/share/app-composer/app-composer-20261014.mp4", detail: "15 seconds · App Composer product film", revision: "d7a8d4325ea7be6bfb847e94b2eb3323922e6463635e1f5555ea87dc79be4e0e" },
  { id: "creator-hub", title: "Turn a live example into your own draft", href: "/demo/examples/creator-hub#walkthrough-film", detail: "22 seconds · Creator Hub", revision: "5346a34ad08abf9ed74999ede97f62f0d290782ba1e585dc67b8bb62ecc0a00d" },
] as const;

// Reasons are suggestions, not scores. A note can disagree with its vote.
export const filmFeedbackReasons = {
  up: ["Strong opening", "Shows the real workflow", "Easy to follow", "Good pace", "Good sound"],
  down: ["Slow opening", "Hard to read on a phone", "Needs more real product footage", "Unclear next step", "Sound needs work"],
} as const;

export const studioPublicationOrigin = "https://media.loftwah.com";

const studioShowcaseSchema = z.object({
  version: z.literal(1),
  films: z.array(z.object({
    slug: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    title: z.string().min(1).max(160),
  })).max(24),
});

export async function loadStudioShowcase() {
  try {
    const signal = AbortSignal.timeout(2_000);
    const response = await fetch(`${studioPublicationOrigin}/share-films.json`, {
      redirect: "error",
      signal,
    });
    if (!response.ok) return null;
    const payload = studioShowcaseSchema.safeParse(await readBoundedJson(response, signal));
    return payload.success ? payload.data.films : null;
  } catch {
    return null;
  }
}
