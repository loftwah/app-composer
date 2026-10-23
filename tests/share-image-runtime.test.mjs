import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

for (const first of ["stack", "report"])
  test(`shared resvg initialization supports ${first}-first and concurrent image producers`, () => {
    // A fresh Node isolate gives the actual WASM singleton a clean lifecycle for
    // each order; the original two per-producer initializers throw on this path.
    const script = `
    import {initWasm, Resvg} from '@resvg/resvg-wasm';
    import {readFileSync} from 'node:fs';
    import {shareImageReady} from './src/lib/share-image-ready.ts';
    import assert from 'node:assert/strict';
    let calls=0;
    const initialize=()=>{calls++;return initWasm(readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'));};
    const produce=async(label)=>{await shareImageReady(initialize); const r=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#fc5b05"/></svg>'); const image=r.render();assert.ok(image.asPng().length>0);image.free();r.free();return label;};
    assert.deepEqual(await Promise.all([produce('${first}'),produce('${first === "stack" ? "report" : "stack"}')]),['${first}','${first === "stack" ? "report" : "stack"}']);
    await produce('report-again'); await produce('stack-again'); assert.equal(calls,1);
  `;
    execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  });
