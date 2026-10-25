// Local virtual passkeys exercise EmDash admission; no account/session rows are inserted.
import { join } from "node:path";
export async function nativeCall(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
        headers: {
          "Content-Type": "application/json",
          "X-EmDash-Request": "1",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        throw Error(
          "Non-JSON native endpoint: " + path + " HTTP " + response.status,
        );
      }
      return { status: response.status, body: value };
    },
    { path, body },
  );
}

export function nativeData(reply) {
  const value = reply.body?.data ?? reply.body;
  if (
    reply.status < 200 ||
    reply.status >= 300 ||
    reply.body?.success === false ||
    value?.ok === false ||
    value?.error
  )
    throw Error(
      "Native endpoint refused: HTTP " +
        reply.status +
        " " +
        (value?.code ?? value?.error?.code ?? "unknown"),
    );
  return value;
}

async function credential(page, options, create) {
  return page.evaluate(
    async ({ options, create }) => {
      const publicKey = create
        ? PublicKeyCredential.parseCreationOptionsFromJSON(options)
        : PublicKeyCredential.parseRequestOptionsFromJSON(options);
      const result = await navigator.credentials[create ? "create" : "get"]({
        publicKey,
      });
      return result.toJSON();
    },
    { options, create },
  );
}

export async function authenticateNativeActors(browser, lab, options = {}) {
  const actors = {},
    receipt = [];
  async function actor(key) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
      ...(options.output
        ? {
            recordVideo: {
              dir: join(options.output, key),
              size: { width: 1440, height: 1000 },
            },
          }
        : {}),
    });
    const page = await context.newPage();
    // Register immediately so a later authentication failure still flushes this actor's recording.
    options.onActorContext?.({
      key,
      context,
      page,
      video: page.video(),
      startedAt: new Date().toISOString(),
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    const response = await page.goto(
      lab.origins.composer + "/_emdash/api/auth/mode",
    );
    if (
      response.headers()["x-composer-isolated-lab"] !==
      lab.root.split("/").at(-1)
    )
      throw Error("Isolated lab header mismatch; refusing all native writes.");
    actors[key] = { context, page };
    return actors[key];
  }
  async function signIn(page, role) {
    const options = nativeData(
      await nativeCall(page, "/_emdash/api/auth/passkey/options", {}),
    ).options;
    const signed = nativeData(
      await nativeCall(page, "/_emdash/api/auth/passkey/verify", {
        credential: await credential(page, options, false),
      }),
    );
    const me = nativeData(await nativeCall(page, "/_emdash/api/auth/me"));
    if (signed.user.id !== me.id || me.role !== role)
      throw Error("Persisted native identity or role differs.");
    return me;
  }
  const owner = await actor("owner");
  nativeData(
    await nativeCall(owner.page, "/_emdash/api/setup", {
      title: "Fictional platform qualification",
      tagline: "Local native passkeys and two teams",
      includeContent: false,
    }),
  );
  const registration = nativeData(
    await nativeCall(owner.page, "/_emdash/api/setup/admin", {
      email: "operator@example.test",
      name: "Fictional local operator",
    }),
  );
  nativeData(
    await nativeCall(owner.page, "/_emdash/api/setup/admin/verify", {
      credential: await credential(owner.page, registration.options, true),
    }),
  );
  owner.user = await signIn(owner.page, 50);
  receipt.push({
    key: "owner",
    id: owner.user.id,
    role: owner.user.role,
    admission: "native setup, WebAuthn registration and sign-in",
  });
  for (const [key, role] of options.actorRoles ?? [
    ["creator-a", 20],
    ["creator-b", 20],
    ["app-user", 10],
  ]) {
    const email = key + "@example.test",
      name = "Fictional " + key;
    const invite = nativeData(
      await nativeCall(owner.page, "/_emdash/api/auth/invite", { email, role }),
    );
    const url = new URL(invite.inviteUrl);
    if (url.origin !== lab.origins.composer || !url.searchParams.get("token"))
      throw Error("Unexpected invitation destination.");
    const member = await actor(key),
      token = url.searchParams.get("token");
    const options = nativeData(
      await nativeCall(
        member.page,
        "/_emdash/api/auth/invite/register-options",
        { token, name },
      ),
    ).options;
    nativeData(
      await nativeCall(member.page, "/_emdash/api/auth/invite/complete", {
        token,
        name,
        credential: await credential(member.page, options, true),
      }),
    );
    nativeData(await nativeCall(member.page, "/_emdash/api/auth/logout", {}));
    member.user = await signIn(member.page, role);
    receipt.push({
      key,
      id: member.user.id,
      role,
      admission:
        "native role invitation, WebAuthn registration, logout and sign-in",
    });
  }
  return {
    actors,
    receipt,
    qualification: {
      nativeSessions: true,
      virtualPasskeys: true,
      physicalPasskeys: false,
      productionAccess: false,
      insertedIdentityOrSessionRows: false,
    },
  };
}
