# Access identity binding — 25 October 2026

Owners: #257 / #352 / #10. Canonical release evidence remains #11.

**The installed email-inheritance defect is reproduced. A local enforcement
adapter is implemented and tested, but production enforcement is not enabled.**
Existing owner accounts, memberships, app grants and the production identity
provider are unchanged.

## Observed behaviour and the upstream contract

The fixture in `tests/helpers/access-identity-scenario.mjs` executes the actual
installed EmDash 1.3.1 external-auth middleware, its actual Kysely user adapter
and `@emdash-cms/cloudflare` 1.3.1 `authenticate()` against a synthetic RSA
JWT/JWKS and Access `get-identity` endpoint. The only framework shims supply
Astro's build-time virtual modules and production DEV flag. Storage is in-memory
SQLite; no real identities, credentials or provider requests are used.

Two correctly signed tokens with different Access subjects and upstream
principals but the same email resolve to the **same existing local user ID,
Admin role 50, workspace membership and app grant**. The installed Access
adapter returns `subject`, but EmDash core looks up `authResult.email` and never
uses the subject for user resolution. The current `syncRoles:false` preserves
the inherited role. Disabling the local account still refuses authentication.

Binding only the Access JWT subject is insufficient. Cloudflare documents
`sub` as unique to an email address per Access account; removing/re-adding the
user or changing Access organisations changes it. It does not promise that an
upstream recycled email changes that Access subject. A second negative case
therefore keeps the Access subject **and email** while changing the upstream
OIDC principal.

Official sources checked 25 October 2026:

- [EmDash authentication](https://docs.emdashcms.com/guides/authentication/):
  Access is exclusive and EmDash retains the local user, role and disabled flag.
- [Cloudflare application token and full identity](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/):
  email-associated Access subject, `get-identity`, and `user_uuid`.
- Installed `emdash/src/auth/types.ts` and `src/astro/middleware/auth.ts`:
  `AuthDescriptor` allows a custom `authenticate(request, config)`, but its
  `AuthResult` has no durable local-user binding/resolution hook. Replacing only
  the authentication adapter would still leave core's email-only resolution.
  Installed Cloudflare's `AccessIdentity.id` type also differs from the vendor's
  documented `user_uuid`; the new guard requires `user_uuid` and rejects a
  response with only the stale `id` field.

The durable fix belongs upstream in EmDash's core external-user resolution:
consume a verified immutable provider issuer/subject, persist its association
with an existing local user through explicit linking, and reject unknown
principals rather than automatically linking by email. Composer's outer guard
is a narrow compatibility adapter; it does not fork EmDash, issue credentials,
create an identity platform, or implement SAML/SCIM/group synchronisation.

## Implemented guard

Migration `0019_access_subject_bindings.sql` creates an **empty** additive table.
A reviewed binding associates an Access issuer/subject, IdP configuration ID,
immutable upstream OIDC issuer/subject and one existing local EmDash user ID.
Uniqueness prevents a second binding to that user or principal. No email match
creates a binding. The command requires the exact current enabled user ID and
email before inserting; no account, role, membership or grant is modified.

The existing Worker administration boundary verifies signature, RS256, issuer,
audience and expiry before the optional guard. With
`CF_ACCESS_SUBJECT_BINDING=enforce`, every `/_emdash` request must also satisfy:

1. An active exact binding exists and the current local user is enabled.
2. The JWT email matches that user's current email exactly; this prevents the
   installed email lookup from selecting another local account.
3. The trusted Access `get-identity` response has matching `user_uuid`, email,
   `idp.id`, `oidc_fields.iss` and `oidc_fields.sub`.

Missing claims/schema, another IdP/tenant/principal, a revoked binding,
unavailable DB/table/identity endpoint, invalid mode or malformed identity all
deny. The additional identity request uses a five-second timeout, refuses
redirects and does not retry. No identity/token is logged by this guard. The
unchanged installed EmDash adapter has its existing identity logging; that
upstream privacy behaviour is not repaired by this slice.

The mode is `compatibility` when absent or explicitly set to that value.
Compatibility deliberately preserves existing owner access and **retains the
installed email-inheritance risk**. This is readiness, not completed production
security acceptance. `enforce` also rejects current machine/service JWTs lacking
the human principal contract; machine admission remains a separate scoped design.

## Local operator command

The command works on an explicitly selected existing local SQLite file. It has
no network, Cloudflare provisioning or production configuration capability. Do
not put a bearer token/JWT in command arguments. These identifiers are synthetic.

```sh
node scripts/access-subject-binding.mjs --database /absolute/isolated-fixture.db
node scripts/access-subject-binding.mjs --database /absolute/isolated-fixture.db \
  --bind --issuer https://fictional.cloudflareaccess.com \
  --subject access-user-a --idp-id fictional-idp-a \
  --upstream-issuer https://idp.fictional.invalid/tenant-a \
  --upstream-subject principal-a --user fictional-owner \
  --expected-email owner@fictional.invalid --reviewed-by synthetic-reviewer
```

Default output contains only user/binding counts. Explicit bind output contains
only success and unchanged-resource counts. A wrong current user/email, disabled
user, missing required field or duplicate binding is refused. There is no
automatic merge, rebind, bulk import or recovery fallback. Revoking a binding
sets its `revoked_at`; retain the row as history rather than reassigning it.

## Exact remaining production gate

1. In an explicitly authorised isolated Access target, independently verify the
   actual configured IdP supplies its **immutable** issuer/subject at
   `get-identity.oidc_fields.iss/sub`, not a mutable/email-derived alias. Verify
   the actual endpoint's `user_uuid` and IdP ID and that repeat calls for the
   same issued token are consistent. Missing/unavailable fields are a blocker;
   the adapter must not silently fall back to email or Access `sub` alone.
   Production OIDC fields, provider type and this contract remain unverified.
2. Privately review each existing user's exact identifiers and current local
   user ID. Preserve/review owner recovery access and all memberships/grants.
   Prepare explicit binding rows in the isolated target and exercise accepted,
   recycled-subject, disabled, role-reduced and revoked paths there.
3. Only after that evidence, use the existing owner-authorised runtime release
   path to prepare reviewed production rows and change the mode to `enforce`.
   Check the real owner request before claiming enforcement. No production
   Access/IdP policy change or real-user binding is authorised by this document.
4. A planned rollback may restore the prior mode to recover an owner lockout,
   but doing so restores the known email risk. Keep accounts, grants and binding
   history; never delete or email-merge accounts to make rollout pass.

Email changes keep the same local user ID only after its current email is
explicitly updated and the same bound upstream identity is demonstrated. Old
email tokens then fail. Role reduction is read by installed EmDash on the next
authenticated request; this guard never copies or caches a role. Workspace/app
revocation remains enforced by the existing grant checks, not by the binding
table. Access/IdP session revocation, real MFA and physical authenticators have
not been qualified by this local fixture.

## Verification and cleanup

```sh
node --test tests/access-boundary.test.mjs tests/access-identity.test.mjs
pnpm check:types
pnpm build
```

The installed middleware reproduction, signature negatives, same/different
Access subjects, same-Access-sub upstream principal substitution, issuer/IdP
collision, missing/stale schema, email change, role reduction, disabled user,
revoked binding, DB/identity failure and operator command checks pass locally.
Tests compare original account/membership/grant rows after all reversals.
Fixture keys and SQLite are in memory. The CLI test registers cleanup for one
owned temporary root immediately and verifies removal. Existing dependency
installation is reused; no provider resource, owner database or session is used.

At base `473b8b9354f511bc38b8b5570af3d2d76c79d617`, the focused four
boundary/identity tests passed. `pnpm check:types` passed with zero errors and
warnings (63 informational hints), and `pnpm build` passed its publication guard
(1,266 files and 150 archive members). These qualify local source/build only;
the full release gate and real provider acceptance remain separate.
