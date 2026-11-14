# The studio that prints itself

Homepage hero, implemented 13 November 2026. Owner direction: rethink the App
Composer opening as one continuous, explorable illustrated workshop rather than
a carousel of screenshots or floating panels. The previous sliced-artwork hero
is retained in history as superseded work; the earlier
`codex/studio-hero-motion-20261113` blockout is not the answer to this direction.

## What the browser shows

The hero is a single 3D workshop with three authored stations:

1. **Paperwork form press.** The Feed/Reset sheet button moves a printed sheet through the side
   chute. The action lowers the ram with a short mechanical beat, stamps a
   fictional `FILED` form, slides the finished page onto the output tray and
   releases a finite burst of paper offcuts. The form and the paper are invented;
   no real document is read, saved, uploaded or sent anywhere.
2. **LDraw drawing floor.** The Raise drawing / Lay it flat button lifts the ink spiral
   and its paper steps into a dimensional staircase, then returns them to the page.
   The pencil arm moves with the lift. The drawing is invented and remains an
   editable-diagram idea, not a claim about a PDF or analytics pipeline.
3. **Composer evidence lens.** A separate instrument on its own base holds three
   mechanical evidence rings. The action turns an orange pointer, lights the
   selected ring and updates the HTML readout. The lens keeps a consistent focus.
   The copy names requests, supported actions and daily coverage without inventing
   live counts. The lens is not connected to Paperwork documents or LDraw drawings.

The camera starts in its settled station view. Selecting another station moves
through the same room; stamping keeps the camera in place. Pointer parallax and
drag-to-look are available on fine pointers while normal motion is enabled. Normal document scrolling is never intercepted. The console is
available to keyboard users, and the copy, Get Ready action and ordinary app
links remain live HTML.

## Rendering and technology

- `three` 0.187.0, mature `WebGLRenderer` / WebGL2. No universal WebGPU claim.
- Authored meshes, canvas-generated paper/ink/enamel textures and a procedural
  workshop. The supplied concept artwork is art direction and a quality target,
  never a texture plane, screenshot backdrop or hidden answer.
- Toon materials with a four-step gradient, warm paper, orange enamel, midnight
  blue structure, teal accents. A single full-screen depth-contour pass turns
  silhouettes into ink and adds a fine print grain. A CSS halftone and themed
  vignette finish the surface.
- Theme-aware lighting and floor: dark midnight workshop or warm daylight
  workshop. The Composer mark on the hanging sign is drawn from the approved
  published geometry. The header and approved mark are unchanged.
- Camera, door and object visibility are bounded; the renderer stops offscreen,
  while the tab is hidden, and when paused.

## Access and fallback

- The headline, explanation, Get Ready action, station copy and real Paperwork,
  LDraw and analytics links are server-rendered HTML.
- The live console is revealed only after the first frame renders successfully.
  The poster remains beneath a brief canvas fade, and both deck layouts reserve
  their natural height so loading cannot move the following page content. Before that,
  and when JavaScript, WebGL, the module, Save-Data or the GPU context is
  unavailable, a no-JavaScript static three-station panel and a strong illustrated
  poster remain. `Get Ready` and every product link continue to work.
- Native station buttons and direct action buttons carry the scene state.
  Paperwork has Feed/Reset sheet and Stamp; LDraw has Raise/Lay flat; Analytics
  has Inspect next ring. Keyboard shortcuts: `1`/`2`/`3` move
  stations, arrow keys change the focused control or move between station
  buttons, `P` toggles pause, `Escape` resets the look offset. Focus styles and
  an aria-live announcement are present.
- `prefers-reduced-motion` disables ambient motion and camera easing;
  controls apply static states immediately and the Pause control reads
  `Reduced motion`. Pause freezes ambient motion while direct controls remain
  usable.
- The GPU experience is loaded after first paint, caps device pixel ratio at
  1.75 desktop / 1.5 phone (then can step to 1 after a measured slow start),
  follows display animation frames without the former 48fps phone limiter, and
  disposes owned WebGL resources on final unload. Resolution can adapt after
  sustained slow frames; lighting stays consistent. Pause, reduced motion,
  hidden tabs and offscreen scenes stop requesting continuous frames. No frame-rate claim is made for unmeasured devices.

## Poster provenance

`public/brand/studio/studio-poster-{desktop,mobile}-{dark,light}-20261113.webp`
are transparent captures of the **authored scene and its contour pass**, rendered
by the page itself on 13 November 2026. They contain no generated concept-art
pixels, stock imagery, screenshots or remote assets. The desktop capture is
1600 × 1000; the phone capture is 780 × 840 (2×). The CSS theme supplies the
backdrop behind the transparent capture. `PROVENANCE.txt` records the same
boundary beside the assets.

## Previous release checks

- `node --test tests/studio-hero-state.test.mjs` covers finite paper deformation,
  LDraw lift geometry, station copy truth boundaries and lens ring cycling.
- Browser inspection at 320, 390, 600, 768, 900, 1024, 1180, 1440 and 1600 px;
  dark and light themes; no horizontal overflow. Desktop and phone captures were
  visually reviewed, including the post-contour finish.
- Exercised the three interactions, repeated stamps, draw raise/flatten, lens
  ring cycling, slider keyboard changes, station keyboard shortcuts, pause,
  reduced motion, offscreen stop/resume, theme switching, GPU failure, module
  failure and the static poster/panel fallback.
- The full release command remains `pnpm deploy` from clean pushed `main`; it owns
  `pnpm check` and `pnpm build`, then the Cloudflare Worker upload and live check.

## Motion correction verification — 2026/11/14 AEDT (Australia/Melbourne, UTC+11) / 2026/11/14 UTC

The motion pass removes whole-section entrance animations, the initial camera
excursion and stamp zoom; the mobile page follows ordinary scrolling. Responsive
copy and desk stay in flow, and unavailable controls have no interaction hints.
The existing homepage journey probe now targets the current workshop and primary
links; it checks copy/deck overlap instead of the superseded screenshot hero.

`node --test tests/studio-motion.test.mjs tests/studio-hero-state.test.mjs`
exercises the actual frame loop at simulated 60/90/120Hz, first-frame readiness,
static updates, hidden/offscreen suspension, disposal and first-render failure,
alongside the original scene-state checks. Simulation establishes scheduling
behaviour, not a physical-phone frame-rate claim. The implementation PR records
current rendered checks and release limitations separately from the previous
release evidence above.

## Known limits

- Real physical-device acceptance, iOS Safari/Android GPU and battery behaviour
  remain separate from the Chromium viewport checks. No invented frame rate.
- WebGL2 is required for the live world; the poster and product links are the
  supported fallback.
- The static workshop uses fictional form and drawing state. It does not imply
  that PDFs, signatures or drawings feed analytics, and it does not display
  invented live usage counts.
