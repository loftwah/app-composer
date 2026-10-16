import {inspectReadiness} from '../lib/get-ready/inspect.mjs';
export {githubRepository,referenceTarget,finishReadiness} from '../lib/get-ready/state.mjs';
export function requireVerifiedReadiness(receipt,context,now=Date.now()) {
 const expiry=Date.parse(receipt?.expiresAt);
 const r=receipt?.context;
 // Private receipt bytes are input; malformed inspector data still needs recovery.
 let current=false;
 try{current=inspectReadiness(receipt,now).ready;}catch{}
 const valid=receipt?.version===2&&receipt.recipe==='codex-github-cloudflare-hello-v2'&&receipt.state==='verified'&&Number.isFinite(expiry)&&expiry>now
  &&r?.workspace===context.workspace&&r.repo===context.repo&&r.source===context.source&&r.account===context.account&&r.dirty===false&&context.dirty===false
  &&context.repo==='loftwah/app-composer'&&r.target?.origin==='https://ready.loftwah.com'&&r.target.repo==='loftwah/app-composer-hello'&&r.worker==='composer-hello'
  &&current
  &&receipt.checks.github.evidence?.source===context.source&&receipt.checks.cloudflare.evidence?.account===context.account&&receipt.checks.https.evidence?.account===context.account;
 if(!valid)throw new Error('Readiness is missing, failed, cancelled, stale, unfinished or scoped to another workspace/account/source. Run pnpm ready in this clean Composer checkout before --apply.');
}
