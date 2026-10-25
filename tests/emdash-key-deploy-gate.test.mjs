// Run the actual clean-main guard with inert local tools/provider responses.
// Build/package checks are fixture stubs; release ordering, private-file input,
// empty-store refusal, upload redaction and snapshot cleanup remain real.
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { compositionServices } from "../scripts/deployment-target.mjs";
const source = fileURLToPath(new URL("..", import.meta.url));
const synthetic = "emdash_enc_v1_" + Buffer.alloc(32, 13).toString("base64url");
function fixture(t, nonempty = false) {
  const root = mkdtempSync(join(tmpdir(), "composer-key-deploy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  mkdirSync(bin);
  for (const entry of [
    "scripts",
    "lib",
    "src",
    "wrangler.jsonc",
    "composition.lock.json",
  ])
    cpSync(join(source, entry), join(root, entry), { recursive: true });
  const lock = JSON.parse(
      readFileSync(join(root, "composition.lock.json"), "utf8"),
    ),
    config = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8"));
  config.services = compositionServices(lock);
  writeFileSync(join(root, "wrangler.jsonc"), JSON.stringify(config));
  const env = {
    PATH: bin + ":" + process.env.PATH,
    HOME: root,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    CLOUDFLARE_API_TOKEN: "fictional-provider-token",
  };
  const git = (args) =>
    execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  git(["init", "-b", "main"]);
  git([
    "add",
    "scripts",
    "lib",
    "src",
    "wrangler.jsonc",
    "composition.lock.json",
  ]);
  git([
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "Fictional release",
  ]);
  const remote = join(root, ".git/fixture.git");
  git(["init", "--bare", remote]);
  git(["remote", "add", "origin", remote]);
  git(["push", "--quiet", "origin", "main"]);
  writeFileSync(
    join(root, ".git/info/exclude"),
    "bin/\n.private/\npublic/\n.wrangler/\ndist/\nupload-keys.json\n",
  );
  mkdirSync(join(root, ".private"), { mode: 0o700 });
  writeFileSync(
    join(root, ".private/emdash-encryption-secrets.json"),
    JSON.stringify({ EMDASH_ENCRYPTION_KEY: synthetic }),
    { mode: 0o600 },
  );
  const preloader = `import{registerHooks}from'node:module';
 registerHooks({resolve(specifier,context,next){
  if(specifier==='./package-get-ready.mjs')return{url:'data:text/javascript,export const assertReleasePackage=()=>{}',shortCircuit:true};
  if(specifier==='./package-get-ready-mcp.mjs')return{url:'data:text/javascript,export const assertMcpReleasePackage=()=>{}',shortCircuit:true};
  if(specifier==='../lib/usage/schema.mjs')return{url:'data:text/javascript,export const assertReceiptCounterSchema=()=>{}',shortCircuit:true};
  return next(specifier,context);
 }});
 globalThis.fetch=async(url,init)=>{if(!String(url).startsWith('https://api.cloudflare.com/client/v4/accounts/'))throw Error('Unexpected provider');const sql=JSON.parse(init.body).sql;if(!sql.startsWith('SELECT'))throw Error('No mutation allowed');
 let row=sql.includes('FROM options')?{plugin_option_rows:${nonempty ? 1 : 0},plugin_settings_rows:${nonempty ? 1 : 0},encrypted_envelopes:0}:sql.includes('FROM _plugin_storage')?{plugin_storage_rows:0}:sql.includes('FROM _plugin_state')?{plugin_state_rows:4,nonempty_state_rows:0}:{sql:'fixture'};
 return new Response(JSON.stringify({success:true,result:[{success:true,results:[row]}]}),{headers:{'Content-Type':'application/json'}});};`;
  writeFileSync(join(bin, "preload.mjs"), preloader);
  const tool = `#!/usr/bin/env node
 import{readFileSync,writeFileSync,mkdirSync,statSync}from'node:fs';import{join}from'node:path';
 const args=process.argv.slice(2);console.log('fixture command '+args.slice(0,3).join(' '));
 if(args[0]==='build'){
  mkdirSync('public/downloads',{recursive:true});for(const name of ['get-ready-core','get-ready-mcp']){writeFileSync('public/downloads/'+name+'.json','{}');writeFileSync('public/downloads/'+name+'.tgz','fixture');}
  mkdirSync('.wrangler/deploy',{recursive:true});mkdirSync('dist/server',{recursive:true});writeFileSync('.wrangler/deploy/config.json',JSON.stringify({configPath:'../../dist/server/wrangler.json'}));writeFileSync('dist/server/wrangler.json',readFileSync('wrangler.jsonc'));
 }
 if(args[0]==='wrangler'&&args[1]==='deploy'){
  const file=args[args.indexOf('--secrets-file')+1];if((statSync(file).mode&511)!==384)throw Error('Snapshot permissions');const secrets=JSON.parse(readFileSync(file,'utf8'));writeFileSync('upload-keys.json',JSON.stringify(Object.keys(secrets).sort()));console.log(secrets.EMDASH_ENCRYPTION_KEY);console.error(secrets.EMDASH_ENCRYPTION_KEY);process.exit(2);
 }`;
  writeFileSync(join(bin, "pnpm"), tool, { mode: 0o700 });
  const deploy = (args = ["--emdash-key"]) =>
    execFileSync(
      process.execPath,
      ["--import", join(bin, "preload.mjs"), "scripts/deploy.mjs", ...args],
      { cwd: root, env, encoding: "utf8", stdio: "pipe", timeout: 15000 },
    );
  return { root, deploy };
}
test("a store populated during local checks refuses the actual key-bearing upload", (t) => {
  const f = fixture(t, true);
  assert.throws(
    () => f.deploy(),
    (error) => {
      assert.match(
        String(error.stderr),
        /must be confirmed empty immediately before upload/,
      );
      assert.doesNotMatch(
        String(error.stdout),
        /Worker upload|fixture command wrangler deploy/,
      );
      assert.equal(String(error.stderr).includes(synthetic), false);
      return true;
    },
  );
  assert.deepEqual(readdirSync(join(f.root, ".private")), [
    "emdash-encryption-secrets.json",
  ]);
});
test("accepted empty-store upload adds only the key, suppresses private tool failures and cleans snapshot", (t) => {
  const f = fixture(t);
  assert.throws(
    () => f.deploy(),
    (error) => {
      assert.match(
        String(error.stderr),
        /secret-bearing Worker upload could not be confirmed/,
      );
      assert.equal(String(error.stdout).includes(synthetic), false);
      assert.equal(String(error.stderr).includes(synthetic), false);
      return true;
    },
  );
  assert.deepEqual(
    JSON.parse(readFileSync(join(f.root, "upload-keys.json"), "utf8")),
    ["EMDASH_ENCRYPTION_KEY"],
  );
  assert.deepEqual(readdirSync(join(f.root, ".private")), [
    "emdash-encryption-secrets.json",
  ]);
});
test("explicit combined flags keep existing mini-app keys and add only the native encryption key", (t) => {
  const f = fixture(t);
  writeFileSync(
    join(f.root, ".private/miniapp-admin-secrets.json"),
    JSON.stringify({
      GUESTBOOK_OWNER_TOKEN: "fictional-guest",
      SHOWCASE_OWNER_TOKEN: "fictional-showcase",
    }),
    { mode: 0o600 },
  );
  assert.throws(() => f.deploy(["--miniapp-secrets", "--emdash-key"]));
  assert.deepEqual(
    JSON.parse(readFileSync(join(f.root, "upload-keys.json"), "utf8")),
    ["EMDASH_ENCRYPTION_KEY", "GUESTBOOK_OWNER_TOKEN", "SHOWCASE_OWNER_TOKEN"],
  );
});
