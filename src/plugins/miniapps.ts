import {definePlugin} from 'emdash';
import {env} from 'cloudflare:workers';
import {manageMiniapps} from '../lib/miniapp-admin.mjs';
import lock from '../../composition.lock.json';
export function createPlugin(options:{adminEntry:string}) {
 const adminEntry=options.adminEntry;
 const pins=Object.fromEntries(lock.apps.map(app=>[app.id,app.commit]));
 return definePlugin({id:'composer-miniapps',version:'1.0.0',admin:{entry:adminEntry,pages:[{path:'/apps',label:'Manage mini-apps',icon:'squares-four'}]},routes:{
  read:{methods:['GET'],permission:'plugins:manage',handler:ctx=>manageMiniapps(ctx,env,pins)},
  write:{methods:['POST'],permission:'plugins:manage',request:{body:'json',maxBytes:1500000},handler:ctx=>manageMiniapps(ctx,env,pins)},
 }});
}
