# Recording and evaluating an own-voice model

[Voice pilot](https://github.com/loftwah/composer-media-studio/issues/714) · [Shared programme and budget](https://github.com/loftwah/app-composer/issues/1445) · [Experiment protocol](../operations/personal-model-01.md)

This guide prepares Dean's own voice for two distinct jobs: narration from text and conversion of a performance he records. The first asks whether generated speech sounds recognisably like him. The second asks how well conversion preserves the timing, cadence and emotion of the original performance. Neither a stock synthetic voice nor a provider voice identifier alone is an exported own-voice model.

## Start with the microphone already available

Use the Elgato Wave connected to the Mac. Select the microphone input rather than a processed virtual mix. Make a one-minute test in a quiet room before a long session. Listen on headphones for clipping, echo, plosives, fan noise and processing artefacts. Adjust the room and microphone position before attempting to repair a large recording afterwards.

Preserve a lossless, unprocessed master at the actual native format. **48 kHz, 24-bit mono where supported** is a sensible target; do not upsample a poorer source just to match those numbers. Leave comfortable headroom and keep loud passages below clipping. Keep a consistent comfortable position. Use an existing pop filter if available; no equipment purchase is needed before testing the current setup.

Record without backing music, reverb, pitch correction, compression or aggressive denoising. Keep raw masters even when creating cleaned, segmented or resampled copies. Export the rate/channel format the chosen model expects as a derivative. The general emphasis on a single speaker and consistent clean recordings is also supported by [ElevenLabs' recording guidance](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning); its professional-clone data requirements are service-specific, not a universal minimum.

## A staged collection plan

1. **Diagnostic:** record the short script below, listen and fix recording problems.
2. **Reference baseline:** select several clean 10–20-second excerpts with exact transcripts. These are proposed comparison clips, not a guaranteed model requirement. Try reference-conditioned speech before committing to a large corpus.
3. **Spoken adaptation set:** if adaptation addresses a useful gap, aim initially for 20–25 usable minutes for training, about five for development, and five from a separate session for final evaluation. Keep whole passages and recording sessions in one split.
4. **Performance set:** if conversion is useful, separately collect an initial 10–20 minutes of dry own-voice speech, rap or singing. Cover a comfortable range of energy and pitch. Preserve the performances that will be converted.

These durations are a proposed pilot, not a promise of voice quality. Add data in response to the observed gap: poor numbers need better number coverage; weak cadence may need better performance examples; a noisy corpus needs recording repair before more minutes.

## One-minute diagnostic script

Read naturally, as if explaining something to a mate. Leave a short pause between passages. Do not force a radio-announcer voice.

> I'm Dean, and I'm building App Composer so people can turn an idea into something they can actually use.
>
> Start with the useful outcome. Find what already exists, make the smallest sensible change, and check the result.
>
> Is the original file preserved? Can I reopen the project? What happens if the connection drops?
>
> That version works, but the layout still feels unfinished. Give the heading some room and make the primary action obvious.
>
> This is the bit I'm excited about. We can keep the good decisions and stop repeating the same mistakes.

Say one passage a little more energetically and one more quietly. Keep them separately labelled so a style choice does not become the entire definition of the voice.

## Material for the longer spoken set

Use these original passages and then explain each topic in your own words. Record the actual duration; repeating a short script until a timer runs out does not provide the same coverage as varied natural speech. Correct the transcript to what was actually spoken, including intentional contractions.

### Natural explanations

> App Composer, Prints Desktop, Media Studio and Loftwah FM each have their own job. They should work together without making you understand every internal detail.
>
> The first version was technically working, but it still needed another pass. The important question was whether someone could use it without me standing next to them.
>
> I want to keep the useful decisions from previous work. When the same problem turns up again, we should already know where to start.

Explain a project you enjoy for three or four minutes. Include a real example, what went wrong and what improved it. Avoid confidential work details that do not belong in the voice dataset.

### Instructions and questions

> Open the project, choose the original file and save a separate working copy. Check that the preview matches before exporting the final version.
>
> Is that the current source? Which change caused the problem? Can we reproduce it with a smaller example?
>
> If the upload is still running, leave it alone and check its status. Don't create another job just because the first response took longer than expected.

Explain a familiar workflow in your own words. Vary sentence length and include ordinary questions, reassurance and corrections.

### Numbers and technical vocabulary

> The job finished in one minute and forty-eight seconds. The upload took most of that time.
>
> We spent thirty-two dollars and fifty cents, including the failed attempt. That belongs in the result.
>
> Version one point two is ready. There are seven files, three recordings and twenty-four images in the project.
>
> Cloudflare Workers, EmDash, GitHub, Fungi, Oyster, Prints Desktop and App Composer are names that need to sound natural in the explanation.

Add numbers, abbreviations and domain names you genuinely expect to say. Record a pronunciation note for Loftwah and other names; do not let an automatic transcript silently replace your pronunciation.

### Energy, humour and calmer delivery

> That is much closer to what I had in mind. The colours have some life, the spacing makes sense, and I can see what I'm meant to do next.
>
> We somehow managed to make the button move every time you looked at it. Impressive, but probably not the feature we were trying to build.
>
> Take a moment and listen to both versions. The louder one isn't automatically better; the quieter one might fit the scene.

Tell a short original story or explain a favourite track. Keep your normal accent and pace. Label deliberate styles instead of combining every take into an unstructured pile.

## Development and final evaluation

Reserve different passages for development and final evaluation. The following five lines are examples for a small final comparison; collect additional natural speech in a separate session. Do not train on these target recordings or use them as the model's conditioning clip.

1. The preview is ready, but the published page still shows the previous image.
2. Keep the original recording and create a separate version for the model.
3. Sunbury to Melbourne is the first example; the next one should use a different place.
4. The result should sound like me when I'm explaining something to a mate.
5. Seven versions were generated, two were worth keeping, and the quieter one suited the scene.

For repeated tuning use development passages, then evaluate the selected candidate once on the final set. If a final result sends the project back into tuning, retain that result and use fresh held-out material for a subsequent final claim.

## Performance conversion

Record isolated own-voice performances separately from TTS narration. Include clear consonants, rhythmic speech, natural pauses and comfortable pitch changes. Keep the untouched performance as the timing/prosody reference. Start with your own material and no backing track in the vocal master.

[RVC's official FAQ](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/blob/main/docs/en/faq_en.md) recommends roughly 10–50 minutes of clean material. Its [training notes](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/blob/main/docs/en/training_tips_en.md) cover pretrained adaptation and pitch choices. Actual result quality depends on the selected assets and recordings. A mastered music mix, another singer or an AI-generated vocal is not evidence of Dean's natural voice.

## Record lineage alongside the audio

Keep private audio outside this public repository. A manifest should retain the speaker/session/clip identity, original and derivative hashes, exact transcript, duration and format, microphone/setup, style, processing history, allowed use, split and any rejection reason.

Example model-specific Qwen training input — paths below are illustrative, not supplied recordings:

```json
{"audio":"derived/train/session-a-001.wav","text":"Exact words spoken in this clip.","ref_audio":"derived/reference/dean-neutral.wav"}
```

The official [Qwen fine-tuning guide](https://github.com/QwenLM/Qwen3-TTS/blob/main/finetuning/README.md) uses audio, text and reference-audio records. Use a designated reference independent of final target recordings. Preserve richer provenance in the existing asset/corpus manifest rather than overloading the training row.

Transcription/alignment can assist segmentation, but inspect the result. Keep retakes labelled, exclude corrupt/clipped/overlapping clips, and preserve breaths and natural pauses that belong to the performance. Never silently turn an uncertain transcript into a trusted training label.

## First model routes

The first spoken candidate is [Qwen3-TTS 0.6B Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base), whose model card identifies an Apache-2.0 checkpoint. Start with reference conditioning. A local Apple Silicon inference route exists in [MLX-Audio](https://github.com/Neywa-Labs/mlx-audio); measure it on the actual Mac instead of assuming throughput or training support.

If adaptation is useful, pin the official trainer and model. The inspected Qwen trainer is full fine-tuning, not a text LoRA recipe. Its README example and code defaults differ, so use the chosen pinned configuration and calibrate a small real step. Save a checkpoint, reload it and evaluate the reloaded model. The voice lane's initial A$60 allocation shares the overall programme cap and overhead reserve.

RVC is a separate conversion candidate. Check every chosen auxiliary weight's terms in addition to the code licence. A managed voice service may be a comparator if access and cost fit, but do not confuse an account voice profile with independently exportable weights.

## Listening and measurement

Make A/B labels anonymous for comparison and match playback loudness while retaining raw outputs. Use the same unseen text/reference for spoken candidates. Listen beside natural held-out own-voice recordings.

| Dimension | What to record |
| --- | --- |
| Recognisability | Does it sound like Dean, including natural timbre, accent and cadence? Identify the failing passage. |
| Text accuracy | Omissions, repetitions, names and numbers; ASR/WER can screen, but manually check important words. |
| Naturalness | Pauses, emphasis, breaths, sentence endings and unwanted metallic/buzzy sound. |
| Style | Whether calm/energetic delivery fits the brief without changing voice identity. |
| Conversion | Timing, syllable rhythm, pitch contour, energy and consonant clarity relative to the source performance. |
| Efficiency | Generated duration, end-to-end latency, real-time factor, observable peak memory and actual cost. |
| Reliability | Failed/truncated clips, retries and variation across settings/seeds. |

The earlier reported clone was clean but not recognisably the owner. A high similarity score cannot settle that failure by itself. Record subjective feedback as feedback and automated measures as measures. Keep TTS and conversion comparisons separate because conversion receives a performance that text-only TTS does not.

After each small comparison, decide retain, revise, narrow or reject. Change one main variable and retain prior models, source data and failed results. Publish the method and deliberately selected examples; collecting/training does not automatically publish the raw voice corpus.
