# Local publisher observation, 18 October 2026

This is a completed **small fictional publisher lab**, with manual reconciliation and the remaining gates below. It is not a hosted migration, a migration of any real Macedon publication, physical passkey proof or completion of issues 165–168.

The genuine source ran WordPress 7.1.3/PHP 8.3.35, WP-CLI 2.12.0 and MariaDB 11.4.8 using the official digests in `versions.json`. Native `wp export` produced the imported WXR (35,838 bytes, SHA-256 `814140dd2815dc1a2f43be1d2e53e53eb484097f759c7341c2e94a6c4fe7f0dd`). It contained eight posts, three pages, three source authors, three attachments and two threaded comments. JSON fixture files seeded WordPress through its APIs; they never seeded EmDash.

An empty project from Composer's actual content-project recipe started with zero entries/media/accounts. The ordinary EmDash 1.2.0 (`b5f37c646`) setup, passkey sign-in and WordPress import UI created the destination content. The local browser used an isolated virtual WebAuthn authenticator; authentication guards were retained. The official checksummed Exporter 1.2.0 subsequently skipped the existing eleven entries, deduplicated media, and added site identity and two threaded comments.

The installed importer left image alt/caption empty and flattened the category parent in both paths. For this bounded publisher the native Media Library reconciled the two images' exact source descriptions, and the native Categories editor restored Walks → Field notes. Automatic metadata and hierarchy fidelity remains unmet. Original attachment bytes were unchanged. Three source guest bylines were retained without creating login users. Private/pending source posts became drafts; the future post remained scheduled at the same UTC instant, differing from current documentation's draft description. Future clock execution is untested.

The owner edited an imported story, saved a revision separately from publishing, then published through the ordinary confirmation. A misplaced first demonstration edit was corrected with native rich-text selection and typing; reconciliation proved every original paragraph/link text remains, followed by one clean new paragraph. The correction was published after WordPress shutdown. Native media crop-copy and replacement exercised only a new copy, retaining all imported originals. A new story was drafted with that owned image, verified unavailable publicly while a draft, opened with the native Preview button, published and found in its own archive. Story routing/preview/search were explicitly saved in the native Content Types editor.

WordPress, MariaDB and the temporary source tunnel were stopped. The local source refused connections and its former HTTPS endpoint returned 530. A fresh unauthenticated Chrome 155 profile then loaded the independent target: seven original public paths returned 200 and four non-public old addresses returned 404. All eleven original entry titles/body text/status/bylines/topic assignments reconciled. All three original attachments returned byte-identical SHA-256 values from destination-owned storage. Public comments retained their thread. The destination contained nine posts, three pages, four media and two comments after ordinary owner work.

The fresh browser checked 390×844, 1440×1000 and 390×540 in both themes. Local fonts and owned images decoded, no horizontal overflow appeared, and the Apps dialog kept Close/search fixed above its scrolling destinations. Pointer opening focused Close; Ctrl+K focused search; empty results, Escape and focus return worked. An actual Apps → public Link Check → Back → close/reopen journey retained a body-text story search. No request targeted the stopped source host. The unauthenticated media-administration API returned 401. These are browser observations, not physical-device acceptance.

Useful ignored evidence lives under `output/wordpress-weekender-20261018/`: source inventory/WXR and engine pins, native import reconciliation, owner UI captures, six-view source-offline proof, old URL/HTTP boundary receipts, final database/media reconciliation and exact cleanup. Private migration keys remain only in the temporary private directory and are removed with that run. No database, dependency tree or entire temporary project is retained as evidence.

The approximately thirty-article scenario, Classic Editor, synced/dynamic blocks, automatic hierarchy/media metadata, importer recovery/cutover/restore, future scheduling, hosted/account/provider boundaries, physical authentication and Elementor/ACF/commerce remain open. Complete and independently review this first publisher slice before expanding those requirements.

## Runtime refresh, 25 October 2026

This run qualifies a **local upgrade of the existing small fictional publisher** from EmDash 1.2.0 (`b5f37c646`) to 1.3.1 (`12a179389`). It does not establish a fresh 1.3.1 migration, full media-link recovery or completion of #167. The generic content-project recipe retains its independent EmDash 1.2.0/Node 22 boundary. Only this lab overlays the exact 1.3.1/Cloudflare adapter, Astro 7.4.2, React 19.3.1, Wrangler 4.152.0 and Workers types 5.20261024.1, with Node 22.23.4/pnpm 12.9.1 and its own frozen lockfile. Reviewed transitive patch policy is local to the lab. The destination command refuses mismatched declared toolchain pins before project creation and records its selected toolchain.

Source base was `3f4cca7505b788590205c7da3926c4fac6609ab1`. The genuine WordPress 7.1.3/PHP 8.3.35, WP-CLI 2.12.0 and MariaDB 11.4.8 source exported eight posts, three pages, three attachments and two comments. The final native WXR was 36,528 bytes, SHA-256 `62bed1a997f4bc72ae74ce795bdefe05687248070c393220bdbbd1fb6b834c27`. A newly created independent 1.2 destination started empty; ordinary native setup, passkey sign-in and the WordPress wizard imported its eleven entries. Authentication used one isolated Chromium virtual authenticator, without bypassing guards or claiming physical authentication. Source fixtures never seeded EmDash.

The first temporary tunnel exited with its launcher, and native media import failed closed with `SSRF_BLOCKED` / no DNS addresses. An owned detached launcher kept the replacement transport alive. The genuine WXR retry skipped all eleven existing entries and imported all three original files. Their destination-owned SHA-256 bytes matched the source. This transport change left retired source URLs in imported content; it was not hidden by changing the importer or database. The native 1.2 editor saved and explicitly published one added paragraph. A misplaced automation selection was repaired through native rich-text selection before publication; reconciliation confirmed every original paragraph and link text remains, followed by one clean added paragraph.

The same destination database, media storage, owner and credential then remained in place for the exact 1.3.1 frozen installation. After its actual startup, before further owner work, rows matched exactly for all eight posts, three pages, four saved revisions, bylines, taxonomy assignments, media records, owner identity/role and the single passkey credential count; all three media byte hashes also matched. The existing passkey signed the same fictional owner in through the native 1.3.1 challenge/verify flow. This is preservation and reauthentication evidence, not a session-recovery claim.

In the actual 1.3.1 editor, the owner added and saved a second paragraph. An unauthenticated public request still showed the earlier 1.2 publication and omitted the saved 1.3.1 paragraph. The native image chooser replaced that story's retired external featured image with the already imported app-owned original, preserving its bytes. The ordinary **Publish changes** confirmation then made both paragraphs and that image public. Final reconciliation retained all eleven original texts/statuses/bylines, eight posts, three pages, three media and one login account, with six revisions after owner work. The scheduled fixture remained at `2032-04-21T22:30:00.000Z`; future execution was not tested.

Both actual destinations passed `pnpm check` (strict source/types/lint/format and three application tests) and `pnpm build` under Node 22.23.4. Both Astro checks reported zero errors and warnings. The initial baseline check exposed only the generic recipe's compact empty-branding JSON formatting; the lab normalizes whitespace without changing its values or the generic recipe. The installed upgraded target's `pnpm audit --prod --json` reported zero vulnerabilities. Seven focused lab lifecycle/ownership/toolchain tests pass. These generated-project checks do not replace Composer's release gates.

WordPress, MariaDB and the registered tunnel were stopped. The local source refused connections and HTTPS returned 530. A fresh unauthenticated Chromium profile then observed seven public paths returning 200 and all four non-public source addresses returning 404. It fetched all three destination-owned original attachments with matching bytes; the media-administration inventory returned 401. The edited story rendered at 390×844 and 1440×1000 using the actual theme control in light and dark, with no horizontal overflow and a decoded app-owned featured image. Phone and desktop pixels were inspected. Browser proof does not establish physical-device or assistive-technology acceptance.

**Media fidelity remains open:** the other three public stories still reference the retired tunnel for their featured images, and the four original guide links remain external. The fresh browser recorded three attempted requests to that retired host. Image alt/caption remain empty and the category parent remains flattened from the baseline import; WXR comments/site settings were not reconciled in this refresh. No zero-source-request, automatic metadata fidelity, fresh 1.3.1 import, full small-publisher acceptance, approximately thirty-article scenario, Classic Editor, dynamic/synced blocks, cutover/restore or hosted deployment is claimed.

Bounded ignored evidence is under `output/wordpress-refresh-20261025/`: source inventory/WXR, before/upgraded/final reconciliation and exact equality receipt, actual check/build/install/audit logs, native owner and four source-offline public captures, visibility/media/auth observations and cleanup receipts. Hidden lazy app-dialog images initially stalled an unbounded screenshot wait; the corrected capture waits only for the visible article image with a timeout and uses the native theme control. It does not infer themes from screenshot filenames.

Cleanup removed the one registered temporary root, its private authentication material, owned dev/browser processes, Docker Compose services, network and volumes (`dockerDownSucceeded: true`, `rootRemoved: true`, no failure). The run's unshared CLI image was removed. WordPress/MariaDB image digests were preserved because another stopped lab still has containers using them; those unrelated resources were not changed. The original Protocol 11 and Playwright images remain. No entire temporary project, database or authentication material was copied into evidence.

## Fresh native import and reconciliation — 25 October continuation

This separate trial created an **empty independent destination** with Composer's
content recipe and the lab's pinned EmDash 1.3.1 overlay. Its source was genuine
WordPress 7.1.3, PHP 8.3.35 and MariaDB 11.4.8. Native owner setup and the native
import wizard used a virtual browser passkey, with no development login bypass.
Eight posts, three pages and three original media files imported. The wizard
rewrote eight media URLs in four public records; private/pending source statuses
map to native drafts, and the future record retained its 2032 scheduling value.
Visibility preservation is qualified; exact status equivalence is not.

The remaining four featured-image references had destination-owned URLs but
external/empty native IDs. A reviewed plan matched unique SHA-256 media bytes
and converted these unresolved references to native local IDs through normal
revision-aware content saves. Two blank image descriptions/captions and the
Walks → Fieldnotes category parent were restored with the native media/term
APIs. Media metadata has no atomic revision token: the lab used one writer and
compared expected values before saving. Only the four already-public records
were explicitly republished. Two further rich-text edits through the native
editor preserved the original prose, first owner note, guide links, media,
configuration and owner/passkey. Each saved edit stayed a draft until the native
publication confirmation. Final observations contained eight native revisions.

The reusable [read-only reconciliation helper](../../../docs/wordpress-reconciliation.md)
produces field patches, never credentials, network calls or automatic
publication. Six focused tests cover retained revision tokens, ambiguous bytes,
unrelated links, existing local images and owner-selected image metadata. A
pure replay of the captured initial observations matched the exact four-entry /
two-media plan already exercised against the native APIs; no stale token was
subsequently dispatched.

**Source-off acceptance passed.** After stopping the source containers and HTTPS
tunnel, a fresh unauthenticated Chromium profile checked all eleven original
addresses: seven public 200s and four nonpublic 404s. Three destination media
files matched their original bytes; anonymous media inventory returned 401.
The actual article and both owner notes rendered at 390/1440px in both native
themes without overflow or any retired-source request. Separate live HTTP
checks qualified eleven visibility-aware legacy-ID boundaries (301 for public,
404 for nonpublic), all four original guide downloads, media MIME and byte
hashes. The actual phone/desktop captures were visually inspected. Destination
`pnpm check` passed in 17.141s and `pnpm build` in 16.656s.

**Go:** this exact small fictional publisher, with deliberate reconciliation,
normal native editing/publication and destination-owned media. **No-go without
further trials:** automatic metadata parity, comments/site-settings migration,
WordPress plugins/dynamic blocks/commerce, larger publisher acceptance, future
scheduler execution, hosted cutover, provider restore, physical passkeys and
physical-device/screen-reader acceptance. The official exporter was installed
in the fictional source but its comments/settings path was not exercised.
The earlier 1.2→1.3.1 upgrade evidence remains a separate trial.

Bounded [receipts](../../../docs/evidence/product-completion-20261025/) and the
[actual source-off article capture](../../../public/evidence/weekender-reader-20261025.png)
are retained; raw fictional inventories/check logs remain ignored under
`output/completion-20261025/wordpress/`. The exact target daemon was stopped,
then the maintained lab cleanup removed its registered containers, network,
volumes, private migration key, passkey profile and entire temporary root.
Cleanup recorded `rootRemoved:true`, `dockerDownSucceeded:true` and no failure
at 11:28:05 UTC. No real publisher, production data or independent app pin changed.
