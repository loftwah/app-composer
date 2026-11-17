#!/bin/sh
# Start one disposable, explicitly owned local composition for the build story.
# It copies the two independent repositories, uses local D1/R2 emulation and
# leaves the working repositories, owner state and browser sessions untouched.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
. "$SCRIPT_DIR/local-ports.sh"
if ! select_building_ports; then
  exit 1
fi
GUESTBOOK_SOURCE=${GUESTBOOK_SOURCE:-"$ROOT/../app-composer-guestbook"}
SHOWCASE_SOURCE=${SHOWCASE_SOURCE:-"$ROOT/../app-composer-showcase"}
TMPDIR=${TMPDIR:-/tmp}
TMPDIR=${TMPDIR%/}
TOKEN=${OWNER_TOKEN:-build-199-fictional-owner}
POINTER="$ROOT/output/build-199/local-root"
if [ -f "$POINTER" ] && [ -d "$(cat "$POINTER")" ]; then
  echo "This checkout already has a local composition. Stop it or use a separate checkout." >&2
  exit 1
fi

port_is_listening() {
  command -v lsof >/dev/null 2>&1 || return 1
  [ -n "$(lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true)" ]
}
for port in "$GUESTBOOK_PORT" "$LINKAROOIE_PORT"; do
  if port_is_listening "$port"; then
    echo "Port $port is already listening on this machine." >&2
    echo "Nothing was started and no other process was touched. Choose two free loopback ports, for example:" >&2
    echo "  GUESTBOOK_PORT=9788 LINKAROOIE_PORT=9787 labs/building/start-local.sh" >&2
    exit 1
  fi
done

TMPROOT=$(mktemp -d "$TMPDIR/composer-build-199.XXXXXX")
READY=0
export WRANGLER_REGISTRY_PATH="$TMPROOT/registry"
export TMPDIR="$TMPROOT"
cleanup() {
  if [ "$READY" -eq 0 ]; then
    for name in guestbook showcase; do
      pidfile="$TMPROOT/$name.pid"
      [ -f "$pidfile" ] || continue
      pid=$(cat "$pidfile")
      if owns_building_process "$pid" "$TMPROOT"; then kill_building_tree "$pid"; fi
    done
    sleep 1
    for port in "$GUESTBOOK_PORT" "$LINKAROOIE_PORT"; do
      for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
        parent=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')
        if ps -p "${parent:-0}" -o command= 2>/dev/null | grep -Fq "$TMPROOT"; then
          kill_building_tree "$parent"
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
mkdir -p "$ROOT/output/build-199" "$TMPROOT/guestbook" "$TMPROOT/showcase" "$WRANGLER_REGISTRY_PATH"
printf '%s\n' "$TMPROOT" > "$POINTER"

copy_repo() {
  source=$1 dest=$2
  rsync -a --exclude node_modules --exclude .wrangler --exclude .git "$source/" "$dest/"
  ln -s "$source/node_modules" "$dest/node_modules"
}
copy_repo "$GUESTBOOK_SOURCE" "$TMPROOT/guestbook-repo"
copy_repo "$SHOWCASE_SOURCE" "$TMPROOT/showcase-repo"

node - "$TMPROOT" "$GUESTBOOK_SOURCE" "$SHOWCASE_SOURCE" "$TOKEN" "$GUESTBOOK_PORT" "$LINKAROOIE_PORT" <<'NODE'
const fs = require("fs"), path = require("path"), cp = require("child_process");
const [root, guestbookSource, showcaseSource, token, guestbookPort, linkarooiePort] = process.argv.slice(2);
for (const [dir, source, name, port] of [
  ["guestbook-repo", guestbookSource, "composer-guestbook", guestbookPort],
  ["showcase-repo", showcaseSource, "composer-showcase", linkarooiePort],
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
    config.vars.PROVIDER_ORIGIN = `https://localhost:${guestbookPort}`;
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
spawn_detached "$TMPROOT/guestbook-repo" "$TMPROOT/guestbook-dev.log" pnpm exec wrangler dev --config wrangler.local.jsonc --port "$GUESTBOOK_PORT" --inspector-port 0 --local-protocol https --persist-to "$TMPROOT/guestbook" > "$TMPROOT/guestbook.pid"
spawn_detached "$TMPROOT/showcase-repo" "$TMPROOT/showcase-dev.log" pnpm exec wrangler dev --config wrangler.local.jsonc --port "$LINKAROOIE_PORT" --inspector-port 0 --local-protocol https --persist-to "$TMPROOT/showcase" > "$TMPROOT/showcase.pid"

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
wait_for "https://localhost:$GUESTBOOK_PORT/build.json"
wait_for "https://localhost:$LINKAROOIE_PORT/build.json"

cat > "$TMPROOT/run.env" <<EOF
TMPROOT=$TMPROOT
GUESTBOOK_PORT=$GUESTBOOK_PORT
LINKAROOIE_PORT=$LINKAROOIE_PORT
GUESTBOOK_URL=https://localhost:$GUESTBOOK_PORT
LINKAROOIE_URL=https://localhost:$LINKAROOIE_PORT
OWNER_TOKEN=$TOKEN
RESOURCE_ID=${RESOURCE_ID:-build199-trail-8}
EOF
echo "Local composition ready."
echo "  Guestbook:  https://localhost:$GUESTBOOK_PORT"
echo "  Linkarooie: https://localhost:$LINKAROOIE_PORT"
echo "  Root:       $TMPROOT"
echo "  Exact URLs: $TMPROOT/run.env"
READY=1
echo "  Stop with:  labs/building/stop-local.sh"
