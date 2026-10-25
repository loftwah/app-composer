#!/usr/bin/env python3
"""Fictional Field Notes: a tiny standard-library HTTP app used only by the
fresh-agent evaluation. History and notes are invented; nothing here is real
customer data and no external service is contacted."""
import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
MAX_PATH = 200


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def note_index(notes):
    return {note["id"]: note for note in notes}


def render_home(site, notes):
    pinned = note_index(notes).get(site.get("pinned"))
    items = "".join(
        f'<li><a href="/note/{note["id"]}">{note["title"]}</a></li>' for note in notes
    )
    pinned_html = (
        f'<p class="pinned" data-note="{pinned["id"]}">{pinned["body"]}</p>'
        if pinned
        else "<p class=\"pinned\">No note pinned.</p>"
    )
    return f"""<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{site["title"]}</title>
<style>:root{{--accent:{site["accent"]}}}a{{color:var(--accent)}}</style>
</head>
<body style="font:16px/1.6 system-ui;margin:2rem auto;max-width:38rem;padding:0 1rem">
<h1>Field notes</h1>
<p class="owner">Kept by {site["owner"]}</p>
{pinned_html}
<ul>{items}</ul>
<footer>Fictional fixture. No external service is contacted.</footer>
</body>
</html>
"""


def render_note(note):
    return f"""<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><title>{note["title"]}</title></head>
<body><h1>{note["title"]}</h1><p>{note["body"]}</p><p><a href="/">All notes</a></p></body></html>
"""


class Handler(BaseHTTPRequestHandler):
    server_version = "FieldNotes/1.0"
    site = None
    notes = None

    def log_message(self, fmt, *args):  # keep the fixture output quiet
        pass

    def send_html(self, status, body):
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if len(path) > MAX_PATH:
            self.send_html(414, "<h1>Path too long</h1>")
            return
        if path == "/":
            self.send_html(200, render_home(self.site, self.notes))
            return
        if path == "/health":
            self.send_html(200, "<h1>ok</h1>")
            return
        if path.startswith("/note/"):
            note = note_index(self.notes).get(path.removeprefix("/note/"))
            if note:
                self.send_html(200, render_note(note))
                return
        self.send_html(404, "<h1>No note here</h1><p><a href=\"/\">All notes</a></p>")


def serve(host="127.0.0.1", port=0):
    Handler.site = load("site.json")
    Handler.notes = load("notes.json")
    httpd = ThreadingHTTPServer((host, port), Handler)
    return httpd


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run the fictional Field Notes fixture locally.")
    parser.add_argument("--port", type=int, default=0, help="Port to bind; 0 selects an unused port.")
    args = parser.parse_args(argv)
    httpd = serve(port=args.port)
    host, port = httpd.server_address[:2]
    print(f"Field Notes on http://{host}:{port}/ (Ctrl+C to stop)", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
