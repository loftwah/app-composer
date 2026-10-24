"""Independent local HTTP assertions; these are not fresh-agent attempts."""
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen
from app import Page, load_site, render_page


class SiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Page)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def test_customised_title_is_the_served_title(self):
        with urlopen(self.base + "/", timeout=3) as response:
            page = response.read().decode()
            self.assertEqual(response.status, 200)
            self.assertIn("<h1>Fictional Field Notes</h1>", page)
            self.assertIn(load_site()["welcome"], page)

    def test_health_is_a_separate_observation(self):
        with urlopen(self.base + "/health", timeout=3) as response:
            self.assertEqual(json.loads(response.read()), {"status": "ready"})

    def test_unknown_routes_do_not_report_success(self):
        with self.assertRaises(HTTPError) as caught:
            urlopen(self.base + "/missing", timeout=3)
        self.assertEqual(caught.exception.code, 404)

    def test_user_text_stays_text(self):
        self.assertNotIn("<script>", render_page({"title": "<script>", "welcome": "& Fiction"}))
        self.assertIn("&lt;script&gt;", render_page({"title": "<script>", "welcome": "& Fiction"}))

    def test_owner_customisation_marker_is_present(self):
        self.assertEqual(Path(__file__).with_name("owner-note.txt").read_text(),
                         "Fictional owner customisation. Preserve these exact bytes.\n")


if __name__ == "__main__":
    unittest.main()
