#!/usr/bin/env python3
"""Fictional Field Notes, interrupted-setup fixture. The previous agent added
the home route and stopped. `/health` does not exist yet."""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def render_home(site, notes):
    items = "".join(
        f'<li><a href="/note/{note["id"]}">{note["title"]}</a></li>' for note in notes
    )
    return f"""<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><title>{site["title"]}</title></head>
<body><h1>{site["title"]}</h1><ul>{items}</ul></body></html>
"""


class Handler(BaseHTTPRequestHandler):
    server_version = "FieldNotes/0.9"
    site = None
    notes = None

    def log_message(self, fmt, *args):
        pass

    def send_html(self, status, body):
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self.send_html(200, render_home(self.site, self.notes))
            return
        if path.startswith("/note/"):
            found = next((note for note in self.notes if note["id"] == path.removeprefix("/note/")), None)
            if found:
                self.send_html(200, f"<h1>{found['title']}</h1><p>{found['body']}</p>")
                return
        self.send_html(404, "<h1>No note here</h1>")


def serve(host="127.0.0.1", port=0):
    Handler.site = load("site.json")
    Handler.notes = load("notes.json")
    return ThreadingHTTPServer((host, port), Handler)


def main():
    httpd = serve()
    host, port = httpd.server_address[:2]
    print(f"Field Notes on http://{host}:{port}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
