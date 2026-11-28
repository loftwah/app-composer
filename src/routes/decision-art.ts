import type { APIRoute } from "astro";
import press from "../data/decision-art/press.jpg?inline";
import signal from "../data/decision-art/signal.jpg?inline";
import parts from "../data/decision-art/parts.jpg?inline";

export const prerender = false;

const posters = new Map(Object.entries({ press, signal, parts }));
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export const GET: APIRoute = async ({ locals, params }) => {
  const poster =
    locals.user?.role === 50 ? posters.get(params.id ?? "") : undefined;
  if (!poster) return new Response(null, { status: 404, headers });
  const data = await fetch(poster);
  return new Response(data.body, {
    headers: { ...headers, "Content-Type": "image/jpeg" },
  });
};
