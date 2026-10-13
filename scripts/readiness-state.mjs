export function githubRepository(remote) {
 const match=/^(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote);
 if(!match)throw new Error('Use an authenticated GitHub repository remote without embedded credentials.');
 return match[1];
}
export function referenceTarget(origin,repo) {
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.'))throw new Error('Choose an HTTPS origin without a path, query or credentials.');
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('Choose the GitHub owner/repository for this Hello reference.');
 return {origin:url.origin,repo};
}
export function finishReadiness(state,now=new Date()) {
 const checks=Object.values(state.checks);
 const verified=checks.length===4&&checks.every(check=>check.state==='verified');
 return {...state,state:verified?'verified':'action_required',updatedAt:now.toISOString(),expiresAt:verified?new Date(now.getTime()+3600000).toISOString():null};
}
