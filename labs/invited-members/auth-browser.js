async (page) => {
  // LAB_OPTIONS is injected by auth.mjs into this temporary script only.
  const lab = LAB_OPTIONS;
  const browser = page.context().browser();
  const identities = [];
  const contexts = [];
  const unwrap = (reply) => {
    if (!reply.ok || reply.body?.success === false || reply.body?.error)
      throw Error("Native auth endpoint refused: " + JSON.stringify(reply));
    return reply.body.data ?? reply.body;
  };
  async function call(p, path, body) {
    return p.evaluate(
      async ({ path, body }) => {
        const response = await fetch(path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-EmDash-Request": "1",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        let reply;
        try {
          reply = JSON.parse(text);
        } catch {
          throw Error(
            "Non-JSON native endpoint " +
              path +
              " status " +
              response.status +
              " url " +
              response.url +
              " body " +
              text.slice(0, 180),
          );
        }
        return { ok: response.ok, status: response.status, body: reply };
      },
      { path, body },
    );
  }
  async function credential(p, options, create) {
    return p.evaluate(
      async ({ options, create }) => {
        const publicKey = create
          ? PublicKeyCredential.parseCreationOptionsFromJSON(options)
          : PublicKeyCredential.parseRequestOptionsFromJSON(options);
        const credential = await navigator.credentials[
          create ? "create" : "get"
        ]({ publicKey });
        return credential.toJSON();
      },
      { options, create },
    );
  }
  async function context() {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    contexts.push(ctx);
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
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
    const preflight = await p.goto(lab.origin + "/_emdash/api/auth/mode");
    if (
      preflight.headers()["x-composer-isolated-lab"] !==
      lab.root.split("/").at(-1)
    )
      throw Error(
        "Browser did not reach this isolated lab; no native auth writes permitted.",
      );

    return { ctx, p };
  }
  async function signIn(p, expectedRole) {
    const options = unwrap(
      await call(p, "/_emdash/api/auth/passkey/options", {}),
    ).options;
    const result = unwrap(
      await call(p, "/_emdash/api/auth/passkey/verify", {
        credential: await credential(p, options, false),
      }),
    );
    if (result.user.role !== expectedRole)
      throw Error("Unexpected native role " + JSON.stringify(result.user));
    const current = unwrap(await call(p, "/_emdash/api/auth/me"));
    if (current.id !== result.user.id || current.role !== expectedRole)
      throw Error("Native persisted session differs from sign-in");
    return current;
  }
  const owner = await context();
  const setupStatus = await call(owner.p, "/_emdash/api/setup/status");
  unwrap(
    await call(owner.p, "/_emdash/api/setup", {
      title: "Fictional invited creators",
      tagline: "Local native-account qualification",
      includeContent: false,
    }),
  );
  const registration = unwrap(
    await call(owner.p, "/_emdash/api/setup/admin", {
      email: "owner@example.test",
      name: "Fictional owner",
    }),
  );
  unwrap(
    await call(owner.p, "/_emdash/api/setup/admin/verify", {
      credential: await credential(owner.p, registration.options, true),
    }),
  );
  const ownerUser = await signIn(owner.p, 50);
  await owner.ctx.storageState({ path: lab.root + "/owner-state.json" });
  const invitations = [];
  for (const [key, name] of [
    ["member-a", "Fictional member A"],
    ["member-b", "Fictional member B"],
  ]) {
    const email = key + "@example.test";
    const invited = unwrap(
      await call(owner.p, "/_emdash/api/auth/invite", { email, role: 10 }),
    );
    if (
      !invited.inviteUrl ||
      !new URL(invited.inviteUrl).hostname.endsWith("loftwah.com")
    )
      throw Error("Expected local-only native invitation handoff");
    invitations.push({ key, name, email, url: invited.inviteUrl });
  }
  identities.push({
    key: "owner",
    id: ownerUser.id,
    role: ownerUser.role,
    name: ownerUser.name,
    session: "owner-state.json",
  });
  for (const invite of invitations) {
    const member = await context();

    const token = new URL(invite.url).searchParams.get("token");
    if (!token) throw Error("Native invite URL has no token");
    const options = unwrap(
      await call(member.p, "/_emdash/api/auth/invite/register-options", {
        token,
        name: invite.name,
      }),
    ).options;
    unwrap(
      await call(member.p, "/_emdash/api/auth/invite/complete", {
        token,
        name: invite.name,
        credential: await credential(member.p, options, true),
      }),
    );
    unwrap(await call(member.p, "/_emdash/api/auth/logout", {}));
    const user = await signIn(member.p, 10);
    const session = unwrap(
      await call(
        member.p,
        "/_emdash/api/plugins/composer-members/read?action=session",
      ),
    );
    if (!session.ok || session.actor.subject !== user.id)
      throw Error("Member bridge did not resolve native session");
    const denied = [];
    for (const path of [
      "/_emdash/api/plugins/composer-stacks/read?action=list",
      "/_emdash/api/plugins/composer-miniapps/read?app=showcase&action=list",
      "/_emdash/api/admin/users",
      "/_emdash/api/settings",
    ]) {
      const response = await call(member.p, path);
      if (response.status !== 403)
        throw Error(
          "Expected native role10 denial: " +
            path +
            " " +
            JSON.stringify(response),
        );
      denied.push({ path, status: response.status });
    }
    const shell = await member.p.goto(
      lab.origin + "/_emdash/admin/plugins/composer-miniapps/apps?app=showcase",
    );
    await member.p.waitForTimeout(700);
    identities.push({
      key: invite.key,
      id: user.id,
      role: user.role,
      name: user.name,
      session: invite.key + "-state.json",
      denied,
      adminShell: {
        status: shell.status(),
        title: await member.p.title(),
        text: (await member.p.locator("body").innerText()).slice(0, 300),
      },
    });
    await member.ctx.storageState({
      path: lab.root + "/" + invite.key + "-state.json",
    });
  }
  // Keep contexts for the labelled journey in this owned CLI session. No
  // authenticator key or session token is included in this public-safe receipt.
  return {
    schema: "composer.native-member-auth/1",
    origin: lab.origin,
    mode: "local native passkey",
    physicalPasskey: false,
    productionAccessAdmission: false,
    identities,
  };
};
