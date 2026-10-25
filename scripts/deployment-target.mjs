import {mkdirSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
export function assertFreshPushedMain(sha, remoteRef) {
 if(!/^[a-f0-9]{40}$/.test(sha)||typeof remoteRef!=='string'||remoteRef.trim()!==`${sha}\trefs/heads/main`)throw Error('Remote main changed or could not be verified. Reconstruct the current release before any remote mutation.');
}
export function assertProductionEnvironment(environment) {
 if(environment.CLOUDFLARE_ENV) throw Error('Production deployment refuses a selected Cloudflare environment.');
}
export function compositionServices(lock) {
 const services=lock.apps.map(app=>({binding:app.id.toUpperCase(),service:'composer-'+app.id+'-'+lock.id.slice(0,16)}));
 if(lock.apps.find(app=>app.id==='guestbook')?.manifest?.memberService){
  services.push({binding:'GUESTBOOK_MEMBERS',service:'composer-guestbook-'+lock.id.slice(0,16),entrypoint:'GuestbookMemberService'});
 }
 return services;
}
export function assertProductionTarget(config,generated,lock) {
 if(config.name!=='app-composer' || config.vars?.PUBLIC_ORIGIN!=='https://composer.loftwah.com' || generated.name!==config.name || generated.account_id!==config.account_id || generated.vars?.PUBLIC_ORIGIN!==config.vars.PUBLIC_ORIGIN) throw Error('Generated deployment does not match the selected production identity.');
 for(const app of lock.apps){const expected='composer-'+app.id+'-'+lock.id.slice(0,16);for(const value of [config,generated]){const bindings=value.services?.filter(binding=>binding.binding===app.id.toUpperCase());if(bindings?.length!==1 || bindings[0].service!==expected)throw Error('Deployment service differs from the reviewed composition.');}}
 const expected=compositionServices(lock);
 for(const value of [config,generated]){
  if(value.services?.length!==expected.length || expected.some(service=>!value.services.some(actual=>actual.binding===service.binding&&actual.service===service.service&&actual.entrypoint===service.entrypoint)))throw Error('Unexpected generated app service connection.');
 }
}
export function parseAdminSecrets(bytes) {
 let secrets;try{secrets=JSON.parse(bytes);}catch{throw Error('Invalid private mini-app connection file.');}
 if(!secrets || Array.isArray(secrets) || typeof secrets!=='object')throw Error('Invalid private mini-app connection file.');
 const keys=Object.keys(secrets).sort();
 const ownerKeys=['GUESTBOOK_OWNER_TOKEN','SHOWCASE_OWNER_TOKEN'];
 const memberKeys=[...ownerKeys,'GUESTBOOK_MEMBER_TOKEN','COMPOSER_PROFILE_BRIDGE_TOKEN'].sort();
 if(![JSON.stringify(ownerKeys),JSON.stringify(memberKeys)].includes(JSON.stringify(keys)) || keys.some(key=>typeof secrets[key]!=='string'||!secrets[key]||secrets[key].length>4096||/[\r\n]/.test(secrets[key]))) throw Error('Use only the selected mini-app owner connections and the paired member connections.');
 if(keys.length===4&&new Set(keys.map(key=>secrets[key])).size!==4)throw Error('Member and owner connections must use separate credentials.');
 return JSON.stringify(secrets);
}
export function snapshotAdminSecrets(validated,workspace) {
 const privateRoot=join(workspace,'.private');mkdirSync(privateRoot,{recursive:true,mode:0o700});
 const directory=mkdtempSync(join(privateRoot,'admin-deploy-')),path=join(directory,'secrets.json');
 writeFileSync(path,validated,{flag:'wx',mode:0o600});
 return {path,remove(){unlinkSync(path);rmdirSync(directory);}};
}
