import {definePlugin} from 'emdash';
import {env} from 'cloudflare:workers';
import {manageStacks} from '../lib/stacks-admin.mjs';
export function createPlugin(options:{adminEntry:string}) {
 const adminEntry=options.adminEntry;
 return definePlugin({id:'composer-stacks',version:'1.0.0',admin:{entry:adminEntry,pages:[{path:'/stacks',label:'Creator stacks',icon:'stack'}]},routes:{
  read:{methods:['GET'],permission:'plugins:manage',handler:ctx=>manageStacks(ctx,env)},
  write:{methods:['POST'],permission:'plugins:manage',request:{body:'json',maxBytes:120000},handler:ctx=>manageStacks(ctx,env)},
 }});
}
