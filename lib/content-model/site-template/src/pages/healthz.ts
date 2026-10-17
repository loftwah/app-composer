export function GET() {
  return new Response(
    JSON.stringify({ application: "content-site", status: "ok", recipe: 1 }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
