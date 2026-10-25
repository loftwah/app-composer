/**
 * Compatibility shim for EmDash 1.3.1's email-only external user lookup.
 * This checks an explicitly reviewed binding; it never provisions, merges,
 * changes a role, or derives a binding from an email address.
 */
export function validateSubjectBindingInput(input) {
  if (!input || typeof input !== "object")
    throw new Error("Invalid binding input");
  const {
    issuer,
    subject,
    idpId,
    upstreamIssuer,
    upstreamSubject,
    userId,
    expectedEmail,
    reviewedBy,
  } = input;
  if (
    typeof issuer !== "string" ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)
  ) {
    throw new Error("An exact Cloudflare Access issuer is required");
  }
  for (const [name, value] of Object.entries({
    subject,
    idpId,
    upstreamSubject,
    userId,
    reviewedBy,
  })) {
    if (
      typeof value !== "string" ||
      !value.length ||
      value.length > 256 ||
      /[\u0000-\u0020\u007f]/.test(value)
    ) {
      throw new Error("Invalid " + name);
    }
  }
  if (typeof upstreamIssuer !== "string")
    throw new Error("An exact upstream issuer is required");
  let upstream;
  try {
    upstream = new URL(upstreamIssuer);
  } catch {
    throw new Error("An exact upstream issuer is required");
  }
  if (
    upstream.protocol !== "https:" ||
    upstream.username ||
    upstream.password ||
    upstream.hash ||
    upstream.search ||
    upstreamIssuer.length > 512
  ) {
    throw new Error("An exact HTTPS upstream issuer is required");
  }
  if (
    typeof expectedEmail !== "string" ||
    expectedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+$/.test(expectedEmail)
  ) {
    throw new Error("The reviewed current email is required");
  }
  return {
    issuer,
    subject,
    idpId,
    upstreamIssuer,
    upstreamSubject,
    userId,
    expectedEmail,
    reviewedBy,
  };
}

export const bindingInsertSql = `
  INSERT INTO composer_access_subject_bindings
    (issuer, subject, idp_id, upstream_issuer, upstream_subject, user_id, reviewed_by)
  SELECT ?, ?, ?, ?, ?, id, ? FROM users WHERE id = ? AND email = ? AND disabled = 0
`;

export async function assertAccessSubjectBinding(payload, jwt, runtime) {
  const mode = runtime.CF_ACCESS_SUBJECT_BINDING;
  // Legacy operation is deliberate during owner-safe prebinding. A typo must
  // never quietly disable a guard that the operator intended to enforce.
  if (mode === undefined || mode === "compatibility") return;
  if (mode !== "enforce") throw new Error("Invalid subject binding mode");
  if (
    !runtime.DB ||
    !payload.sub ||
    typeof payload.sub !== "string" ||
    payload.sub.length > 256 ||
    /[\u0000-\u0020\u007f]/.test(payload.sub) ||
    typeof payload.email !== "string"
  ) {
    throw new Error("Subject binding unavailable");
  }
  const binding = await runtime.DB.prepare(
    `
    SELECT b.user_id, b.idp_id, b.upstream_issuer, b.upstream_subject, b.reviewed_by, b.revoked_at, u.email, u.disabled, u.role
    FROM composer_access_subject_bindings b
    JOIN users u ON u.id = b.user_id
    WHERE b.issuer = ? AND b.subject = ?
  `,
  )
    .bind(payload.iss, payload.sub)
    .first();
  if (
    !binding ||
    binding.revoked_at !== null ||
    binding.disabled !== 0 ||
    binding.email !== payload.email
  ) {
    throw new Error("Subject binding not accepted");
  }
  validateSubjectBindingInput({
    issuer: payload.iss,
    subject: payload.sub,
    idpId: binding.idp_id,
    upstreamIssuer: binding.upstream_issuer,
    upstreamSubject: binding.upstream_subject,
    userId: binding.user_id,
    expectedEmail: binding.email,
    reviewedBy: binding.reviewed_by,
  });
  // The installed adapter uses get-identity.email rather than JWT.email. Check
  // that trusted endpoint against the signed claims before it can reach the
  // email-only EmDash lookup. Do not log the JWT, identity or contact address.
  const response = await fetch(
    "https://" + runtime.CF_ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/get-identity",
    {
      headers: { Cookie: "CF_Authorization=" + jwt },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error("Access identity unavailable");
  const identity = await response.json();
  // Access sub is itself email-associated. A stable upstream OIDC principal is
  // also mandatory: a recycled email can retain the SAME Access sub.
  // Use Cloudflare's documented user_uuid, not the installed adapter's stale
  // AccessIdentity.id type. Missing or renamed fields fail closed.
  if (
    identity?.user_uuid !== payload.sub ||
    identity?.email !== binding.email ||
    identity?.idp?.id !== binding.idp_id ||
    identity?.oidc_fields?.iss !== binding.upstream_issuer ||
    identity?.oidc_fields?.sub !== binding.upstream_subject
  ) {
    throw new Error("Access identity does not match its binding");
  }
  return { userId: binding.user_id, email: binding.email, role: binding.role };
}
