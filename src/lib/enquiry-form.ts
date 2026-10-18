// Captured from the independently maintained Guestbook enquiry renderer. MIT.
// Provenance and finite asset-copy hashes: docs/private-enquiries-assets.json.
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export function enquiryForm(
  action: string,
  _assetBase: string,
  source: string,
  target: string,
  title: string,
  publication: string,
) {
  return `<section class="enquiry-intro"><p class="collection-kicker">PRIVATE BRIEF · ${escape(title)}</p>
  <h1>What are you working on?</h1>
  <p class="lede">A short brief for this workspace. No email address, phone number or account needed.</p><p>The owner can read, review or delete it privately for up to 30 days. Daily cleanup clears expired text. Nothing is published and no notification or reply is sent. Leave out personal details and secrets.</p>
  </section>
  <link rel="stylesheet" href="/brand/enquiries/enquiry-form.css">
  <form id="private-enquiry" action="${escape(action)}/submit" method="post" data-source="${escape(source)}" data-target="${escape(target)}" data-receipt="${escape(action)}/receipt" data-publication="${escape(publication)}">
  
  <fieldset><legend>The brief</legend>
  <label>Project or enquiry name<input name="title" maxlength="120" autocomplete="off" required></label>
  <label>What should this achieve?<textarea name="goal" maxlength="2000" rows="5" required></textarea></label>
  <label>Starting point<select name="starting_point"><option>New idea</option><option>Existing site</option></select></label><label data-existing-site hidden>Existing website (optional, HTTPS)<input name="existing_site" type="url" maxlength="240" autocomplete="off" placeholder="https://"></label>
  </fieldset>
  
  <fieldset><legend>What is needed</legend><p>Up to 8 deliverables, if useful.</p><div data-deliverables></div>
  <button type="button" class="secondary" data-add-deliverable>Add a deliverable</button>
  </fieldset>
  
  <label class="postcard-consent"><input name="consent" type="checkbox" required> I agree to private delivery of this brief to this workspace for review. This does not permit publication or messages.</label>
  <button data-send disabled>Send private brief</button>
  <noscript><p>JavaScript is needed to validate the declared fields and keep an exact delivery receipt. No brief has been sent.</p></noscript>
  
  <section data-receipt-panel hidden aria-label="Delivery receipt"><p data-intent></p>
  <button type="button" class="secondary" data-check>Check delivery receipt</button>
  <details><summary>Original submitted brief</summary><pre data-original-values></pre></details>
  <button type="button" class="secondary" data-retry disabled>Retry exact submitted brief</button><p class="small">Retry becomes available only after a missing-receipt check. It sends the original snapshot with the same intent, and keeps any newer text above.</p><p class="small">A missing receipt cannot prove delivery failed. Your brief stays here; nothing is resent automatically.</p>
  </section>
  <p data-status role="status" aria-live="polite" tabindex="-1"></p></form>
  <script src="/brand/enquiries/browser/enquiry-form.js" type="module"></script>`;
}
