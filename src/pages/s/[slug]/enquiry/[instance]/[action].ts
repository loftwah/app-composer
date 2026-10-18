import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { publicEnquiryRequest } from "../../../../../lib/public-enquiries";
import type { EnquiryRuntime } from "../../../../../lib/private-enquiries";
export const POST: APIRoute = ({ request, params }) => {
  if (params.action !== "submit" && params.action !== "receipt")
    return new Response(null, { status: 404 });
  return publicEnquiryRequest(
    request,
    env as unknown as EnquiryRuntime,
    params.slug ?? "",
    params.instance ?? "",
    params.action,
  );
};
