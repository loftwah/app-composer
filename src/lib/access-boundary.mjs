import { createRemoteJWKSet, jwtVerify } from "jose";
import { assertAccessSubjectBinding } from "./access-subject-bindings.mjs";
const keySets = new Map();
const denied = (message) =>
  new Response(message, {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function administrationGuard(request, runtime, resolved) {
  let path = new URL(request.url).pathname;
  // Astro repeatedly decodes, collapses separators and resolves dot segments.
  // Reject ambiguous forms before delegation; keep ordinary Unicode/unreserved paths.
  const invalid = () =>
    new Response("Ambiguous request path", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  if (path.includes("//") || /%(?:25|2f|5c)/i.test(path)) return invalid();
  try {
    path = decodeURIComponent(path);
  } catch {
    return invalid();
  }
  if (
    path.includes("%") ||
    path.includes("\\") ||
    path.includes("//") ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  )
    return invalid();
  if (!path.startsWith("/_emdash")) return null;
  const team = runtime.CF_ACCESS_TEAM_DOMAIN,
    audience = runtime.CF_ACCESS_AUDIENCE,
    jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!team || !audience || !jwt)
    return denied(
      "Owner administration is closed until trusted Cloudflare Access authentication is configured.",
    );
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))
    return new Response("Invalid Access configuration", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    let keys = keySets.get(team);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL("https://" + team + "/cdn-cgi/access/certs"),
      );
      keySets.set(team, keys);
    }
    const { payload } = await jwtVerify(jwt, keys, {
      issuer: "https://" + team,
      audience,
      algorithms: ["RS256"],
    });
    const binding = await assertAccessSubjectBinding(payload, jwt, runtime);
    if (
      resolved &&
      binding &&
      (resolved.user?.id !== binding.userId ||
        resolved.user?.email !== binding.email ||
        resolved.user?.role !== binding.role)
    ) {
      throw new Error("Resolved account does not match the immutable binding");
    }
    return null;
  } catch {
    return denied("Access identity was not accepted");
  }
}

export async function protectAdministration(request, runtime) {
  return administrationGuard(request, runtime);
}

// Runs after installed EmDash authentication and before Composer route dispatch.
// EmDash fetches get-identity again and resolves by email; the resolved local ID
// must still be the exact bound, enabled account with its current local role.
export async function protectResolvedAdministration(
  request,
  user,
  runtime,
  session,
) {
  if (
    runtime.CF_ACCESS_SUBJECT_BINDING === undefined ||
    runtime.CF_ACCESS_SUBJECT_BINDING === "compatibility"
  )
    return null;
  const rejection = await administrationGuard(request, runtime, { user });
  // Installed middleware persists a public-page identity before next(). Remove
  // that identity on refusal; retain every unrelated owner session value.
  if (rejection) session?.delete("user");
  return rejection;
}
