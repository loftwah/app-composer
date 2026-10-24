"""Editable one-page source. Run with Python 3 + reportlab; writes beside this file."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont('Space', str(root / 'fonts/SpaceGrotesk.ttf')))
c = canvas.Canvas(str(root / 'operating-cheatsheet.pdf'), pagesize=(595.28, 841.89), invariant=1)
c.setTitle('App Composer - Operating cheatsheet')
c.setAuthor('App Composer')
orange, ink, ivory = '#FC5B05', '#17181B', '#FAF9F7'
c.setFillColor(HexColor(ivory)); c.rect(0, 0, 596, 842, fill=1, stroke=0)
c.setFillColor(HexColor(orange)); c.rect(0, 641, 596, 201, fill=1, stroke=0)
c.drawImage(str(root / 'composer-mark.png'), 493, 757, width=64, height=64, mask='auto')
c.setFillColor(HexColor(ink)); c.setFont('Helvetica-Bold', 11)
c.drawString(38, 800, 'APP COMPOSER / OPERATING KIT 01')
c.setFont('Space', 39); c.drawString(36, 739, 'Make it work.')
c.drawString(36, 692, 'Prove it. Keep it.')
c.setFont('Helvetica', 11); c.drawString(38, 661, 'A desk-side guide for the project you already have.')
sections = [
 ('01', 'Inspect before changing', 'Read trusted project guidance. Confirm source, account, environment and authority. Reproduce the affected journey. Preserve unrelated work.'),
 ('02', 'Make one useful change', 'Use existing modules and commands. Check real input plus a negative case. Keep content, permissions and saved drafts intact.'),
 ('03', 'A failed check stops release', 'Inspect, validate, review, publish, verify. Bind the reviewed source to the actual target. Inspect the real journey after publication.'),
 ('04', 'An incident starts with evidence', 'Separate observations from hypotheses. Investigation grants no response authority. Apply only an authorised bounded response; check recovery independently.'),
 ('05', 'A hook receives data, not orders', 'Authenticate using the actual provider protocol. Validate schema and scope. Persist identity, deduplicate and bound retries. Reconcile uncertain effects before repetition.'),
 ('06', 'Leave a useful continuation', 'Record source, target, commands, result, interventions and next action. A copy or download is not a successful operation. Code rollback is not data recovery.'),
]
y = 607
for number, title, body in sections:
    c.setStrokeColor(HexColor('#B9BEC5')); c.line(38, y + 14, 557, y + 14)
    c.setFillColor(HexColor('#C74400')); c.setFont('Helvetica-Bold', 12); c.drawString(38, y - 3, number)
    c.setFillColor(HexColor(ink)); c.setFont('Helvetica-Bold', 14); c.drawString(76, y - 3, title)
    c.setFont('Helvetica', 10.5)
    for line in simpleSplit(body, 'Helvetica', 10.5, 478):
        y -= 14; c.drawString(76, y - 7, line)
    y -= 43
c.setFillColor(HexColor(ink)); c.setFont('Helvetica-Bold', 10)
c.drawString(38, 59, 'composer.loftwah.com/resources')
c.setFont('Helvetica', 9); c.drawString(38, 42, 'Edition 1 / 2026/10/24 / Fictional local examples. Adapt before production.')
c.save()
