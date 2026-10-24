"""Generated from scripts/resources/assets.py; edit that maintained author.
Python 3.9+ with Pillow. Rebuilds four composed share images beside this file.
No browser, network, installation or live/independent trial is performed.
Author SHA-256: 39e31550833bfad86ac0929edcb60419e5454f229a199df85f640aa34abb58ca
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
out = Path(__file__).resolve().parent

def font(size):
    face = ImageFont.truetype(str(out / 'fonts/SpaceGrotesk.ttf'), size)
    face.set_variation_by_axes([550])
    return face

def runbook_poster(plan):
    """Reflow the real runbook title and sequence for this format; never crop."""
    width, height = plan['size']
    portrait = height > width
    image = Image.new('RGB', plan['size'], '#FC5B05')
    draw = ImageDraw.Draw(image)
    margin = 60
    with Image.open(out / 'composer-mark.png') as original:
        mark = original.convert('RGBA').resize((112, 112), Image.Resampling.LANCZOS)
    image.paste(mark, (width - margin - 112, 52), mark)
    draw.text((margin, 82), 'APP COMPOSER / OPERATING KIT', font=font(26), fill='#17181B', anchor='lt')
    draw.line((margin, 208, width - margin, 208), fill='#17181B', width=2)
    title_size = 124 if portrait else 108
    y = 320 if portrait else 280
    for line in plan['title']:
        if draw.textbbox((0, 0), line, font=font(title_size))[2] > width - margin * 2:
            raise ValueError('Title exceeds the format: ' + plan['name'])
        draw.text((margin, y), line, font=font(title_size), fill='#FFFFFF', anchor='lt')
        y += 140 if portrait else 124
    size = 42 if portrait else 40
    y = 790 if portrait else 620
    for line in plan['steps']:
        if draw.textbbox((0, 0), line, font=font(size))[2] > width - margin * 2:
            raise ValueError('Runbook text exceeds the format: ' + plan['name'])
        draw.text((margin, y), line, font=font(size), fill='#17181B', anchor='lt')
        y += 64 if portrait else 60
    draw.line((margin, height - 155, width - margin, height - 155), fill='#17181B', width=2)
    destination = plan['canonical'].removeprefix('https://')
    draw.text((margin, height - 104), destination, font=font(26), fill='#17181B', anchor='lt')
    image.save(out / plan['name'])

SHARE_VARIANTS = [{'resource': 'change',
  'name': 'change-square-20261024.png',
  'size': (1080, 1080),
  'title': ['Make a', 'change.'],
  'steps': ['Inspect the current journey.',
            'Make the change. Run the checks.',
            'Review, release and verify.'],
  'canonical': 'https://composer.loftwah.com/resources/change'},
 {'resource': 'change',
  'name': 'change-portrait-20261024.png',
  'size': (1080, 1350),
  'title': ['Make a', 'change.'],
  'steps': ['Inspect the current journey.',
            'Make the smallest complete change.',
            'Test the result and a negative case.',
            'Review, release and verify.'],
  'canonical': 'https://composer.loftwah.com/resources/change'},
 {'resource': 'incident',
  'name': 'incident-square-20261024.png',
  'size': (1080, 1080),
  'title': ['Handle an', 'incident.'],
  'steps': ['Reproduce the failure.',
            'Apply an authorised response.',
            'Check recovery independently.'],
  'canonical': 'https://composer.loftwah.com/resources/incident'},
 {'resource': 'incident',
  'name': 'incident-portrait-20261024.png',
  'size': (1080, 1350),
  'title': ['Handle an', 'incident.'],
  'steps': ['Preserve the evidence.',
            'Test the leading hypothesis.',
            'Apply an authorised response.',
            'Check recovery independently.'],
  'canonical': 'https://composer.loftwah.com/resources/incident'}]

if __name__ == '__main__':
    for plan in SHARE_VARIANTS:
        runbook_poster(plan)
