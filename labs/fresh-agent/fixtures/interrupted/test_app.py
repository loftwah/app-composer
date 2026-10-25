import json
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

import app

ROOT = Path(__file__).resolve().parent


class ResumeFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = app.serve(port=0)
        cls.origin = "http://127.0.0.1:%d" % cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)

    def get(self, path):
        with urlopen(self.origin + path, timeout=5) as response:
            return response.status, response.read().decode("utf-8")

    def test_home(self):
        status, body = self.get("/")
        self.assertEqual(200, status)
        self.assertIn("Fictional Field Notes", body)

    def test_note(self):
        status, body = self.get("/note/note-1")
        self.assertEqual(200, status)
        self.assertIn("Ridge line before rain", body)

    def test_missing_is_404(self):
        with self.assertRaises(HTTPError) as caught:
            self.get("/note/absent")
        self.assertEqual(404, caught.exception.code)

    def test_health(self):
        status, body = self.get("/health")
        self.assertEqual(200, status)
        self.assertIn("ok", body)

    def test_owner_note_intact(self):
        text = (ROOT / "owner-note.txt").read_text(encoding="utf-8")
        self.assertIn("do not edit", text)


if __name__ == "__main__":
    unittest.main()
