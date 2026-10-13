# Optional Cloudflare dashboard extension
Reviewed 13 October 2026. Third-party MV3 overlay, not an official Cloudflare integration.

Load this directory as an unpacked extension in Chrome, open https://dash.cloudflare.com, then click its action. The overlay supports Get Ready, real Init fields and a non-executing decision branch, with local resume and copy-to-Codex. It reads no dashboard account/credential fields and sends no secrets. Only an explicit action injects it under activeTab; no persistent all-sites host permission.

The copied handoff uses the standalone Composer spec and existing authorised agent. Deploy results must be returned and verified there; the extension never claims deployment from a copied prompt. Public web APIs cannot start builds. Chrome installation and real signed-in dashboard acceptance remain MP/browser gates until actually tested. No Web Store publication is claimed.
