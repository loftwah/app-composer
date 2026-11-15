# Private play-through — 15 November 2026

This is the owner-only route through the work delivered in this run. It uses the
real projects and provider jobs already in the live Studio; it does not ask you
to generate or spend anything. Open the links while signed into your own
Composer session.

**Live source:** Composer `f26c94030e039c54c49d009d860b5b396736821f`
(Worker `8fa56e05-d986-43b5-8b51-45cb37c9a6f2`); Studio
`2640e67b7224f9c3a2ada1b77e364769ac4039b5` (Worker
`e560dc4b-4c97-4ccd-a098-f4e2b89fa098`).

A later content-only Composer release `3540bf9` (Worker `e1452737`) corrected
the tutorial's caption and spec-revision text; the routes below and the model
behaviour are unchanged.

## 1. Start from a brief

1. Open <https://composer.loftwah.com/init?start=media-studio>.
2. Choose the Media Studio starting point. The still choices include
   **Studio Draft · FLUX.2 Klein 9B**; there is no SDXL Lightning option.
3. Set a project name and export the spec or copy the agent handoff.
4. Optional recovery check: import this older selection and confirm the visible
   notice before saving:

   ```json
   {
     "version": 1,
     "focus": "image",
     "imageModel": "studio-draft",
     "videoModel": "hailuo-standard",
     "aspect": "portrait",
     "durationSeconds": 6,
     "projectName": "Retirement recovery check"
   }
   ```

   Expected: the form loads **Studio Draft · FLUX.2 Klein 9B** and explains
   that the retired choice was replaced.

## 2. Open the real studio and its current capability manifest

- Project library:
  <https://media.loftwah.com/#/p/prj_be2b53ca02d04c37aeaaf5996fbdb3cb/library>
- Capability manifest: <https://media.loftwah.com/capabilities.json>

Look for contract `media-studio-capabilities`, `checkedAt`, the eight
Composer-selectable models, the retired `studio-draft` record with the SDXL
endpoint, and **zero alerts** in the last-good snapshot.

## 3. Review the Director scene change

1. Open **Assemble**:
   <https://media.loftwah.com/#/p/prj_be2b53ca02d04c37aeaaf5996fbdb3cb/assemble>
2. Open **Plan a music video → Paper & Light — studio motion study**. The saved
   plan is now **revision 6**.
3. Open **Review a scene proposal**. The saved scene 1 direction is:

   > Open on the wide studio, then settle on the wheel as the light crosses the
   > room.

   The prior revision 5 direction was:

   > Open on the wide view of the studio and let the setting breathe.

This run prepared the typed proposal, previewed the before/after, applied it to
the draft only, saved it, reloaded, and confirmed revision 6 through the project
API. Timing, selected takes and captions were unchanged. Direct editing and the
scoped MCP path still read the same saved revision.

## 4. Watch the finished caption-burned cut

Open the saved local render:
<https://media.loftwah.com/#/a/prj_be2b53ca02d04c37aeaaf5996fbdb3cb/asset_a8ee90d0730f4276a9d2808c73d0ee99>

Expected:

- 640 × 360, 16.8 s, 2.6 MB, video/mp4;
- caption **“A little room to make something.”** visible at the start;
- audio decodes and plays;
- **Private render receipt** binds storyboard
  `cmp_song_plan_2d30ef57ceb945408f26873ffd4c04c2_6`, plan revision 6, three
  source hashes, the mixed soundtrack asset `asset_65f899bf72df47febcc779c63f2f5275`,
  caption look **classic subtitle**, and output SHA-256
  `4e1afba9a3219768034bd6ba6251ae3ec9b526be35256e3bf2df5bb41596203e`.

This is a local device render with no provider generation charge. The older
33.04 s film and its receipt remain in the same project.

## 5. Check the model comparison and current draft result

- Comparison: <https://media.loftwah.com/compare?project=prj_be2b53ca02d04c37aeaaf5996fbdb3cb>
  (choose the project if the link does not preselect it).
- The matched H3/Kling motion pair and Film/Print still pair are unchanged.
  Provider charges remain **not reported**; the page shows allocated estimates.
- The new live Studio Draft result is in **History**:
  <https://media.loftwah.com/#/p/prj_be2b53ca02d04c37aeaaf5996fbdb3cb/history>
  It is `gen_4515ab469ca948dfbe5587bbf142c8ac`, 1024 × 1280, saved on
  `@cf/black-forest-labs/flux-2-klein-9b`, US$0.016 allocated estimate.

## 6. Workspace and share boundary

- The Studio project is owned by the Composer workspace that opened it. A
  bridge session without that workspace or the named project is refused before
  a read, edit, generation or publication.
- Public work remains at <https://media.loftwah.com/gallery> and the Woodhouse
  Share catalogue at <https://media.loftwah.com/portfolio>. Nothing private was
  published in this run.
- The docs front door is <https://composer.loftwah.com/docs>; the technical
  reference is <https://composer.loftwah.com/docs/how-it-works>.

## 7. Owner-only checks that still need you

- **Brand Studio skin:** open
  <https://composer.loftwah.com/_emdash/admin/plugins/composer-stacks/brand-studio>.
  Cloudflare Access asks for your own sign-in; the new **Workshop press** skin
  is under Appearance, starts silent with sound/haptics off, and saves through
  the existing preview/publish/restore path. This run could not open the admin
  page because the browser session had no Access session.
- **Provider invoices:** no invoice was read or linked. All charges on the
  comparison page remain **not reported**.
- **A brand-new independent deployment:** the existing Creator Hub and Studio
  blueprints remain **Reference** until replayed with a separate owner account.
  This run did not create a new GitHub account, Cloudflare account or resource
  set.
- **MCP:** a real Codex/OpenCode login and authenticated production tool call
  still need a human OAuth consent.

## Verification notes

- Live viewport checks in the owner session at 1728×851, 864×426 (200% reflow),
  432×213 (400% reflow), 390×844 and 320×640: no horizontal document overflow;
  rail, stage and save bar remain present in the Assemble workbench.
- Studio `pnpm check` 319/319 after the merged releases.
- Composer release gates passed; live build read-back is `f26c940`.
- Private screenshots and receipts from this run are in the ignored
  `output/capability-qualification-20261115/` directories, not public pages.
