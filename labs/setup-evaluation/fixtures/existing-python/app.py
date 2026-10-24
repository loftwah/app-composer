"""Fictional, dependency-free external-project fixture. Bind localhost only."""
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import urlsplit


def load_site():
    value = json.loads(Path(__file__).with_name("site.json").read_text())
    if set(value) != {"title", "welcome"}:
        raise ValueError("Keep the two documented site fields")
    if any(not isinstance(item, str) or not item.strip() or len(item) > 240 for item in value.values()):
        raise ValueError("Site fields must be nonempty bounded text")
    return value


def render_page(site):
    return ("<!doctype html><html lang=en><meta charset=utf-8>"
            "<meta name=viewport content='width=device-width,initial-scale=1'>"
            f"<title>{escape(site['title'])}</title><h1>{escape(site['title'])}</h1>"
            f"<p>{escape(site['welcome'])}</p><p>Fictional local evaluation fixture.</p></html>")


class Page(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            body, content_type, status = b'{"status":"ready"}', "application/json", 200
        elif path == "/":
            body, content_type, status = render_page(load_site()).encode(), "text/html; charset=utf-8", 200
        else:
            body, content_type, status = b"Page not found", "text/plain", 404
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Page)
    print("Fictional site: http://127.0.0.1:8765", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
