#!/bin/sh
# Start one disposable, explicitly owned local composition for the build story.
# It copies the two independent repositories, uses local D1/R2 emulation and
# leaves the working repositories, owner state and browser sessions untouched.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
GUESTBOOK_SOURCE=${GUESTBOOK_SOURCE:-"$ROOT/../app-composer-guestbook"}
SHOWCASE_SOURCE=${SHOWCASE_SOURCE:-"$ROOT/../app-composer-showcase"}
TMPDIR=${TMPDIR:-/tmp}
TMPDIR=${TMPDIR%/}
TMPROOT=$(mktemp -d "$TMPDIR/composer-build-199.XXXXXX")
TOKEN=${OWNER_TOKEN:-build-199-fictional-owner}
POINTER="$ROOT/output/build-199/local-root"
READY=0
kill_tree() {
  pid=$1
  [ -n "$pid" ] || return 0
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
cleanup() {
  if [ "$READY" -eq 0 ]; then
    for name in guestbook showcase; do
      pidfile="$TMPROOT/$name.pid"
      [ -f "$pidfile" ] || continue
      kill_tree "$(cat "$pidfile")"
    done
    sleep 1
    for port in 8787 8788; do
      for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
        parent=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
        if ps -p "${parent:-0}" -o command= 2>/dev/null | grep -Fq "$TMPROOT"; then
          kill_tree "$parent"
          kill -9 "$pid" 2>/dev/null || true
        fi
      done
    done
    for name in guestbook showcase; do
      [ -f "$TMPROOT/$name-dev.log" ] && cp "$TMPROOT/$name-dev.log" "$ROOT/output/build-199/failure-$name.log"
    done
    rm -rf "$TMPROOT"
  fi
}
trap cleanup EXIT INT TERM
mkdir -p "$ROOT/output/build-199" "$TMPROOT/guestbook" "$TMPROOT/showcase"
printf '%s\n' "$TMPROOT" > "$POINTER"

copy_repo() {
  source=$1 dest=$2
  rsync -a --exclude node_modules --exclude .wrangler --exclude .git "$source/" "$dest/"
  ln -s "$source/node_modules" "$dest/node_modules"
}
copy_repo "$GUESTBOOK_SOURCE" "$TMPROOT/guestbook-repo"
copy_repo "$SHOWCASE_SOURCE" "$TMPROOT/showcase-repo"

node - "$TMPROOT" "$GUESTBOOK_SOURCE" "$SHOWCASE_SOURCE" "$TOKEN" <<'NODE'
const fs = require("fs"), path = require("path"), cp = require("child_process");
const [root, guestbookSource, showcaseSource, token] = process.argv.slice(2);
for (const [dir, source, name, port] of [
  ["guestbook-repo", guestbookSource, "composer-guestbook", 8788],
  ["showcase-repo", showcaseSource, "composer-showcase", 8787],
]) {
  const base = path.join(root, dir);
  const sha = cp.execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(base, "app.manifest.json"), "utf8"));
  fs.writeFileSync(
    path.join(base, "local-entry.ts"),
    `import worker from './src/worker.ts';\nObject.assign(globalThis,{BUILD_SHA:${JSON.stringify(sha)},MANIFEST:${JSON.stringify(manifest)}});\nexport default worker;\n`,
  );
  const config = JSON.parse(fs.readFileSync(path.join(base, "wrangler.jsonc"), "utf8"));
  config.name = name;
  config.main = "./local-entry.ts";
  config.routes = [];
  config.workers_dev = true;
  config.preview_urls = false;
  delete config.triggers;
  config.vars = {
    ...(config.vars || {}),
    PUBLIC_ORIGIN: `https://localhost:${port}`,
    OWNER_API_TOKEN: token,
  };
  if (dir === "guestbook-repo") {
    config.vars.RESOURCE_ACCOUNT_ID = "build199account";
    config.vars.RESOURCE_ENVIRONMENT = "local";
    delete config.vars.OWNER_STUDIO_URL;
  } else {
    config.vars.PROVIDER_ORIGIN = "https://localhost:8788";
    config.vars.PROVIDER_ID = "guestbook";
    config.vars.PROVIDER_MOUNT = "/guestbook";
    delete config.vars.OWNER_STUDIO_URL;
    config.services = [{ binding: "ITEM_PROVIDER", service: "composer-guestbook" }];
  }
  fs.writeFileSync(path.join(base, "wrangler.local.jsonc"), JSON.stringify(config, null, 2));
}
NODE

(cd "$TMPROOT/guestbook-repo" && pnpm exec wrangler d1 migrations apply composer-guestbook --local --config wrangler.local.jsonc --persist-to "$TMPROOT/guestbook" >/dev/null)
(cd "$TMPROOT/showcase-repo" && pnpm exec wrangler d1 migrations apply composer-showcase --local --config wrangler.local.jsonc --persist-to "$TMPROOT/showcase" >/dev/null)

spawn_detached() {
  dir=$1 log=$2
  shift 2
  node - "$dir" "$log" "$@" <<'NODE'
const { spawn } = require("child_process"), fs = require("fs");
const [dir, log, ...args] = process.argv.slice(2);
const out = fs.openSync(log, "a");
const child = spawn(args[0], args.slice(1), { cwd: dir, detached: true, stdio: ["ignore", out, out] });
child.unref();
console.log(child.pid);
NODE
}
spawn_detached "$TMPROOT/guestbook-repo" "$TMPROOT/guestbook-dev.log" pnpm exec wrangler dev --config wrangler.local.jsonc --port 8788 --local-protocol https --persist-to "$TMPROOT/guestbook" > "$TMPROOT/guestbook.pid"
spawn_detached "$TMPROOT/showcase-repo" "$TMPROOT/showcase-dev.log" pnpm exec wrangler dev --config wrangler.local.jsonc --port 8787 --local-protocol https --persist-to "$TMPROOT/showcase" > "$TMPROOT/showcase.pid"

wait_for() {
  url=$1
  count=0
  until curl -ksS --max-time 2 "$url" >/dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -gt 40 ]; then
      echo "Local Worker did not become ready: $url" >&2
      echo "See $TMPROOT/guestbook-dev.log and $TMPROOT/showcase-dev.log" >&2
      exit 1
    fi
    sleep 1
  done
}
wait_for https://localhost:8788/build.json
wait_for https://localhost:8787/build.json

cat > "$TMPROOT/run.env" <<EOF
TMPROOT=$TMPROOT
GUESTBOOK_URL=https://localhost:8788
LINKAROOIE_URL=https://localhost:8787
OWNER_TOKEN=$TOKEN
RESOURCE_ID=${RESOURCE_ID:-build199-trail-8}
EOF
echo "Local composition ready."
echo "  Guestbook:  https://localhost:8788"
echo "  Linkarooie: https://localhost:8787"
echo "  Root:       $TMPROOT"
READY=1
echo "  Stop with:  labs/building/stop-local.sh"
