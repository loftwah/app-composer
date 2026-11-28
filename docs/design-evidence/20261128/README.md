# App Composer portfolio design review

28 November 2026 AEDT. **The creative outcome remains open.** The owner asked for sharp, modern, bright, fun and neon work with enough character to invite a request to pull it back. Production delivery, working interactions, and a considered visual direction were expected. The owner reported an overall regression after the artwork was removed. Restoring it repaired that regression. The work still fell short of the stated creative ambition.

## Owner references

Record what the supplied examples teach. Keep the original third-party work with its publisher. The order below follows the ten images in the conversation.

| Image | Example | Observation |
| --- | --- | --- |
| 1 | [Composer orange card with the hand and page](rejected-hand.webp) | The yellowed hand was explicitly rejected. Use actual white where white is intended. Keep the brand colour clean and the subject purposeful. |
| 2 | Cloudflare shield-and-city poster | A recognizable logo and recognizably orange brand elements are visible even in a busy composition. This supplied image is a reference, with publisher provenance unverified. |
| 3 | Cloudflare Region: Earth | A dark ground, a single large globe, orange point markers and useful event details. [Event programme](https://www.cloudflare.com/events/vegas/register/) |
| 4 | Cloudflare × U.S. Ski & Snowboard | A clean white ground and two confidently separated brand colours carry a real invitation. The supplied capture is the composition reference. |
| 5 | Cloudflare eMudhra article in a social feed | A single subject carries a clear story at feed size, with room for the platform's title overlay. [Article](https://blog.cloudflare.com/emudhra-certificate-compromise/) |
| 6 | Cloudflare agentic CLI announcement in a social feed | The product story is explicit, and the dark ground and orange accents give it a distinct identity. [Article](https://blog.cloudflare.com/cloudflare-cf-cli-launch/) |
| 7 | Cloudflare Connect in a social feed | A strong orange field, recognizable typography and concrete details carry one event. [Connect](https://www.cloudflare.com/connect/) |
| 8 | [Composer workshop press](../../../public/brand/campaign/build-it-keep-it-running-1728-20261128.webp) | A distinctive authored scene. Restoring it was useful for recovering lost character. The restoration did not establish a new creative high point. [Production restoration](https://github.com/loftwah/app-composer/pull/1430) |
| 9 | [Studio jellyfish promotion](../../../public/brand/campaign/media-studio-og-20261117-v2.jpg) | Vivid but weak as a demonstration of what the visitor can make or do. The user called out the choice of imagery and its presentation. |
| 10 | [Share gallery-room promotion](../../../public/brand/campaign/share-og-20261117-v2.jpg) | The scene depicts a gallery, but the position could show a useful original work and a credible path to its source instead. The user called out the choice of imagery and its presentation. |

Other sources studied during the thread were [Figma Community](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files) for preview-to-use, [Are.na](https://help.are.na/docs/getting-started/connections) for discovery through connections, [Linear](https://linear.app/changelog) for clear workflow proof, [Raycast Store](https://www.raycast.com/store) for featured resources with a direct action, [Wheel of Names](https://wheelofnames.com/) and [Picker Wheel](https://pickerwheel.com/) for wheel and input accessibility, [Photopea](https://www.photopea.com/) for a browser-local editing entry, and [Acrobat Fill & Sign](https://www.adobe.com/acrobat/online/sign-pdf.html) for a direct document action. These are references for decisions, hierarchy and craft. The owner uses Cloudflare as a minimum for coherent brand choices and expects more energy from this suite.

## What we tried

- [Rejected Share and Studio drafts](rejected-card-drafts.webp). Share paired a Pippa poster and an album cover. Studio used a lighthouse still. These were owned, legible images with weak editorial reasons to lead. Neither draft was published.
- [Three Share comparisons](https://github.com/loftwah/app-composer/issues/11#issuecomment-7232863827). Google Stitch MCP generated separate Project Index, Colour Bench and Social Kit concepts. We adapted them into [Project Index](https://composer.loftwah.com/share/compare/projects), [Colour Bench](https://composer.loftwah.com/share/compare/palette), and [Social Kit](https://composer.loftwah.com/share/compare/social). Search, clipboard CSS and the real four-format export worked. The attempt was aimed at Share while the request covered the suite.
- [Previous public openings](previous-openings.webp), [tools-first release](tools-first.webp), and [art restored](art-restored.webp). Five further Google Stitch MCP briefs covered Composer, Studio, Share, Paperwork and Spin. The adapted production layouts made useful actions easier to reach, but the tools-first choices removed too much imagery. Restoration returned the Composer workshop print, paired a published film with Studio tools, and brought back Paperwork's press beside its real sample. Restoration was recovery. It did not deliver the requested creative leap. [Five-surface delivery](https://github.com/loftwah/app-composer/issues/11#issuecomment-7233509514) · [Restoration](https://github.com/loftwah/app-composer/issues/11#issuecomment-7233994850)
- Public link cards served in production for [Composer](https://composer.loftwah.com/brand/campaign/composer-make-an-app-20261128.png), [Studio](https://media.loftwah.com/media-studio-next-cut-20261128.png), [Share](https://composer.loftwah.com/brand/campaign/share-find-artwork-20261128.png), [Paperwork](https://paperwork.loftwah.com/social/paperwork-sign-a-pdf-20261128.png), and [Spin](https://spin.loftwah.com/spin-brand/spin-put-it-on-the-wheel-20261128.jpg). Served bytes and metadata establish what shipped. Usefulness, in-feed impact and the intended creative quality remain open.

## Exactly how Clef was used

Four successful bounded calls used [Cloudflare Clef-flash](https://developers.cloudflare.com/workers-ai/models/clef-flash/) through the existing Workers AI account. We supplied our alternatives and asked typed questions. There was no model-driven publishing, no behavioural measurement, and no benchmark against owner taste or unseen examples. Percentages below are the provider's option weights for these particular questions. [Exact questions and complete distributions](clef-results.json)

| Pass | What we compared | Result |
| --- | --- | --- |
| 1 and 2 | Identical text concepts with answer order reversed. Asked what would help someone find a useful Share resource, what to feature in a Share post, and what would prove Studio's value. | Same picks both times. Distinct usable Share starts, 85.11%. A single useful resource with a direct action for a Share post, 74.62%. A real Studio result alongside its edit or export, 93.68%. |
| 3 | Two 390px Share renders, existing Studio promo, and real Studio walkthrough contact sheet. Asked about first action, time to see the artwork, proof of capability, and which kind of social card to make. | Prototype for finding a first action, 75.45%. Existing page for seeing art sooner, 79.66%. Actual walkthrough for proving the workflow, 85.38%. A purpose-built result card for social, 89.11%. |
| 4 | Two public phone montages, before and after across the five products. Each question targeted a task, such as finding an editing action or spotting the wheel. | New Studio entry for visible editing actions, 92.55%. Composer's new entry led at 45.19% with weak confidence. Share and Paperwork leaned toward even or insufficient evidence at 44.70% and 41.52%. Spin was almost level, with 35.88% for the previous view, 33.66% for the new one, and 30.46% for even or insufficient evidence. |

[Pass 3 visual inputs](clef-visual-examples.webp) appear left to right in original A–D order, reduced for the record. The archived tools-first montage includes the later Share ordering update. Pass 4 used the earlier state, before that update.

The first visual run exposed a genuine trade-off. We compacted the Share actions, bringing the first item from 878px to 649px at 390px before further filter changes brought it to 539px. The suite comparison strongly supported Studio action discovery and left the other visual judgements weak. It happened after the tools-first deployment. It could not serve as a creative preflight. [Share Clef evidence](https://github.com/loftwah/app-composer/issues/1020#issuecomment-7230790764) · [Suite assessment](https://github.com/loftwah/app-composer/issues/1422#issuecomment-7233482338)

## Why the mission missed

The agent defined and verified smaller problems than the one the owner asked to solve. Stitch supplied compositions. The prompts and adaptations emphasized route discovery and available controls. Clef mostly graded those same questions. We had evidence that actions got easier to find and pages deployed, but those checks could not tell whether the work had a bold authored identity or whether the pictures deserved attention.

We used availability as a reason to feature artwork and then removed too much imagery when its placement was questioned. We worked on Share alternatives while the user expected the wider suite. The owner had to restate the ambition and identify the loss of character. Model output, mechanical review and green deploys gave us no grounds to close the creative brief.

## What stays open

The owner explicitly asked to keep the objectives open. They acknowledged the design direction, are willing to inspect Share, and gave credit for making feedback accessible pending their own use of it. Record these as useful progress. The unresolved outcome is expressive, genuinely useful work across the entire requested suite and the graphics people would actually want to share.

- [Portfolio design bar](https://github.com/loftwah/app-composer/issues/1422), [public experience](https://github.com/loftwah/app-composer/issues/7), and [production evidence](https://github.com/loftwah/app-composer/issues/11).
- [Composer OG and identity](https://github.com/loftwah/app-composer/issues/28), [campaign systems](https://github.com/loftwah/app-composer/issues/1408), and [Studio OG](https://github.com/loftwah/composer-media-studio/issues/693).
- [Share](https://github.com/loftwah/app-composer/issues/477), [Share discovery](https://github.com/loftwah/app-composer/issues/1020), [Studio gallery](https://github.com/loftwah/composer-media-studio/issues/13), [Studio creative experience](https://github.com/loftwah/composer-media-studio/issues/67), [Paperwork](https://github.com/loftwah/app-composer/issues/264), and [Spin](https://github.com/loftwah/app-composer/issues/1280).
- [Clef decision pilot](https://github.com/loftwah/app-composer/issues/970). Compare meaningful creative alternatives, including a genuinely ambitious direction. Ask separately about character, artwork choice, and how the task works. Keep weak or tied results visible. Use real rendered evidence, and keep owner judgement distinct from release verification.
