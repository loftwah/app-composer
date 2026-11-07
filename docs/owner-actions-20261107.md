# Owner actions — unblock list, 7 November 2026

Everything else is agent work. These seven need a decision, an account, a
credential, money, a policy change or a human body. Each says exactly what to
do, how long it takes, what it unlocks, and how to hand it back.

Reply in Discord or an issue with just the item numbers you did, for example:
`1 yes`, `2 token in .env`, `4 Stripe test key in .env`, `6 phone done`.
Nothing here is needed to keep the current production release running.

---

## 1. Workers Paid — unlocks plugin installation (#369, #365)

**Why:** EmDash's sandboxed registry installer needs Worker Loader. On
Cloudflare that means the `LOADER` binding and a `sandboxRunner`, which require
the Workers Paid plan. Without it, browsing works and install/update returns
`SANDBOX_NOT_AVAILABLE`. This is the single biggest unblock: it turns Plugin
Trust from observation into real install/update/disable/uninstall receipts.

**Do:**
1. Cloudflare dashboard → the account `1003dc1d93af0ebea56b2f1252f89627` →
   Workers & Pages → Plans → switch to **Workers Paid**.
2. Reply `1 yes`.

**Then I:** add the `worker_loaders` `LOADER` binding, configure
`sandboxRunner: sandbox()` in `astro.config.mjs`, keep `PluginBridge`, deploy
through the guarded path, install one reviewed plugin on production, record
install → configure → disable → enable → update → uninstall with exact release
identity, and close the matching #369/#365 acceptance items.

**Cost:** Cloudflare's paid Workers plan, billed by Cloudflare. I will not
enable anything else or create paid resources.

---

## 2. Read-only Cloudflare token — unlocks inventory and cost evidence (#312, #318)

**Why:** the inventory and FinOps checks already exist but have no credential.
The token is read-only; it is never printed or committed.

**Do:**
1. Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom token.
2. Scope it to account `1003dc1d93af0ebea56b2f1252f89627` with **read only**:
   - Account → Workers Scripts → Read
   - Account → D1 → Read
   - Account → R2 → Read
   - Account → Workers KV Storage → Read
   - Account → Account Settings → Read
3. Add it to the ignored `.env` as:
   `CLOUDFLARE_API_TOKEN_READ=...`
4. Reply `2 token in .env`.

**Then I:** wire that variable as the preferred read credential, run the
inventory snapshot, reconcile declared vs observed resources, tag/attribution
review and the drift report, and post the actual findings. No writes.

---

## 3. Identity and MFA decision — unlocks private team proof (#257, #351, #354)

**Why:** Access policy, IdP choice and MFA enforcement are owner decisions. I
must not change your Access policy or enroll authenticators for you.

**Do:**
1. Decide the admin identity profile: keep **Cloudflare Access** for Composer
   admin (current, supported) or move to native EmDash sign-in. Recommended:
   keep Access.
2. On the Cloudflare account, enable two-factor authentication for your own
   login (My Profile → Authentication). That is the MFA that protects the
   admin path.
3. Decide who may enter the private Team Hub: a short list of email addresses,
   or an IdP group. Recommended: one IdP group, not individual addresses.
4. Reply `3 keep Access`, `3 <idp> group <name>`, and which email is the second
   test member.

**Then I:** wire the invited-member policy, passwordless entry, required MFA
and scoped team access, and prove public vs private vs admin boundaries with a
second fictional or real invited account. No Access policy change happens
without your explicit go-ahead.

**Cost:** free unless your chosen IdP charges.

---

## 4. Commerce test accounts — unlocks orders (#105, #293–296)

**Why:** checkout, verified payment state and fulfilment need provider accounts.
Test modes cost nothing and take no real money.

**Do (test/sandbox only, no live keys):**
1. Stripe → create account if needed → Test mode → copy the test secret key.
2. PayPal → Developer dashboard → Sandbox app → client id + secret.
3. Shopify → create a development store → Admin API access token (read/write
   orders and products for that store only).
4. Printful → create account → API token; do not place an order.
5. Put them in `.env` as `STRIPE_SECRET_KEY` (test), `PAYPAL_CLIENT_ID`,
   `PAYPAL_CLIENT_SECRET`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`,
   `PRINTFUL_API_TOKEN`.
6. Reply `4 test keys in .env`. Confirm that no real charge or print order is
   authorised.

**Then I:** build the connector, hosted checkout, verified webhook state, order
follow-up and the refund/failure states against test mode. A live payment still
needs a separate explicit yes.

---

## 5. Search Console property — unlocks real search data (#397)

**Why:** the SEO Workbench must report real queries, clicks and impressions, not
estimates. That needs a verified property.

**Do:**
1. Add `composer.loftwah.com` as a **Domain** property in Google Search Console
   and verify it with the DNS TXT record in Cloudflare DNS.
2. Create a Google Cloud project, enable the **Search Console API**, create a
   service account, download its JSON key.
3. In Search Console → Settings → Users and permissions, add the service
   account email as a **Full** or **Restricted** user (read is enough).
4. Save the key outside the repository, for example
   `~/.config/app-composer/gsc-service-account.json`, and add its path to
   `.env` as `GSC_SERVICE_ACCOUNT_JSON=...`.
5. Reply `5 Search Console verified`.

**Then I:** wire the read-only property connection, run the first real query
report with date windows and sampling caveats, and produce the first useful
opportunity list. No paid SEO API.

---

## 6. Physical devices and screen reader — unlocks those gates (#264, #288, #290, #35, #177)

**Why:** I can drive a browser at 390 px but I cannot claim a real phone, a
stylus, an installed extension or a screen reader.

**Do — pick any subset you can, each is independent:**
- **Phone:** open `https://composer.loftwah.com/`, `/init`, `/guestbook`,
  `/showcase`, and the admin at narrow width. Try one real form and one upload.
- **Tablet/stylus:** LDraw at `/ldraw` — draw, export, reopen.
- **Screen reader:** VoiceOver on macOS (Cmd+F5) or NVDA on Windows through
  `/init` (the form), one role page, and `/plugin-trust`. Note anything that is
  announced wrongly or is unreachable by keyboard.
- **Chrome extension (#35):** install
  `https://composer.loftwah.com/downloads/cloudflare-extension.zip` in real
  Chrome, open the Cloudflare dashboard, and confirm the embedded Composer
  surface loads with your owner session.
- **Link Check mobile menu (#177):** open Link Check on a real phone, use the
  menu and a zoomed input.

Reply with the device/browser and what failed, for example
`6 iPhone 15 Safari: /init fine, upload button covered by keyboard`.

**Then I:** fix each observed defect and record the physical acceptance as
yours, not mine.

---

## 7. Security acceptance and assurance — (#31–34, #256)

**Why:** a security gate cannot be self-certified by the agent that wrote the
code.

**Do:**
1. **#31 key custody:** decide where the encrypted state vault key lives —
   Cloudflare secrets only, or an external KMS/HSM. Recommended: Cloudflare
   secrets for the pilot, explicit KMS decision before any real private data.
2. **#31–33:** decide whether real sensitive records are in scope for the
   pilot. If not, they stay fictional-only and the issues stay open honestly.
3. **#256 assurance:** provide or commission the control evidence — data
   location, access control, retention, incident process, backup/restore. An
   independent reviewer is required for the SOC 2/IRAP-style claims.
4. Reply `7 secrets-only`, `7 fictional-only`, and who the reviewer is (or
   `7 no reviewer yet`).

**Then I:** implement the chosen custody path, keep the fictional-only
boundaries enforced, and keep #34's end-to-end demo with fictional personas
(that part is agent work, not yours).

---

## What I will do meanwhile

No owner item blocks these, so work continues:

- #319 real external-runner proof using a local Jenkins/GitLab-style fixture.
- #408 in-repo promotion path, a real two-app host repository and rollback
  evidence.
- #365 automatic watch scheduling, pause controls, Inbox items and the sanitised
  public directory.
- #118 and #311 scoped admin/agent slices.
- #28/#29/#30 brand, copy and share-kit residuals.
- #321 independent mini-app dependency batches in each app's own repository.
