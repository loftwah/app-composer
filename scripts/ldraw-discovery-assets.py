#!/usr/bin/env python3
"""Compose LDraw discovery assets from one qualified, unchanged live capture.

Python 3 + the already-installed Pillow; no network, browser, install or deploy.
Inspect first, then render only after release qualification supplies the capture,
its expected hash, the exact released source and an evidence reference. This
compositor checks the supplied bytes; it does not perform release qualification.
"""

import argparse
from datetime import datetime
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFont, __version__ as pillow_version


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/brand/apps"
FONT = ROOT / "src/assets/fonts/SpaceGrotesk.ttf.bin"
MARK = ROOT / "public/brand/composer-icon-20261022b-512.png"
RECIPE_REVISION = 2
RECIPE = "composer.ldraw-discovery/" + str(RECIPE_REVISION)
LIVE_EDITOR_URL = "https://ldraw.loftwah.com/"
ORANGE, INK, WHITE = "#FC5B05", "#17181B", "#FFFFFF"


def digest(data):
    return sha256(data).hexdigest()


def inspect_capture(path):
    data = path.read_bytes()
    with Image.open(BytesIO(data)) as source:
        if source.format != "PNG" or getattr(source, "n_frames", 1) != 1:
            raise ValueError("Use the original, single-frame PNG browser capture.")
        image = source.convert("RGBA")
        if image.getchannel("A").getextrema() != (255, 255):
            raise ValueError("A workspace capture must be opaque, not a cutout.")
    return data, image, {
        "sha256": digest(data),
        "pixelSha256": digest(image.tobytes()),
        "pixelHashDefinition": "SHA-256 of decoded row-major RGBA8 bytes; dimensions recorded separately",
        "width": image.width,
        "height": image.height,
        "format": "PNG",
    }


def font(size, weight=600):
    face = ImageFont.truetype(str(FONT), size)
    face.set_variation_by_axes([weight])
    return face


def contain(image, width, height):
    scale = min(width / image.width, height / image.height)
    return image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )


def wordmark_tile(label, size=96, padding=8):
    """An optical tile: the app's own name, no invented symbol.

    A full editor viewport reduced to 40px reads as a blank white square in the
    shared launcher. This keeps the plain LDraw wordmark legible at that size
    without inventing an identity the independent app does not have.
    """
    tile = Image.new("RGB", (size, size), ORANGE)
    draw = ImageDraw.Draw(tile)
    face = font(size)
    for points in range(size, 7, -1):
        candidate = font(points)
        box = draw.textbbox((0, 0), label, font=candidate)
        if box[2] - box[0] <= size - padding * 2 and box[3] - box[1] <= size - padding * 2:
            face = candidate
            break
    box = draw.textbbox((0, 0), label, font=face)
    draw.text(
        ((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1]),
        label,
        font=face,
        fill=WHITE,
    )
    return tile


def encode(image, kind):
    output = BytesIO()
    if kind == "WEBP":
        image.save(output, format=kind, lossless=True, method=6)
    else:
        image.save(output, format=kind)
    return output.getvalue()


def image_record(data, role, transformation):
    with Image.open(BytesIO(data)) as image:
        return {
            "sha256": digest(data),
            "pixelSha256": digest(image.convert("RGBA").tobytes()),
            "width": image.width,
            "height": image.height,
            "format": image.format,
            "role": role,
            "transformation": transformation,
        }


def validate_release(args, capture):
    if not re.fullmatch(r"[a-f0-9]{40}", args.source):
        raise ValueError("--source must be the exact 40-character released Git SHA.")
    if not re.fullmatch(r"[a-f0-9]{64}", args.sha256) or args.sha256 != capture["sha256"]:
        raise ValueError("The supplied capture SHA-256 does not match the original PNG.")
    if args.pixel_sha256 and args.pixel_sha256 != capture["pixelSha256"]:
        raise ValueError("The supplied decoded-pixel SHA-256 does not match.")
    if args.url != LIVE_EDITOR_URL:
        raise ValueError("--url must be exactly " + LIVE_EDITOR_URL)
    captured = datetime.fromisoformat(args.captured_at.replace("Z", "+00:00"))
    if captured.tzinfo is None or captured.utcoffset() is None:
        raise ValueError("--captured-at requires an ISO timestamp with its time zone.")
    if not args.qualification.strip() or len(args.qualification) > 1000:
        raise ValueError("Supply a bounded reference to the actual release/capture qualification.")
    if capture["width"] < 1440 or capture["height"] < 600:
        raise ValueError("Supply a desktop workspace capture at least 1440px wide and 600px high; previews never upscale.")
    if not 1.2 <= capture["width"] / capture["height"] <= 2.4:
        raise ValueError("Supply the workspace viewport, not a portrait crop or long full-page capture.")


def write_immutable(files):
    # Preserve all earlier published bytes, including same-source recaptures.
    for parent in (ROOT / "public", ROOT / "public/brand", OUTPUT):
        if parent.is_symlink():
            raise ValueError("Refusing a linked asset output directory.")
    for name, data in files.items():
        destination = OUTPUT / name
        if destination.is_symlink() or (destination.exists() and destination.read_bytes() != data):
            raise ValueError("Immutable asset already differs: " + name + "; choose a new recipe revision.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    created = []
    try:
        for name, data in files.items():
            destination = OUTPUT / name
            if destination.exists():
                continue
            with destination.open("xb") as output:
                created.append(destination)
                output.write(data)
    except BaseException:
        for destination in created:
            destination.unlink()
        raise


def render(args):
    original, rgba, capture = inspect_capture(args.capture)
    validate_release(args, capture)
    screenshot = rgba.convert("RGB")
    suffix = args.source[:12] + "-" + capture["sha256"][:8] + "-r" + str(RECIPE_REVISION)
    files, records = {}, {}

    def add(name, data, role, transformation):
        files[name] = data
        records[name] = image_record(data, role, transformation)

    capture_name = "ldraw-capture-" + suffix + ".png"
    add(capture_name, original, "Original supplied live editor capture", "None; original PNG bytes preserved exactly")
    for width in (960, 1440):
        resized = screenshot.resize(
            (width, round(screenshot.height * width / screenshot.width)),
            Image.Resampling.LANCZOS,
        )
        add("ldraw-workspace-" + suffix + "-" + str(width) + ".webp",
            encode(resized, "WEBP"), "Workspace screenshot preview",
            "Full original viewport, proportional Lanczos resize only; lossless WebP; no crop, overlay or invented UI")

    add("ldraw-tile-" + suffix + "-96.webp", encode(wordmark_tile("LDraw"), "WEBP"),
        "Composer discovery wordmark tile using LDraw's own name",
        "Flat canonical-orange field with the LDraw name set in the reviewed Space Grotesk face; no symbol, no invented LDraw logo and nothing copied from the workspace capture")

    share = Image.new("RGB", (1200, 630), ORANGE)
    draw = ImageDraw.Draw(share)
    draw.text((40, 217), "LDraw", font=font(84), fill=WHITE)
    frame = (350, 40, 810, 506)
    draw.rectangle((frame[0] - 1, frame[1] - 1, 1161, 547), fill=INK)
    placed = contain(screenshot, frame[2], frame[3])
    location = (frame[0] + (frame[2] - placed.width) // 2,
                frame[1] + (frame[3] - placed.height) // 2)
    share.paste(placed, location)
    draw.line((40, 566, 1160, 566), fill=INK, width=1)
    with Image.open(MARK) as source:
        mark = source.convert("RGBA").resize((36, 36), Image.Resampling.LANCZOS)
    share.paste(mark, (40, 580), mark)
    draw.text((88, 582), "App Composer", font=font(23, 500), fill=INK)
    draw.text((350, 584), "composer.loftwah.com/apps", font=font(21, 500), fill=INK)
    share_name = "ldraw-share-" + suffix + ".png"
    add(share_name, encode(share, "PNG"), "Composed discovery sharing image, not a new product capture",
        {"capture": capture_name, "crop": None, "resizedCaptureRectangle": [*location, placed.width, placed.height],
         "frame": "Flat Composer editorial frame; plain LDraw text title; Composer mark only labels its return destination"})

    provenance = {
        "version": 1,
        "recipe": RECIPE,
        "compositor": {"path": "scripts/ldraw-discovery-assets.py", "sha256": digest(Path(__file__).read_bytes()), "pillow": pillow_version},
        "capture": {**capture, "preservedAs": capture_name, "url": args.url, "capturedAt": args.captured_at,
                    "releasedSource": args.source, "qualificationReference": args.qualification},
        "identity": {"ldraw": "Plain text wordmark; the 96px discovery tile sets that name in the reviewed font on the canonical Composer orange and is not an invented LDraw logo",
                     "composerMark": {"path": str(MARK.relative_to(ROOT)), "sha256": digest(MARK.read_bytes()), "role": "App Composer return destination only"},
                     "font": {"path": str(FONT.relative_to(ROOT)), "sha256": digest(FONT.read_bytes()), "family": "Space Grotesk", "license": "src/assets/fonts/OFL-Space-Grotesk.txt"}},
        "evidenceBoundary": "Supplied capture and release reference are operator inputs. This compositor checks their bytes, preserves the original, and derives only resizes/framing. It performs no browser/source/deployment verification and establishes no owner approval.",
        "assets": records,
    }
    files["ldraw-provenance-" + suffix + ".json"] = (json.dumps(provenance, indent=2) + "\n").encode()
    write_immutable(files)
    print(json.dumps({"recipe": RECIPE, "files": list(files), "capture": capture}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    inspect = commands.add_parser("inspect", help="Print original file/pixel hashes without writing assets")
    inspect.add_argument("capture", type=Path)
    build = commands.add_parser("render", help="Render only from a supplied qualified live capture")
    build.add_argument("--capture", required=True, type=Path)
    build.add_argument("--sha256", required=True, help="Expected original PNG file hash")
    build.add_argument("--pixel-sha256", help="Optional expected decoded RGBA8 pixel hash")
    build.add_argument("--source", required=True, help="Exact released 40-character Git SHA")
    build.add_argument("--url", required=True, help="Exactly " + LIVE_EDITOR_URL)
    build.add_argument("--captured-at", required=True, help="Original capture ISO timestamp with time zone")
    build.add_argument("--qualification", required=True, help="Reference to the existing live/source qualification")
    args = parser.parse_args()
    try:
        if args.command == "inspect":
            print(json.dumps(inspect_capture(args.capture)[2], indent=2))
        else:
            render(args)
    except (ValueError, OSError) as error:
        parser.exit(2, str(error) + "\n")


if __name__ == "__main__":
    main()
