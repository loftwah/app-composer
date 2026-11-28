"""Render the three unpublished Composer campaign comps from owned source art."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "src/data/decision-art"
ORANGE = "#FC5B05"
INK = "#111111"
WHITE = "#FFFFFF"
FONT = PUBLIC / "resources/v1/fonts/SpaceGrotesk.ttf"


def text(draw, x, y, value, size, color, weight=700):
    font = ImageFont.truetype(str(FONT), size)
    font.set_variation_by_axes([weight])
    draw.text((x, y), value, font=font, fill=color, anchor="lt")


def label(canvas, x, y, color):
    mark = Image.open(PUBLIC / "brand/composer-icon-20261022b-192.png").convert("RGBA")
    mark = mark.resize((38, 38), Image.Resampling.LANCZOS)
    canvas.paste(mark, (x, y), mark)
    text(ImageDraw.Draw(canvas), x + 46, y + 9, "App Composer", 23, color)


def photo(canvas, path, bounds, *, crop=None, centre=(0.5, 0.5)):
    image = Image.open(PUBLIC / path).convert("RGB")
    if crop:
        image = image.crop(crop)
    left, top, right, bottom = bounds
    canvas.paste(ImageOps.fit(image, (right - left, bottom - top), centering=centre), (left, top))


def save(canvas, filename):
    canvas.save(OUTPUT / f"{filename}.jpg", quality=91, optimize=True, subsampling=0)


def press_run():
    canvas = Image.new("RGB", (1200, 630), ORANGE)
    draw = ImageDraw.Draw(canvas)
    photo(canvas, "brand/campaign/build-it-keep-it-running-1728-20261128.webp",
          (650, 0, 1200, 630), crop=(953, 0, 1728, 910), centre=(0.57, 0.52))
    label(canvas, 43, 38, INK)
    draw.line((44, 112, 605, 112), fill=INK, width=2)
    text(draw, 41, 167, "Make it.", 111, INK)
    text(draw, 39, 277, "Keep it.", 111, INK)
    draw.line((44, 499, 605, 499), fill=INK, width=2)
    text(draw, 44, 536, "Build an app you own.", 32, INK)
    save(canvas, "press")


def signal_test():
    cyan = "#52F5FF"
    canvas = Image.new("RGB", (1200, 630), INK)
    draw = ImageDraw.Draw(canvas)
    label(canvas, 43, 33, WHITE)
    draw.line((44, 100, 1156, 100), fill=cyan, width=2)
    photo(canvas, "media-studio/low-tide-teaser-art-20261128.webp",
          (490, 125, 1156, 548))
    text(draw, 44, 153, "What did", 59, WHITE)
    text(draw, 44, 225, "you make", 59, WHITE)
    text(draw, 44, 297, "with it?", 74, cyan)
    text(draw, 44, 447, "LOW TIDE", 25, cyan)
    text(draw, 44, 483, "From Media Studio’s 30-second film", 22, WHITE, 500)
    draw.line((44, 569, 1156, 569), fill=cyan, width=2)
    text(draw, 44, 585, "See the film and how it was made", 21, WHITE, 500)
    save(canvas, "signal")


def app_parts():
    acid = "#E5FF37"
    canvas = Image.new("RGB", (1200, 630), WHITE)
    draw = ImageDraw.Draw(canvas)
    label(canvas, 43, 35, INK)
    draw.line((43, 102, 1157, 102), fill=INK, width=2)
    text(draw, 40, 132, "It’s your app.", 121, INK)
    panels = [
        (43, ORANGE, "Build", "Start with a real job."),
        (421, acid, "Connect", "Bring your tools."),
        (799, INK, "Run", "Keep it working."),
    ]
    for left, fill, title, caption in panels:
        color = WHITE if fill == INK else INK
        draw.rectangle((left, 302, left + 357, 528), fill=fill)
        draw.line((left + 23, 375, left + 330, 375), fill=color, width=2)
        text(draw, left + 22, 401, title, 51, color)
        text(draw, left + 22, 480, caption, 23, color, 500)
    text(draw, 43, 565, "composer.loftwah.com", 26, INK)
    save(canvas, "parts")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    press_run()
    signal_test()
    app_parts()
