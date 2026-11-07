# Owner jobs — the plain-English version, 7 November 2026

Seven jobs only you can do. Everything else is my work.

You do not need any of these to keep the site running. Do them in any order, or
not at all. If you only do one, do **Job 1**. If you do two, do **Job 1 and
Job 2**.

When you finish one, reply in Discord with the number and a few words, like
`1 done` or `2 token in .env`. That is all the reporting I need.

**Never paste a password, key or token into Discord, GitHub or a screenshot.**
Jobs 2, 4 and 5 put secrets in the `.env` file on your Mac, which is ignored by
git.

---

## Job 1 — Turn on the paid Workers plan (5 minutes, costs money)

**What it is:** Cloudflare has a free plan and a paid plan. The paid one lets
Composer actually install plugins. Without it, plugin install always says
"sandbox not available". This is the one that unlocks the most.

**Do this:**

1. Open <https://dash.cloudflare.com> and log in.
2. Look at the top-left. Pick the account **Loftwah** (or the account that owns
   `composer.loftwah.com`).
3. In the left sidebar click **Workers & Pages**.
4. Click the **Plans** tab. If you don't see "Plans", look for an **Upgrade**
   or **Change plan** button on the Workers overview.
5. Choose **Workers Paid** and confirm. Cloudflare will show the price before
   you pay.

**Then reply:** `1 done`

**What I do after:** add the plugin sandbox to the app, deploy it, install one
reviewed plugin on the real site, and record install → turn off → turn on →
update → remove as proof.

---

## Job 2 — Make a read-only key for me (5 minutes, free)

**What it is:** a key that can *look* at your Cloudflare account but cannot
change anything. It lets me show you what you're running and what it costs.

**Do this:**

1. Open <https://dash.cloudflare.com> and log in.
2. Click your **profile picture** (top right) → **My Profile**.
3. Click **API Tokens** → **Create Token**.
4. Scroll down to **Custom token** → **Get started**.
5. Name it: `App Composer read only`.
6. Under **Permissions**, add these five rows (click the dropdowns):

   | First box | Second box | Third box |
   | --- | --- | --- |
   | Account | Workers Scripts | Read |
   | Account | D1 | Read |
   | Account | R2 | Read |
   | Account | Workers KV Storage | Read |
   | Account | Account Settings | Read |

7. Under **Account Resources**, choose **Include** → your account.
8. Click **Continue to summary** → **Create Token**.
9. Click **Copy**. The key looks like a long line of letters and numbers.

**Now put it in the file.** Open Terminal, paste this one line, replace
`PASTE_KEY_HERE` with the key, press Return:

```sh
cd ~/gits/app-composer && echo 'CLOUDFLARE_API_TOKEN_READ=PASTE_KEY_HERE' >> .env
```

**Then reply:** `2 done`

**What I do after:** run the inventory and show you every resource, what's
declared, what's drifting and what it costs. Read-only. Nothing changes.

---

## Job 3 — Turn on two-factor and tell me who is allowed in (5 minutes, free)

**What it is:** two-factor means "password plus a code on your phone". It
protects the admin area. The second part is just deciding who gets into the
private team app we're going to build.

**Do this:**

1. Open <https://dash.cloudflare.com> → profile picture → **My Profile**.
2. Click **Authentication** → **Two-Factor Authentication** → **Add**.
3. Follow the prompts with your phone. Save the backup codes somewhere safe.

Then answer two questions in your reply:

- **Who should be allowed into the private team app?** Give me email addresses,
  or tell me a group name if you use Google Workspace or Microsoft 365.
- **Who is the second test person?** A second email I can invite. It can be your
  own second address.

**Then reply:** `3 done. Allowed: you@example.com, mate@example.com. Second: alt@example.com`

**What I do after:** build the private team app so it requires a real sign-in
and a real MFA check, invite those people, and prove that someone outside the
list cannot get in. I will not change your Cloudflare Access rules without
asking you first.

---

## Job 4 — Make free test accounts for shops and payments (20 minutes, no real money)

**What it is:** to build checkout without charging anyone, we use each
provider's "test mode". Think of it as a pretend shop with pretend money.

Do only the ones you want. Each is independent.

### Stripe (cards)

1. Go to <https://stripe.com> and sign up or log in.
2. Turn on **Test mode** (toggle, top right). It should say TEST MODE.
3. Click **Developers** → **API keys**.
4. Copy the **Secret key**. It starts with `sk_test_`.

### PayPal

1. Go to <https://developer.paypal.com> and log in with your PayPal account.
2. Click **Apps & Credentials** → **Sandbox**.
3. Click **Create App**, name it `App Composer test`.
4. Copy the **Client ID** and **Secret**.

### Shopify

1. Go to <https://www.shopify.com/partners> and log in.
2. **Stores** → **Add store** → **Development store**. Name it anything.
3. In that store: **Settings** → **Apps and sales channels** →
   **Develop apps** → **Create an app**.
4. **Configure Admin API scopes** → tick read/write for **Orders** and
   **Products** → **Save**.
5. **Install app** → **Install** → copy the **Admin API access token** (starts
   with `shpat_`).
6. Copy the store address too, something like
   `your-store.myshopify.com`.

### Printful (printing and shipping)

1. Go to <https://www.printful.com> and sign up.
2. **Dashboard** → **Settings** → **API** → copy the token.
3. Do not order anything.

**Now put them in the file.** Open Terminal and paste this block, filling in each
value. Leave out any provider you skipped.

```sh
cd ~/gits/app-composer
cat >> .env <<'EOF'
STRIPE_SECRET_KEY=sk_test_PASTE
PAYPAL_CLIENT_ID=PASTE
PAYPAL_CLIENT_SECRET=PASTE
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_PASTE
PRINTFUL_API_TOKEN=PASTE
EOF
```

**Then reply:** `4 done. Stripe and PayPal only. No real charges allowed.`

**What I do after:** build checkout, confirm the payment actually succeeded
before showing an order, and test the failure and refund screens. Live payments
need a separate yes from you later.

---

## Job 5 — Show Google Search Console that you own the site (15 minutes, free)

**What it is:** Google will only give search data to the proven owner of a site.
This is how we get real search words and clicks instead of guesses.

**Part A — prove you own it**

1. Open <https://search.google.com/search-console> and log in.
2. Click **Add property** → choose **Domain** (not URL prefix).
3. Type `composer.loftwah.com` → **Continue**.
4. Google shows a **TXT record** value. Keep this tab open.
5. In another tab: <https://dash.cloudflare.com> → your domain
   `loftwah.com` → **DNS** → **Records** → **Add record**.
6. Type: **TXT**. Name: `@`. Content: paste the value from Google. Save.
7. Go back to Google and click **Verify**. It may take a few minutes.

**Part B — make a read-only robot key**

1. Open <https://console.cloud.google.com> and log in with the same Google
   account.
2. Top bar → **Select a project** → **New project** → name it
   `App Composer SEO` → **Create**.
3. Make sure that project is selected. Go to **APIs & Services** →
   **Library**. Search for **Google Search Console API** → **Enable**.
4. Go to **APIs & Services** → **Credentials** → **Create credentials** →
   **Service account**.
5. Name it `composer-seo-reader` → **Create and continue** → **Done**.
6. Click the new service account → **Keys** → **Add key** → **Create new key**
   → **JSON** → **Create**. A file downloads.
7. Copy the robot's email address from that page. It looks like
   `composer-seo-reader@something.iam.gserviceaccount.com`.
8. Back in Search Console: **Settings** → **Users and permissions** →
   **Add user** → paste the robot email → permission **Full** → **Add**.

**Now save the file and tell Composer where it is.** In Terminal:

```sh
mkdir -p "$HOME/.config/app-composer"
mv "$HOME/Downloads/"*.json "$HOME/.config/app-composer/gsc.json" 2>/dev/null || true
cd ~/gits/app-composer
echo "GSC_SERVICE_ACCOUNT_JSON=$HOME/.config/app-composer/gsc.json" >> .env
```

If the `mv` picked the wrong file, move the right one by hand to
`~/.config/app-composer/gsc.json`.

**Then reply:** `5 verified`

**What I do after:** connect read-only, pull real queries and pages, and give
you the first list of pages worth improving. No paid SEO tool.

---

## Job 6 — Use the site like a normal person on real hardware (30 minutes, free)

**What it is:** I can resize a browser window. I cannot honestly say "this works
on a phone", "a screen reader can use it" or "the extension works in your
Chrome". You can.

Do any of these you can. Each one is useful on its own.

### Phone

On your phone, open `https://composer.loftwah.com` and try:

- the home page
- `/init` — fill in a title and pick a theme
- `/guestbook` — leave a test postcard (it stays private)
- the admin at `/_emdash/admin/` — does the menu work with your thumb?

Notice: anything cut off, anything too small to tap, anything that jumps when
the keyboard opens.

### Tablet or stylus (only if you have one)

Open `/ldraw`, draw something, export it, open the export again.

### Screen reader

- **Mac:** press `Cmd + F5`. VoiceOver starts talking. Use `Ctrl + Option + →`
  to move around.
- **Windows:** install NVDA (free) and press `Insert`.

Visit `/init`, one role page (for example `/roles`), and `/plugin-trust`.
Notice: anything it reads wrong, anything it cannot reach.

### Chrome extension

1. Download <https://composer.loftwah.com/downloads/cloudflare-extension.zip>
2. Unzip it somewhere you'll remember.
3. In Chrome: `chrome://extensions` → turn on **Developer mode** (top right) →
   **Load unpacked** → pick the unzipped folder.
4. Open <https://dash.cloudflare.com> and look for the Composer panel.

### Link Check on a phone

Open Link Check on your phone, open the menu, tap into an input, let the page
zoom, and try to type.

**Then reply:** one line per thing you tried, for example:
`6 iPhone Safari: /init fine, upload button hidden by keyboard. VoiceOver: menu button unlabelled.`

**What I do after:** fix exactly what you found and record it as your physical
check, not my guess.

---

## Job 7 — Three yes/no decisions for the security work (5 minutes, free)

**What it is:** I can build the security features, but I cannot certify my own
work, and I cannot decide how much risk you want to take with real people's
data.

Answer these three:

1. **Where should the private data key live?**
   - **(a)** Cloudflare's own secret store. Easiest. Recommended for now.
   - **(b)** A separate key service you already pay for. Tell me which one.
2. **Will real people's private data ever go in, or do we keep using fake data
   for now?**
   - Recommended: fake data only until a security review happens.
3. **Who is the independent reviewer for the audit-style claims?**
   - A person or company name. If you don't have one, say `no reviewer yet` and
     we keep those claims off the site.

**Then reply:** `7 a, fake only for now, no reviewer yet`

**What I do after:** build the key handling the way you chose, keep fake data
enforced, and leave the audit claims off the public site until a real reviewer
signs off.

---

## That's it

Reply with numbers. I'll do the rest and tell you what it unlocked. If a step
doesn't match what you see on screen, tell me what you see and I'll adjust the
instructions.
