"""Check the reviewed phrases on the directory's official source pages."""
import concurrent.futures
import html.parser
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

records = json.loads((pathlib.Path(__file__).resolve().parents[1] /
                      "src/editorial/opportunities/opportunities.json").read_text())
allowed_hosts = {
    urllib.parse.urlparse(record["source"]).hostname.removeprefix("www.")
    for record in records
}


class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlparse(newurl)
        if target.scheme != "https" or (target.hostname or "").removeprefix("www.") not in allowed_hosts:
            raise ValueError("redirected outside the reviewed sources")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class VisibleText(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.ignore = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.ignore = tag

    def handle_endtag(self, tag):
        if tag == self.ignore:
            self.ignore = None

    def handle_data(self, data):
        if not self.ignore:
            self.parts.append(data)


def normalise(value):
    return re.sub(r"\s+", " ", value.lower()).strip()


def check(record):
    try:
        request = urllib.request.Request(record["source"], headers={
            "User-Agent": "ComposerOpportunityReview/1.0 (+https://composer.loftwah.com/opportunities)"
        })
        with urllib.request.build_opener(Redirects()).open(request, timeout=8) as response:
            payload = response.read(4_000_001)
            if len(payload) > 4_000_000:
                raise ValueError("response exceeds review size limit")
            parser = VisibleText()
            parser.feed(payload.decode(response.headers.get_content_charset() or "utf-8", errors="replace"))
        text = normalise(" ".join(parser.parts))
        missing = [marker for marker in record["sourceMarkers"] if normalise(marker) not in text]
        return {"id": record["id"], "state": "review-change" if missing else "markers-present", "missing": missing}
    except (OSError, ValueError, LookupError) as error:
        return {"id": record["id"], "state": "unavailable", "reason": str(error)}


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check, records))
    print(json.dumps(results, ensure_ascii=False, indent=2))
    sys.exit(int(any(row["state"] != "markers-present" for row in results)))
