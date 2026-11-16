# Matched media comparison (#601)

One real matched pair of saved Media Studio outputs, published so a reviewer can
choose between them blind. This is the media counterpart to the build-agent
comparison in `benchmarks/results/compare.json`. It is not a model leaderboard.

| File | What it holds |
| --- | --- |
| `task.json` | The frozen media task, the public input, the shared settings and the observation rubric |
| `configurations.json` | The reviewed read-only Studio extract: two models, one saved trial each, exact artifact facts |
| `ingest.mjs` | Offline validator and record builder. It checks the pair, the bytes, the digests and the side paths; it never calls Studio or a provider |
| `run.json` | The committed `benchmark-media/v1` record the page and export read |

The page is `/benchmarks/media`; the revealed record is
`/benchmarks/media/runs/<id>`; the export is
`/benchmarks/media/runs/<id>/export.json`. Votes use the existing
`benchmark_votes` table and `/api/benchmark-votes`; no migration was added.

## The pair

Read from the Studio's production D1 `media-studio` database, `generations`
table, on 16 November 2026 at about 10:08 UTC. The queries were read-only. Project
ids, generation ids, asset ids, retained keys, provider request ids and the exact
prompt were read only to locate and verify the rows; none is committed.

Both rows are **saved** video jobs from 15 November 2026 with the same prompt
digest, the same attached still bytes, the same recipe, the same five-second
duration and the same `from-image` aspect. The model is the only intended
variable.

| | Side A (`take-01`) | Side B (`take-02`) |
| --- | --- | --- |
| Model key | `h3-max-turbo` | `kling-standard` |
| Inventory label | MiniMax H3 Max Turbo · 768p | Kling 2.5 Turbo Pro |
| Provider | MiniMax | Kling |
| Studio recipe | `animate-a-still` | `animate-a-still` |
| Duration request | 5 s | 5 s |
| Aspect | `from-image` | `from-image` |
| Input still sha256 | `7758a17c…2411b` | `7758a17c…2411b` |
| Prompt sha256 | `fbba4384…671d` | `fbba4384…671d` |
| Saved clip | 1344×768, 5.184 s, 2,658,207 bytes, sha256 `c01e4a8f…a97e` | 1920×1080, 5.042 s, 14,658,571 bytes, sha256 `71454b56…4cd2a` |
| Video | H.264, 24 fps, AAC stereo 32 kHz | H.264, 24 fps, no audio track |
| Studio estimate | US$0.24 | US$0.35 |
| Provider charge | not recorded | not recorded |
| Saved-job latency | 17,129 ms (10:00:14.910 → 10:00:32.039 UTC) | 141,181 ms (10:00:46.589 → 10:03:07.770 UTC) |

Input: **The line escapes the margin**, a public Woodhouse artwork
(`visibility: public`, reviewed 14 November 2026), 1536×864 PNG,
sha256 `7758a17c…2411b`, credited to Woodhouse · gpt-image-2.6-flare · OpenAI
Image API. The committed `input.jpg` is a 960-pixel preview of those bytes; its
own digest is recorded in `task.json`.

The exact prompt text is withheld because the Studio project is private. Its
digest is committed so the two rows can be shown to share it. The public summary
is in `task.json`.

### The mismatch that is disclosed, not repaired

The recorded prompt names paper grain and a warm lamp glow, while the attached
still is the burnt-orange margin artwork. The prompt and the still disagree. The
two models resolve that conflict differently:

- **Side A** starts on the orange artwork, then crossfades to a paper-and-lamp
  scene within about half a second and stays there. It follows the prompt text
  over the attached still.
- **Side B** opens on the orange artwork and keeps that scene for the full five
  seconds. It follows the attached still.

Those are recorded as **observed** checks from a manual review of frames at 0 s,
0.5 s and every 0.5 s. They are not an automated perceptual judge. The mismatch
is also why this pair is useful for instruction-following but weaker as a clean
"animate this exact still" test. A corrected pair would need a new Studio run,
which would spend money; that is not done here.

## Sample size

- 2 models, 2 saved jobs, 1 pair.
- 1 saved trial per model. **0 repeats.** No variance or confidence interval is
  claimed.
- The page states this as "no repeated trials"; the run view exposes
  `sample.repeats: 0` and `sample.trialsPerConfiguration: 1`.

## Cost and latency labels

Every cost is the **Studio estimate written on the saved job row**, not a
provider invoice. No row records `provider_charged_micro`, so no provider charge
is claimed. Latency is the gap between `created_at` and `completed_at`, which
includes queue and provider time; it is not the clip's own duration (5.184 s and
5.042 s).

## Public-safety basis

- The only input is a reviewed public artwork. Neither clip contains a person,
  private document, prompt text, project id, asset id or provider request id.
- The clips are abstract motion studies of that artwork. The published still is
  already visible at
  `https://woodhouse.loftwah.com/campaign/20261114-commissions/master/new-073-7758a17cd5e12dd1.png`.
- The two committed MP4s are byte-for-byte copies of the saved Studio artifacts.
  The posters and input JPEG are clearly labelled derivatives; their digests are
  recorded.
- If the owner withdraws the pair, remove the two clips, posters and input
  preview, and delete the record. The page refuses to render an unregistered run.

## Check it

```sh
node benchmarks/media/ingest.mjs --check
node benchmarks/media/ingest.mjs --check --json
node --test tests/benchmark-media.test.mjs
pnpm check:types
```

The ingest check validates:

- the same input sha256, prompt sha256, recipe, duration and aspect on both
  sides, with different models;
- each saved artifact's committed byte count and sha256;
- that the artifact paths are `animate-a-still/p01/<side>/clip.mp4` and never
  name a model;
- that the pair id and side assignment match the same hash rule the vote API
  uses (`pairsFor`), so a vote cannot reveal the wrong side;
- that every observation has a result and the `failed` list matches the failed
  checks;
- that no private Studio field or id appears in the record.

The tests also cover the media preview route (correct type, allowlisted name,
byte-count enforcement, byte ranges, missing artifact), the blind identity leak,
the matched-pair refusals, sample-size honesty, the D1 vote round trip and the
export → reopen round trip.

## What is still missing for #601

1. **No repeated trials.** One saved output per model cannot show variance. A
   repeated pair would need new provider jobs.
2. **One media kind only.** This is a five-second image-to-video pair. The
   matched-input query also found a text-to-image pair with the same prompt and
   square aspect, but it was not ingested or published because its public-safety
   and input review is not part of this change. The query returned no audio
   group with more than one model.
3. **The prompt/still conflict.** The pair measures behaviour under a
   contradictory input, not a clean single-brief animation. A corrected prompt or
   still is a new run and a new spend.
4. **No provider invoice.** The estimates are Studio row values; no
   `provider_charged_micro` is recorded.
5. **Observed checks are manual.** The file and duration checks are
   deterministic; the scene checks are a sampled-frame review, not a perceptual
   model.
6. **Votes are unauthenticated.** The page reuses `benchmark_votes`, which stores
   a self-declared label. No production vote was written by this change; the
   receipts page reads the live table and changes its wording when a real vote
   exists. The tests exercise the write, update and reveal paths against SQLite.
7. **No deployment in this task.** The branch is committed locally; publishing
   and the live playback check belong to the integrating session.

The approximately **US$0.59** queued pair remains queued. This change spends
nothing: it reads two already-saved jobs and copies their retained artifacts.
