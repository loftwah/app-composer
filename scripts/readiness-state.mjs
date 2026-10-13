export function githubRepository(remote) {
 const match=/^(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote);
 if(!match)throw new Error('Use an authenticated GitHub repository remote without embedded credentials.');
 return match[1];
}
export function referenceTarget(origin,repo) {
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.'))throw new Error('Choose an HTTPS origin without a path, query or credentials.');
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('Choose the GitHub owner/repository for this Hello reference.');
 return {origin:url.origin,repo};
}
export function finishReadiness(state,now=new Date()) {
 const checks=Object.values(state.checks);
 const verified=checks.length===4&&['agent','github','cloudflare','https'].every(id=>state.checks[id]?.state==='verified');
 return {...state,state:verified?'verified':checks.some(check=>check.state==='failed')?'failed':'action_required',updatedAt:now.toISOString(),expiresAt:verified?new Date(now.getTime()+3600000).toISOString():null};
}

export function requireVerifiedReadiness(receipt,context,now=Date.now()) {
 const expiry=Date.parse(receipt?.expiresAt);
 const r=receipt?.context;
 const valid=receipt?.version===2&&receipt.recipe==='codex-github-cloudflare-hello-v2'&&receipt.state==='verified'&&Number.isFinite(expiry)&&expiry>now
  &&r?.workspace===context.workspace&&r.repo===context.repo&&r.source===context.source&&r.account===context.account&&r.dirty===false&&context.dirty===false
  &&context.repo==='loftwah/app-composer'&&r.target?.origin==='https://ready.loftwah.com'&&r.target.repo==='loftwah/app-composer-hello'&&r.worker==='composer-hello'
  &&['agent','github','cloudflare','https'].every(id=>receipt.checks?.[id]?.state==='verified')
  &&receipt.checks.github.evidence?.source===context.source&&receipt.checks.cloudflare.evidence?.account===context.account&&receipt.checks.https.evidence?.account===context.account;
 if(!valid)throw new Error('Readiness is missing, failed, cancelled, expired or scoped to another workspace/account/source. Run pnpm ready in this clean Composer checkout before --apply.');
}
