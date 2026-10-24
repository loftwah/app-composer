"""Rebuild public kit artwork with existing local Python/Pillow/PDF tools.

Use --share-variants to rebuild only the four dated change/incident square and
portrait PNGs, their portable source and provenance. That mode leaves existing
artwork, PDF and diagrams untouched and needs only the already-installed Pillow.
No network or install. Source mark and Space font remain approved repo assets.
"""
import argparse
from hashlib import sha256
import inspect
import json
from pathlib import Path
from pprint import pformat
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont, __version__ as pillow_version

repo = Path(__file__).resolve().parents[2]
out = repo / 'public/resources/v1'

def font(size):
    face = ImageFont.truetype(str(out / 'fonts/SpaceGrotesk.ttf'), size)
    face.set_variation_by_axes([550])
    return face

def poster(name, size, title, subtitle, destination):
    w, h = size
    image = Image.new('RGB', size, '#FC5B05')
    d = ImageDraw.Draw(image)
    margin = int(w * .055)
    mark_size = int(w * .12)
    mark = Image.open(out / 'composer-mark.png').convert('RGBA').resize((mark_size, mark_size), Image.Resampling.LANCZOS)
    image.paste(mark, (w - margin - mark_size, margin - 8), mark)
    d.text((margin, margin + 10), 'APP COMPOSER / OPERATING KIT 01', font=font(int(w * .022)), fill='#17181B')
    line_y = int(h * (.30 if w > h else .24))
    d.line((margin, line_y, w-margin, line_y), fill='#17181B', width=2)
    title_size = int(w * (.080 if w <= h else .067))
    y = int(h * (.36 if w > h else .30))
    for line in title:
        d.text((margin, y), line, font=font(title_size), fill='#FFFFFF')
        y += int(title_size * 1.16)
    y += int(h * .045)
    for line in subtitle:
        d.text((margin, y), line, font=font(int(w * .030)), fill='#17181B')
        y += int(w * .043)
    d.line((margin, h - int(h * .14), w-margin, h - int(h * .14)), fill='#17181B', width=2)
    d.text((margin, h - int(h * .10)), destination, font=font(int(w * .025)), fill='#17181B')
    image.save(out / name)


def legacy_assets():
    (out / 'fonts').mkdir(exist_ok=True)
    shutil.copyfile(repo / 'src/assets/fonts/SpaceGrotesk.ttf.bin', out / 'fonts/SpaceGrotesk.ttf')
    shutil.copyfile(repo / 'src/assets/fonts/OFL-Space-Grotesk.txt', out / 'fonts/OFL.txt')
    shutil.copyfile(repo / 'public/brand/composer-icon-20261022b-512.png', out / 'composer-mark.png')
    subprocess.run([sys.executable, str(out / 'operating-cheatsheet.py')], check=True)

    poster('resources-og.png', (1200, 630), ['Make a change.', 'Take the working files.'], ['Runbooks. Diagrams. A kit worth keeping.'], 'composer.loftwah.com/resources')
    poster('change-og.png', (1200, 630), ['A useful change.', 'Proof that it works.'], ['Inspect → change → verify → continue'], 'composer.loftwah.com/resources?resource=change')
    poster('incident-og.png', (1200, 630), ['Find the failure.', 'Check the recovery.'], ['A bounded incident runbook + synthetic exercise'], 'composer.loftwah.com/resources?resource=incident')
    poster('resources-square.png', (1080, 1080), ['Make it work.', 'Prove it.', 'Keep it.'], ['Complete runbooks.', 'Editable diagrams.', 'Runnable local examples.'], 'composer.loftwah.com/resources')
    poster('resources-portrait.png', (1080, 1350), ['The next change.', 'The next incident.', 'A better handover.'], ['Take a portable operating kit', 'into the project you already have.'], 'composer.loftwah.com/resources')

    diagrams = {
     'change-release': ('A change with evidence', ['Inspect source', 'Validate change', 'Review revision', 'Publish + verify'], 'A failed check stops publication. Reconcile uncertain effects before retry.'),
     'incident-response': ('An incident with boundaries', ['Observe impact', 'Test hypothesis', 'Check authority', 'Respond + verify'], 'Read-only investigation grants no response authority. Independently check recovery.'),
     'hook-flow': ('An event is data', ['Authenticate', 'Validate scope', 'Claim identity', 'Act + record'], 'Reject invalid input. Preserve completed steps. Reconcile uncertain completion.'),
    }
    for name, (title, stages, note) in diagrams.items():
        mmd = 'flowchart LR\n' + '\n'.join(f'  S{i}["{stage}"]' for i, stage in enumerate(stages)) + '\n  S0 --> S1 --> S2 --> S3\n'
        (out / f'{name}.mmd').write_text(mmd)
        shapes = []
        for i, stage in enumerate(stages):
            x = 35 + i * 238
            shapes.append(f'<rect x="{x}" y="105" width="210" height="90" fill="#fff" stroke="#17181b"/><text x="{x+105}" y="157" text-anchor="middle" font-size="19">{stage.replace("&", "&amp;")}</text>')
            if i < 3:
                shapes.append(f'<path d="M{x+213} 150h20l-7-7m7 7-7 7" fill="none" stroke="#17181b" stroke-width="2"/>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="280" viewBox="0 0 1000 280"><rect width="1000" height="280" fill="#faf9f7"/><g font-family="sans-serif" fill="#17181b"><text x="35" y="57" font-size="30">{title}</text>{"".join(shapes)}<text x="35" y="243" font-size="16">{note}</text></g></svg>\n'
        (out / f'{name}.svg').write_text(svg)

    # A composed preview of the real generated PDF, not a product screenshot.
    with __import__('tempfile').TemporaryDirectory(prefix='composer-resource-art-') as temporary:
        rendered = Path(temporary) / 'sheet'
        subprocess.run(['pdftoppm', '-scale-to', '850', '-png', '-singlefile', str(out / 'operating-cheatsheet.pdf'), str(rendered)], check=True)
        sheet = Image.open(str(rendered) + '.png').convert('RGB')
        preview = Image.new('RGB', (900, 640), '#FC5B05')
        sheet.thumbnail((355, 510), Image.Resampling.LANCZOS)
        preview.paste(sheet, (490, 62))
        d = ImageDraw.Draw(preview)
        for y, text in [(90, 'THE'), (154, 'OPERATING'), (218, 'KIT.')]:
            d.text((42, y), text, font=font(54), fill='white')
        d.line((42, 328, 425, 328), fill='#17181b', width=2)
        for y, text in [(357, '01  Change & release'), (399, '02  Incident response'), (441, '03  Pipelines & hooks'), (514, 'Actual printable sheet →')]:
            d.text((42, y), text, font=font(23), fill='#17181b')
        preview.save(out / 'kit-preview.png')
    print('Built operating PDF, editable diagrams, five share layouts and actual-PDF kit preview.')


SHARE_VARIANTS = [
    {'resource': 'change', 'name': 'change-square-20261024.png', 'size': (1080, 1080),
     'title': ['Make a', 'change.'],
     'steps': ['Inspect the current journey.', 'Make the change. Run the checks.', 'Review, release and verify.'],
     'canonical': 'https://composer.loftwah.com/resources/change'},
    {'resource': 'change', 'name': 'change-portrait-20261024.png', 'size': (1080, 1350),
     'title': ['Make a', 'change.'],
     'steps': ['Inspect the current journey.', 'Make the smallest complete change.', 'Test the result and a negative case.', 'Review, release and verify.'],
     'canonical': 'https://composer.loftwah.com/resources/change'},
    {'resource': 'incident', 'name': 'incident-square-20261024.png', 'size': (1080, 1080),
     'title': ['Handle an', 'incident.'],
     'steps': ['Reproduce the failure.', 'Apply an authorised response.', 'Check recovery independently.'],
     'canonical': 'https://composer.loftwah.com/resources/incident'},
    {'resource': 'incident', 'name': 'incident-portrait-20261024.png', 'size': (1080, 1350),
     'title': ['Handle an', 'incident.'],
     'steps': ['Preserve the evidence.', 'Test the leading hypothesis.', 'Apply an authorised response.', 'Check recovery independently.'],
     'canonical': 'https://composer.loftwah.com/resources/incident'},
]


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


def share_variants():
    def digest(path):
        return sha256(path.read_bytes()).hexdigest()

    # Existing kit copies must still be the approved source bytes.
    assert digest(out / 'fonts/SpaceGrotesk.ttf') == digest(repo / 'src/assets/fonts/SpaceGrotesk.ttf.bin')
    assert digest(out / 'composer-mark.png') == digest(repo / 'public/brand/composer-icon-20261022b-512.png')
    for plan in SHARE_VARIANTS:
        runbook_poster(plan)
    # The kit retains reproducible source, without requiring the Composer repo.
    portable = out / 'share-artwork-20261024.py'
    portable.write_text(
        '\n'.join([
            '"""Generated from scripts/resources/assets.py; edit that maintained author.',
            'Python 3.9+ with Pillow. Rebuilds four composed share images beside this file.',
            'No browser, network, installation or live/independent trial is performed.',
            'Author SHA-256: ' + digest(Path(__file__)),
            '"""',
            'from pathlib import Path',
            'from PIL import Image, ImageDraw, ImageFont',
            "out = Path(__file__).resolve().parent", '',
            inspect.getsource(font), inspect.getsource(runbook_poster),
            'SHARE_VARIANTS = ' + pformat(SHARE_VARIANTS, width=96, sort_dicts=False), '',
            "if __name__ == '__main__':",
            '    for plan in SHARE_VARIANTS:',
            '        runbook_poster(plan)', '',
        ])
    )
    provenance = {
        'version': 'composer.resource-share-art/1',
        'kind': 'Composed typographic artwork; no product screenshots or new identity',
        'renderer': {'path': 'scripts/resources/assets.py', 'sha256': digest(Path(__file__)), 'pillow': pillow_version},
        'portableSource': {'path': portable.name, 'sha256': digest(portable)},
        'font': {'path': 'fonts/SpaceGrotesk.ttf', 'sha256': digest(out / 'fonts/SpaceGrotesk.ttf'), 'family': 'Space Grotesk', 'weight': 550},
        'mark': {'path': 'composer-mark.png', 'sha256': digest(out / 'composer-mark.png'), 'identity': 'Existing approved App Composer merging-block mark'},
        'assets': [
            {'path': plan['name'], 'width': plan['size'][0], 'height': plan['size'][1],
             'sha256': digest(out / plan['name']), 'canonical': plan['canonical'],
             'source': {'path': plan['resource'] + '.md', 'sha256': digest(out / (plan['resource'] + '.md'))},
             'title': plan['title'], 'steps': plan['steps'],
             'transformation': 'Format-specific text reflow with the same approved mark, Space font and canonical orange; no landscape crop'}
            for plan in SHARE_VARIANTS
        ],
        'scope': 'Composition and deterministic byte checks only. No new independent kit trial, live platform preview or owner approval is established.',
    }
    (out / 'share-artwork-20261024.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print('Built four change/incident square+portrait PNGs, portable source and provenance.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--share-variants', action='store_true', help='Rebuild only the new share variants; preserve all earlier asset bytes')
    args = parser.parse_args()
    if not args.share_variants:
        legacy_assets()
    share_variants()
