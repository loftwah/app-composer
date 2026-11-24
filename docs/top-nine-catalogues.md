# Top Nine catalogue sources and artwork

Reviewed 24 November 2026 against the public Top Nine editor at
`6128fc08cd6fe78ad6d9a11efffa7fdb654ace4a`. This records the current source
contracts for [catalogue issue #1066](https://github.com/loftwah/app-composer/issues/1066).
[Editor issue #1063](https://github.com/loftwah/app-composer/issues/1063) owns
the workflow and [benchmark #1065](https://github.com/loftwah/app-composer/issues/1065)
owns comparative results.

## Catalogue and identity

| Content | What the editor reads | How it identifies a result | Fallback |
| --- | --- | --- | --- |
| PC and console games | Wikidata Action API search and entity claims | QID with a known game type. A curated P400 platform set supports PC and console filters. A release on both can appear in both. Unmapped platform claims can leave that classification incomplete. | Type a title and add a normal page link if useful. |
| Films and TV series | Separate Wikidata searches over supported film and series types | QID and known P31 type. The displayed year uses the available publication year. A recognised series can use its recorded start year when a publication year is absent. | Type a title or attach the exact work's page. |
| Apple Music albums and songs | Apple Search and ID-based lookup, with an optional explicit Wikidata album search | Storefront and the exact collection or track ID. Wikidata supplies a QID and metadata when selected. The Apple Music player uses an exact Apple Music link. | Paste an exact link, type the title or use an ordinary web page. |
| Spotify albums and tracks | Exact pasted link and bounded oEmbed lookup for the title | Verify returned provider, album or track kind and ID. The player opens on a deliberate Preview action. Spotify title search is outside this path. | Keep the link and enter the name if the title cannot be read. |
| Books and technical books | Apple Search and ebook lookup. An explicit Wikidata-books action offers additional records. | Apple storefront and exact ebook ID. Wikidata recognises supported book items and requires that an edition-only record carry its own valid ISBN-13. | Enter the edition and author as text with an exact page link. |
| Apps and programming languages | Apple software search or Wikidata language search | App Store storefront and exact app ID. Languages require a non-deprecated programming language claim on the exact QID. | Type the label and optionally link to the app, language or its documentation. |
| Food and custom mixtures | The creator's text and optional ordinary public HTTPS pages | A normal page is an outbound link. A mixed paste may carry an explicit supported music source in its separate third column. | A text-only board is available for every category. |

The adapters and canonical URL rules live in the
[Apple request helper](../src/lib/itunes-catalogue.ts),
[Wikidata adapter](../src/lib/top-nine-wikidata.ts),
[music adapter](../src/lib/top-nine-music.ts),
[books adapter](../src/lib/top-nine-books.ts),
[apps adapter](../src/lib/top-nine-apps.ts) and
[ordinary links](../src/lib/top-nine-pages.ts).

## Requests and caching

- Apple sends one keyless browser request for a deliberate search or lookup. The editor asks for up to 30 music matches and 15 book or app matches. Storefronts and kinds are bounded, and the shared request timeout is six seconds. Apple publishes its own usage conditions. The observed public endpoint requires no project API key. A guaranteed quota or future price has not been established. [Apple Search API](https://performance-partners.apple.com/search-api) · [Apple lookup examples](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html)
- Wikidata sends one search and at most one batched entity request per submit. An exact QID has a one-request lookup. The code uses a six-second timeout per request, a named API user agent and anonymous CORS. Site-side rate limits and the provider's API etiquette still apply. [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access) · [MediaWiki API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)
- Spotify exact title lookup is one anonymous, six-second oEmbed read. Composer uses the validated title and discards the returned HTML and artwork fields. The official iframe has its own streaming and availability rules. Composer's lookup requires no Spotify Web API account or key. [Spotify Embeds](https://developer.spotify.com/documentation/embeds) · [Widget terms](https://developer.spotify.com/documentation/embeds/terms)
- Bulk paste with supplied titles and ordinary links performs no catalogue read. Supported music embeds load only after Preview. The app retains chosen text and canonical links in its existing draft and result formats. It does not maintain a persistent catalogue-response, thumbnail or audio cache. The current browser integrations rely on provider CORS for JSON and the supported iframe origins for playback. [Paste planner](../src/lib/top-nine-list.ts) · [Draft format](../src/lib/share-experience-draft.ts) · [Browser controller](../src/browser/share-experiences.ts)

## Artwork, attribution and downloads

| Source | Current editor treatment | Artwork and reuse decision |
| --- | --- | --- |
| Apple Search | Selected names and canonical store links. The separate official Apple Music iframe can present its own media after Preview. | Apple limits its promotional imagery and audio to specified uses. Composer does not extract the catalogue cover, app icon or audio for the board, host it or print it into the PNG. Commercial collage and redistribution rights remain unconfirmed. |
| Spotify | Source link, validated title and provider-hosted player after Preview. | Spotify governs its own display, attribution and links. The board does not extract, composite or redistribute the player artwork or streams. Commercial reuse of those assets is unconfirmed. |
| Wikidata | Structured data with a link to the source item. | Structured data is CC0. A linked Wikimedia Commons file has its own licence, attribution and possible additional restrictions. Composer does not fetch, draw or host those linked images. |
| Creator-supplied image | The creator deliberately selects a supported file from their device. Local validation and the browser renderer produce the preview and PNG. | The creator must have permission for their intended use. The file picker establishes format and size, and the editor has no per-image rights check. Cover pixels stay out of saved drafts and result URLs. Text fallback remains available. |

Apple's promotional API terms and its official embed documentation govern different
paths. App Store artwork has separate identity rules. [Apple Search API overview](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) · [Apple Music Marketing Tools](https://artists.apple.com/support/1117-apple-music-marketing-tools) · [App Store identity guidelines](https://developer.apple.com/app-store/marketing/guidelines/)

Spotify developer terms define attribution and media usage. Wikidata's structured
data licence and Wikimedia Commons' per-file requirements provide distinct evidence.
[Spotify Developer Policy](https://developer.spotify.com/policy) · [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) · [Reusing Wikimedia Commons files](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)

## Reproduce the observed paths

- Paste the exact [PC](../tests/fixtures/top-nine-pc-games.tsv), [console](../tests/fixtures/top-nine-console-games.tsv), [film and TV](../tests/fixtures/top-nine-films-and-series.tsv), [album](../tests/fixtures/top-nine-albums.tsv) or [technical book](../tests/fixtures/top-nine-technical-books.tsv) table. Compare the title, edition and link with the selected record. [Game browser receipt](https://github.com/loftwah/app-composer/pull/1247#issuecomment-7127172618) · [Film and TV receipt](https://github.com/loftwah/app-composer/pull/1245#issuecomment-7126766515) · [Technical book receipt](https://github.com/loftwah/app-composer/pull/1239#issuecomment-7126045020)
- Repeat with [apps](../tests/fixtures/top-nine-apps.tsv), [languages](../tests/fixtures/top-nine-languages.tsv), [foods](../tests/fixtures/top-nine-foods.tsv) and the [mixed board](../tests/fixtures/top-nine-mixed.tsv). The mixed board was downloaded as a 1080 × 1350 PNG after a paste with zero catalogue requests. [App and language receipt](https://github.com/loftwah/app-composer/pull/1248#issuecomment-7127318836) · [Food and mixed receipt](https://github.com/loftwah/app-composer/pull/1249#issuecomment-7127472993)
- The source checks cover [paste](../tests/top-nine-list.test.mjs), [Wikidata](../tests/top-nine-wikidata.test.mjs), [apps](../tests/top-nine-apps.test.mjs), [books](../tests/top-nine-books.test.mjs), [music](../tests/top-nine-music.test.mjs) and [local cover intake](../tests/top-nine-cover.test.mjs). Wider discovery and comparative search, independent physical-device use, formal source-level artwork rights and approved public redistribution remain open in the owning issues.
