# Search Console owner verification

Reviewed 17 November 2026. Follow [Job 5](owner-actions-20261107.md#job-5--show-google-search-console-that-you-own-the-site-15-minutes-free) for the intended **Domain** property `composer.loftwah.com` and the matching API property `sc-domain:composer.loftwah.com`.

In the Cloudflare `loftwah.com` zone, add the TXT value Google gives you at the exact host specified in verification. For `composer.loftwah.com`, enter **composer** as Name. The zone apex **@** is `loftwah.com`. Check the property selector and DNS zone before saving. [Google DNS ownership verification](https://support.google.com/webmasters/answer/9008080) · [Cloudflare DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)

Property verification, property permissions and OAuth scopes are separate. A property owner grants the approved identity **Restricted user**, which can view Performance reports. Search Analytics accepts `https://www.googleapis.com/auth/webmasters.readonly`. Start there and have the owner review the API response before considering any additional access. Live property access and a successful API result are still unverified. [Search Console permissions](https://support.google.com/webmasters/answer/7687615) · [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

## Optional local credential handling

The planned [native EmDash connection](seo-pilot.md) owns credential handling. Composer currently reads neither a local file path nor literal JSON from `GSC_SERVICE_ACCOUNT_JSON`. There is no key or environment setup to perform in Composer today.

If a separately approved local check calls for a service-account file, select the exact file and the identity you verified in Google. This example checks the selected bytes and copies those same bytes into a private directory. It leaves the original and existing destination untouched.

```sh
SEARCH_CONSOLE_KEY="$HOME/Downloads/<exact downloaded filename>.json"
SEARCH_CONSOLE_EMAIL="<approved service account email>"
SEARCH_CONSOLE_STORE="$HOME/.config/app-composer/search-console"

python3 - "$SEARCH_CONSOLE_KEY" "$SEARCH_CONSOLE_EMAIL" "$SEARCH_CONSOLE_STORE" <<'PY'
import json
import os
import stat
import sys
from pathlib import Path

source, expected_email, destination = sys.argv[1:]
try:
    data = Path(source).read_bytes()
    record = json.loads(data)
except (OSError, ValueError):
    raise SystemExit("Choose a readable service-account JSON file.")

if (
    not isinstance(record, dict)
    or record.get("type") != "service_account"
    or record.get("client_email") != expected_email
    or not isinstance(record.get("private_key"), str)
    or not record["private_key"].strip()
):
    raise SystemExit("The selected file does not match the approved identity.")

folder = Path(destination)
folder.mkdir(mode=0o700, parents=True, exist_ok=True)
if folder.is_symlink() or stat.S_IMODE(folder.stat().st_mode) != 0o700:
    raise SystemExit("Choose a private destination directory with mode 0700.")

try:
    fd = os.open(folder / "reader.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except OSError:
    raise SystemExit("Could not create the file. Any existing destination was preserved.")
with os.fdopen(fd, "wb") as output:
    output.write(data)
print("Saved the verified file with mode 0600.")
PY
```

Keep both credential files outside Git, issue comments, screenshots and logs. Revoke an obsolete or exposed key in Google Cloud IAM. Removing a local copy alone leaves the Google key active. [Google service-account key management](https://cloud.google.com/iam/docs/keys-create-delete)
