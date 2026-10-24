# A real local change made with this kit

A fresh agent used the production-downloaded change runbook on the supplied
fictional Python Field Notes fixture. It first observed `/about` returning 404,
added a failing regression, then implemented the page and return navigation.
Seven assertions passed; desktop keyboard and phone-viewport journeys passed,
including malformed `/about%00` returning 404. Original title/welcome, owner note
and unrelated work remained intact. The nonzero check prevented local patch
export; no production release was attempted.

`field-notes/` is the complete resulting local example. It has no external
dependencies. `field-notes-about.patch` is the actual reviewable two-file change;
`field-notes-provenance.json` pins its original fixture and exact hashes.
The two PNGs are actual browser captures of the fictional result, not generated
product screenshots or proof that this Python app is deployed.

Requires an already installed Python 3.10+ interpreter. Actual trial used
3.14.7. Check your interpreter first; the trial's default Python was too old.
From this `examples` directory, run:

```sh
python3 -m unittest discover -s field-notes -v
cd field-notes
python3 -u -c 'from app import Page, ThreadingHTTPServer; server=ThreadingHTTPServer(("127.0.0.1",0),Page); print("http://127.0.0.1:"+str(server.server_port),flush=True); server.serve_forever()'
```

Use a compatible installed interpreter in place of `python3` if needed. The
printed localhost URL uses an unused port, preserving other running services.
Open it, follow About and Return home, inspect a missing path, then stop only
this owned foreground service with Ctrl+C. The original fixed-port command in
the fixture README remains inspectable; the evaluation encountered its port
already occupied and preserved that unrelated service.

Work on a disposable copy when adapting the example. The included patch is
for review against the pinned original fixture, not a command to apply blindly
to an existing owner repository. Existing stacks, credentials and release rules
stay with your actual project. Local test/browser evidence is separate from
provider, production, physical-device and longitudinal acceptance.
