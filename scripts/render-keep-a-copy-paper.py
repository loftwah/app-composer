"""Render the paper closing card and patch only the final shot of Keep a Copy."""

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/campaign/who-keeps-the-map"
BASE = ASSETS / "keep-a-copy.mp4"
BASE_SHA = "ad6432b4a2fd02991671ead1f18b49e3d00a4d350a1fb79afa52b6fa937e5032"
START_FRAME = 894


def media(*args):
    return subprocess.check_output([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
        *map(str, args),
    ])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def card(path, fonts):
    art = Image.open(ASSETS / "ask-the-owner-v1.webp").convert("RGB")
    paper = ImageOps.contain(art, (490, 591), Image.Resampling.LANCZOS)
    board = Image.new("RGB", (1280, 720), "#e7e1d5")
    board.paste(paper, (84, 61))
    draw = ImageDraw.Draw(board)
    ink = "#241d4e"
    bold = lambda size: ImageFont.truetype(str(fonts / "Arial Bold.ttf"), size)
    regular = lambda size: ImageFont.truetype(str(fonts / "Arial.ttf"), size)
    draw.line((628, 111, 1178, 111), fill=ink, width=3)
    draw.text((628, 130), "THE LOFTWAHFM RELEASE", font=bold(26), fill=ink)
    draw.multiline_text((621, 205), "Who Keeps\nthe Map?", font=bold(90), fill=ink, spacing=0)
    draw.text((628, 437), "19 tracks, two films and a comic", font=regular(31), fill=ink)
    draw.text((628, 518), "Listen on LoftwahFM", font=bold(35), fill=ink)
    draw.text((628, 568), "fm.loftwah.com", font=regular(32), fill=ink)
    board.save(path)


def frame_hashes(path):
    return [
        line.rsplit(",", 1)[-1].strip()
        for line in media("-i", path, "-map", "0:v:0", "-f", "framemd5", "-").decode().splitlines()
        if not line.startswith("#")
    ]


def decoded_audio_hash(path):
    return hashlib.sha256(media("-i", path, "-map", "0:a:0", "-f", "s16le", "-")).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fonts", type=Path, default=Path("/System/Library/Fonts/Supplemental"))
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if sha(BASE) != BASE_SHA:
        raise SystemExit("The published cut does not match the pinned master.")
    with tempfile.TemporaryDirectory(prefix="composer-paper-cut-") as owned:
        owned = Path(owned)
        end_card = output / "keep-a-copy-paper-card-v1.png"
        card(end_card, args.fonts)
        opening, closing = owned / "original-0.mp4", owned / "closing.mp4"
        # 29.8 seconds is the closed-GOP boundary used by the original export.
        media("-i", BASE, "-map", "0:v:0", "-c:v", "copy", "-f", "segment",
              "-segment_times", "29.8", "-segment_time_delta", "0.016",
              "-reset_timestamps", 1, owned / "original-%d.mp4")
        media("-loop", "1", "-framerate", 30, "-i", end_card, "-frames:v", 156,
              "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
              "-preset", "fast", "-crf", "18", "-threads", "2", closing)
        concat = owned / "concat.txt"
        concat.write_text(f"file '{opening.name}'\nfile '{closing.name}'\n")
        result = owned / "keep-a-copy-paper-v1.mp4"
        media("-f", "concat", "-safe", 1, "-i", concat, "-i", BASE,
              "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", result)
        before, after = frame_hashes(BASE), frame_hashes(result)
        assert len(before) == len(after) == 1050
        changed = [index for index, (a, b) in enumerate(zip(before, after)) if a != b]
        assert changed == list(range(START_FRAME, 1050)), changed[:20]
        audio = decoded_audio_hash(BASE)
        assert audio == decoded_audio_hash(result)
        destination = output / result.name
        destination.write_bytes(result.read_bytes())
        receipt = {
            "schema": "composer.keep-a-copy-paper-edit/1",
            "base": {"file": BASE.name, "sha256": BASE_SHA},
            "output": {"file": destination.name, "sha256": sha(destination), "bytes": destination.stat().st_size},
            "closingCard": {"file": end_card.name, "sha256": sha(end_card),
                "artwork": "ask-the-owner-v1.webp", "artworkSha256": sha(ASSETS / "ask-the-owner-v1.webp")},
            "changedTimeMs": [29800, 35000],
            "frames": {"fps": 30, "unchanged": START_FRAME, "changed": len(changed), "total": len(after)},
            "decodedAudioSha256": audio,
            "captions": {"file": "keep-a-copy-en.vtt", "sha256": sha(ASSETS / "keep-a-copy-en.vtt")},
            "ownerReview": "pending",
            "providerCalls": 0,
        }
        (output / "keep-a-copy-paper-v1.json").write_text(json.dumps(receipt, indent=2) + "\n")
        print(json.dumps(receipt))


if __name__ == "__main__":
    main()
