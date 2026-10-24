# Fictional Field Notes

A small existing Python project used to assess a portable setup guide outside Composer. All content is fictional. It has no Astro, EmDash, Cloudflare, package manager or third-party dependency.

Requires Python 3.10 or newer. Check the selected interpreter before using it. No installation step is needed.

```sh
python3 -m unittest -v
python3 app.py
```

Open [the local site](http://127.0.0.1:8765), check its customised title and use Ctrl+C to stop the owned service. The health response alone does not prove the page works. Tests start and stop their own localhost service on an unused port.

`site.json` is the existing owner configuration. Preserve its title and welcome during setup. `owner-note.txt` is an unrelated owner customisation; preserve its exact bytes. Test fixtures must not become real records or production services. Follow-up changes should retain this behaviour and add a focused independent assertion for the new outcome.
