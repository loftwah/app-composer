# Share and project intelligence

Reviewed 28 November 2026 AEDT. [Open Intelligence in Decisions](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review?view=intel) · [Download the public CSV](https://composer.loftwah.com/share/intelligence.csv) · [Run and comparison receipts](evidence/share-intelligence-20261128.json).

## Social readiness in 2026

Clef-flash visited the pixels for all 3,764 eligible public artwork entries. The full pass made 235 batched calls and reported 2,887,833 input tokens. It considered an organic placement, one specific intervention and a first-glance rubric. The artwork cohort includes 3,085 illustrations, 189 posters, 187 icons, 171 sketches, 114 banners, 17 screenshots and one product-art entry.

| Disposition | Artwork | What to do |
| --- | ---: | --- |
| Promising | 1,127 | Pick a real audience and destination, and check the source, eligibility and final rendered crop. |
| Needs an edit | 1,213 | Make a dedicated crop first where appropriate. Across the full set, Clef called for 1,007 dedicated crops or exports. |
| Library reference | 1,424 | Keep source, experiments, sketches and supporting artwork findable. Reuse them when they help a later piece. |
| Unreviewed | 0 | The filter also catches later or changed artwork when its current identity differs from the saved snapshot. |

The column reflects editorial triage. Platform acceptance is tested on the exported file. Audience performance needs actual measurements. Choose a dedicated wide link card, a portrait feed crop and a vertical story or Reel treatment when the job justifies them. For 2026 delivery, inspect on a phone, keep the main subject away from overlays, check the actual destination, and provide alt text or captions. App Composer's [social kit](https://composer.loftwah.com/share/compare/social) already exports multiple aspect ratios. [X image specifications](https://business.x.com/en/help/campaign-setup/creative-ad-specifications-old) · [LinkedIn Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-06) · [Cloudflare Clef-flash](https://developers.cloudflare.com/workers-ai/models/clef-flash/)

Two shortlist examples worth opening are [Crown Jelly](https://composer.loftwah.com/share/artwork/build-note-shoalshot-jelly-poster) and [Find the first spark](https://composer.loftwah.com/share/artwork/share-edition-bubbles-first-spark-pin). Their destinations, rights and final placement carry separate checks. [Live artwork search](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review?view=share&social=promising)

Clef-omni inspected the first six seconds (or the complete shorter clip) across 30 film entries backed by 29 unique public sources. Of the 30 entries, 23 called for clearer context, three for an earlier payoff and four for a reference or longer-story use. The scores concern the opening. Complete narrative, captions and sound still need a final watch for publication. [Film opening reviews](https://composer.loftwah.com/_emdash/admin/plugins/composer-decisions/review?view=share&kind=film) · [Clef-omni](https://developers.cloudflare.com/workers-ai/models/clef-omni/)

## The Stitch and Clef loop

The existing Share Stitch project produced two actual mobile drafts from public references, **Mobile Artwork Wall** and **LoftwahFM Editorial Mobile Edition**. Clef compared both with the current production opening. The current opening led each question, with the clearest signal for a credited, real campaign starting point (83.16% option weight). The next-action and character results were more divided. The draft wall suggested a useful art-forward search composition. It also invented attribution and a Creative Commons licence. The editorial draft invented a broadcast. Those details are disqualifying for publication, and the concepts remain in the design workspace. [Open the existing Stitch project](https://stitch.withgoogle.com/projects/12955215949926250487) · [Stitch programme](https://github.com/loftwah/app-composer/issues/1125)

Keep this sequence for the next iteration:

1. Open the intended project, previous decision, relevant skill and real published source. Choose one audience and action before producing mockups.
2. Use Stitch for two meaningfully different directions, including a bold option when it can teach us something. Keep the real baseline and tie any artwork to its actual source.
3. Use Clef on equivalent renders for clearly scoped questions about hierarchy, character and next action. Check the visible output and source facts by hand.
4. Carry forward the owner’s specific decision and rationale. Implement the chosen change through its owning product, exercise the actual interaction, and put the outcome against the same evidence.

## Issue history, resources and policy

The initial hunt screened 382 App Composer issue titles and found 44 candidates. Clef examined 12 distilled, public issue cases. The clearest signals were measuring the actual bottleneck in #1335 and #1277, carrying forward the accepted artwork in #1422, and exercising changed interactions in #1406. In #425, reaching Get Ready supplies partial evidence. A newcomer completing a deployment on their own account remains the useful proof. [History and lessons](https://github.com/loftwah/app-composer/issues/1443)

The highest-leverage place to cut overhead is duplicated checking. Use the exact failed interaction, a valid existing receipt and one release path. Treat metadata-only Clef and pixel-based Clef as distinct evidence behind one catalogue. Keep prototypes in the existing Stitch project. Keep the Fungi watch in #1386 and use its findings to decide whether an upstream capability makes a specific job better. A read-only named key currently supports the Originals handoff. A single permission-scoped, original-to-comparison-to-export replay is the worthwhile next Fungi bet. [Oyster and original-byte proof](https://composer.loftwah.com/articles/workers-ai-to-original) · [Fungi upkeep](https://github.com/loftwah/app-composer/issues/1386) · [Fungi ecosystem](https://docs.fungi.computer/ecosystem)

Intelligence links to source rules and lets the owner leave feedback through existing private Decisions. The responsible project owns edits to its instructions. Showcases and project rules live with their maintainers. Keep issue history, source edits, private reactions and published outcomes in those same owning systems.

## Retention and refresh

[The tracked index](../src/data/share-social-intelligence.json) records each artwork's catalogue identity, thumbnail URL hash and reviewed image hash with its placement, edit and score. It also keeps links, openings and sample hashes for the films. Git history keeps earlier snapshots. Changed artwork revisions or thumbnail URLs lose their label until the next run. The runner rechecks bytes on its next run after a 14-day cache period to catch changes served from the same URL. If the same bytes are still eligible, it can reuse the classification. A rubric change needs a fresh model pass.

From the repository root, use the existing authorised Workers AI setup:

```sh
node --env-file=.env scripts/evaluate-decision-research.mjs --social output/share-social
node --env-file=.env scripts/evaluate-decision-research.mjs --films output/share-social
node scripts/index-share-social.mjs output/share-social/social-review.json
```

The first command can take a sample count for a calibration run. The indexer requires the complete public catalogue snapshot. An incomplete render stays unreviewed. The checkpoint can resume a full pass. The browser consumes only dated labels and matching catalogue records. Use `--visual` for equivalent public renders and `--methods` for a brief of distilled public issue evidence. Both modes preserve compact receipts without secrets or owner replies. Refresh as the source or decision changes. The existing Fungi watch covers upstream changes.

The public CSV includes the dated artwork, film-opening, public method and design comparison rows. Its `kind` column separates scopes and the score and option-weight columns use different measures. Intentional blanks mark information outside a row's evidence. Regenerate it with `node scripts/export-share-intelligence.mjs output/share-social` after saving the film, method and visual receipts in that directory. The export neutralises spreadsheet formula prefixes in text and keeps the original public source link.


### Bounded artwork refresh

Run `node --env-file=.env scripts/evaluate-decision-research.mjs --social <existing-checkpoint-dir> --refresh 16` to validate at most 16 candidates. The job checks new or changed artwork before periodically rechecking bytes at the same URL. It reuses the cached cohort, keeps unreviewed artwork browseable, and preserves the film snapshot. Review the result, then run `node scripts/index-share-social.mjs <existing-checkpoint-dir>/social-review.json` to update the runtime index on the next release. Reviewed titles, projects and categories, the catalogue revision and the thumbnail identity all need to match the stored assessment. The disclosure keeps the assessment date. The dated public CSV remains the original full-run export.
