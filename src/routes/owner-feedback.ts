import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import { z } from "zod";
import build from "../lib/build.json";
import paperEdit from "../../public/campaign/who-keeps-the-map/keep-a-copy-paper-v1.json";
import campaign from "../../public/campaign/who-keeps-the-map/production-notes.json";
import { adminDecisions } from "../lib/portfolio-decision-contract.ts";
import { getDecision } from "../lib/portfolio-decisions.ts";
import { publicPagePaths } from "../lib/public-pages.mjs";
import { artworkRevision, publicShareArtwork } from "../lib/share-catalogue-asset.ts";
import {
  feedbackKey, feedbackMutation, feedbackTarget,
  type FeedbackTarget,
} from "../lib/owner-feedback-contract.ts";
import { FeedbackError, listThreads, readThread, saveOwnerFeedback } from "../lib/owner-feedback.ts";

export const prerender = false;

const runtime = env as unknown as { DB?: D1Database; RESOURCE_ENVIRONMENT?: string };
const filmRevision = campaign.outputs["keep-a-copy.mp4"].sha256;
const readInput = z.strictObject({
  thread: z.uuid().optional(),
  target: z.string().max(512).optional(),
  query: z.string().max(150).optional(),
});

async function contextFor(target: FeedbackTarget, db: D1Database, owner: string, origin: string) {
  const context = {
    environment: runtime.RESOURCE_ENVIRONMENT ?? "local",
    build: build.commit,
  };
  const stale = new FeedbackError("This target changed. Reopen it to get the current version.", 409);
  switch (target.type) {
    case "page":
      if (target.revision !== build.commit || !publicPagePaths.includes(target.path)) throw stale;
      return { ...context, project: "App Composer", title: target.path === "/" ? "App Composer home" : target.path, url: new URL(target.path, origin).href };
    case "artwork": {
      const result = await publicShareArtwork(target.id);
      if (result.status === 503) throw new FeedbackError("The artwork catalogue is temporarily unavailable.", 503);
      if (result.status !== 200 || target.revision !== await artworkRevision(result.artwork)) throw stale;
      return { ...context, project: "Composer Share", title: result.artwork.title, url: new URL("/share/artwork/" + target.id, origin).href };
    }
    case "film": {
      const paper = target.revision === paperEdit.output.sha256;
      if (target.revision !== filmRevision && !paper) throw stale;
      if (target.endMs !== undefined && target.endMs <= target.startMs)
        throw new FeedbackError("Choose an end time after the start time.", 400);
      const url = new URL("/share/who-keeps-the-map", origin);
      if (paper) url.searchParams.set("cut", "paper");
      url.searchParams.set("at", String(target.startMs / 1000));
      url.hash = "trailer";
      return { ...context, project: "Who Keeps the Map?", title: paper ? "Keep a Copy · Paper ending" : "Keep a Copy", url: url.href };
    }
    case "decision": {
      const detail = await getDecision(db, owner, target.id).catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "NOT_FOUND") throw stale;
        throw error;
      });
      if (detail.briefRevision !== target.revision) throw stale;
      const url = new URL(adminDecisions, origin);
      url.searchParams.set("id", target.id);
      return { ...context, project: detail.decision.project, title: detail.decision.question, url: url.href };
    }
  }
}

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

const route: APIRoute = async ({ locals, request, url }) => {
  const owner = locals.user;
  if (owner?.role !== 50 || request.headers.has("Authorization"))
    return json({ error: "Sign in as a Composer administrator to use owner feedback." }, 403);
  if (!runtime.DB) return json({ error: "Owner feedback is temporarily unavailable." }, 503);

  const db = runtime.DB;
  try {
    if (request.method === "GET") {
      const { thread, target, query } = readInput.parse(Object.fromEntries(url.searchParams));
      if (thread) {
        const item = await readThread(db, owner.id, thread);
        return item ? json({ thread: item }) : json({ error: "Feedback thread unavailable." }, 404);
      }
      const key = target ? feedbackKey(feedbackTarget.parse(JSON.parse(target))) : "";
      return json({ threads: await listThreads(db, owner.id, key, query) });
    }
    if (request.headers.get("Origin") !== url.origin ||
      request.headers.get("Content-Type")?.split(";")[0] !== "application/json")
      return json({ error: "Open Composer directly to save feedback." }, 403);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Enter a note." }, 400);
    const decoder = new TextDecoder();
    let body = "";
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 20000) {
        await reader.cancel();
        return json({ error: "Keep the note to 4,000 characters." }, 413);
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    const value = feedbackMutation.parse(JSON.parse(body));
    return json({ thread: await saveOwnerFeedback(db, owner.id, value,
      (target) => contextFor(target, db, owner.id, url.origin)) });
  } catch (error) {
    if (error instanceof FeedbackError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError || error instanceof z.ZodError)
      return json({ error: "Check the target and note, then try again." }, 400);
    console.error("Owner feedback operation failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "Owner feedback is temporarily unavailable. Your draft is still here." }, 503);
  }
};

export const GET = route;
export const POST = route;
