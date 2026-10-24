"""Rebuild public kit artwork with Python 3, Pillow and ReportLab.
No network. Source mark and Space font remain the approved repository assets.
"""
from pathlib import Path
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

repo = Path(__file__).resolve().parents[2]
out = repo / 'public/resources/v1'
(out / 'fonts').mkdir(exist_ok=True)
shutil.copyfile(repo / 'src/assets/fonts/SpaceGrotesk.ttf.bin', out / 'fonts/SpaceGrotesk.ttf')
shutil.copyfile(repo / 'src/assets/fonts/OFL-Space-Grotesk.txt', out / 'fonts/OFL.txt')
shutil.copyfile(repo / 'public/brand/composer-icon-20261022b-512.png', out / 'composer-mark.png')
subprocess.run([sys.executable, str(out / 'operating-cheatsheet.py')], check=True)

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
