# App Composer audio production prompts

Read the [briefing](https://composer.loftwah.com/pitch/briefing) as the creative reference. Its best move is following the same project past the initial build. Keep the physical workshop feel, the dry humour and the space between lines.

## Suno v6

In Custom, paste one style and its matching lyrics from [Keep it running](keep-it-running.md). Start with Style A. The arrangement targets a short, repeated hook with enough space to cut a clean edit. For the 15-second cut, use the opening, the first clean two-line hook and the hard ending. Export the selected range as WAV in Suno Studio. Export stems only if separating a vocal or percussion part helps the edit.

Use v6 for the first pass. Try v6-wild for a genuinely different interpretation if the hook holds up. Keep one accepted take, record the model and source, and check commercial-use rights for the plan and download before publishing. [Suno models](https://help.suno.com/en/articles/13924993) · [Studio exports](https://help.suno.com/en/articles/13925249) · [Commercial use](https://help.suno.com/en/articles/9601665)

## Sound mark / The latch

A short opening and closing sound for films, demos and launch clips. Start with a physical latch, followed by a tuned low pulse. Leave space in the middle for the voice.

ElevenLabs SFX v3 prompt:

> Two close-miked sounds in a quiet workshop. First a small steel case latch closes with a dry, satisfying double click. A short warm low electronic pulse answers it and stops cleanly. About two seconds. Isolated, mono-friendly, with a short tail. No voice, no backing music, no fanfare.

## 15-second spot / Keep it running

Eleven v4 narration direction. Understated, conversational Australian English. You are showing something you actually use. Give “next week” a beat and stop cleanly after “running.”

> You had the idea. Now make the useful thing. Ship it on your own accounts. Come back next week and change it. App Composer. Build it. Keep it running.

Picture and timing:

| Time | Picture | Sound |
| --- | --- | --- |
| 0–3 s | The brief or drawing appears | Latch and first line |
| 3–9 s | Real Creator Hub capture with the project open | Bed stays under the voice |
| 9–12 s | Show a genuine follow-up change, or use the editable drawing if the capture is unavailable | Pause on “next week” |
| 12–15 s | Campaign title and link | Final line and low pulse |

Music v2.5 text prompt:

> 15-second instrumental bumper, 102 BPM, dusty breakbeat and dark electric piano, one dry rim-click in the first bar, warm sub pulse under a calm close-miked voiceover. Keep the middle sparse. Resolve with one low note and a hard stop. No sung vocals, no bright corporate chords, no cinematic rise. Make it feel like independent late-night radio.

For tighter timing, use the included [15-second composition plan](eleven-music-composition-plan.json) with Music v2.5. Keep the voice, bed and latch as separate files. See [Eleven v4](https://elevenlabs.io/docs/overview/models), [Music v2.5](https://elevenlabs.io/docs/overview/capabilities/music), [composition plans](https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans) and [SFX v3](https://elevenlabs.io/docs/changelog#sfx-v3).

## Two voices / The second change

Use Eleven v4 Text to Dialogue with two licensed voices. Start dry and close. A is curious and a little sceptical. B is practical. Their pauses should sound like thinking. Assign each row as a separate turn.

| Speaker | Line |
| --- | --- |
| A | The first version works. What happens when I want to change it? |
| B | Open the same project. You still have the source, the data and the deployment. Pick the next change and check it against the working app. |
| A | So what should I try first? |
| B | Open Creator Hub. The profile and the guestbook are separate apps. You can see where they connect and what each one owns. |
| A | That's the bit I wanted to see. |
| B | Build it. Keep it running. |

Render a short audition first, select the take, then mix it against the instrumental. The second speaker should land the ownership argument rather than repeat the opener. [Text to Dialogue](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)

## The Media Studio version

The [published briefing](https://composer.loftwah.com/pitch/briefing) already serves originals, captions and chaptered transcripts on Cloudflare. Its automatic transcripts were produced locally. Our [Media Studio build](https://composer.loftwah.com/media-studio) already keeps original assets, versions, saved audio and editable cuts. It supports imported audio, saved mixes and bounded local renders.

The next contained demonstration is one script and two voices, an original bed and one real product capture. Save the script with stable turn IDs, select a take, keep the stems, mix to a new WAV, create a cut from the saved source, attach timed captions, then reopen it and change one line. The finished film and captions should carry forward the same project and source assets.

A Cloudflare-hosted transcription workflow can read approved media from private R2, run Workers AI Whisper with chunked audio, keep text and timings in project state, and publish the approved derivative. Workers AI also offers Aura-2 speech. We can retain provider-specific music and expressive multi-voice dialogue as selectable sources. A one-button NotebookLM-style film, podcast and slide generator is a product target. [Cloudflare transcription](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) · [Cloudflare Aura-2](https://developers.cloudflare.com/workers-ai/models/aura-2-en/)
