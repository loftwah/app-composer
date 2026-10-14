import {definePlugin} from 'emdash';

// EmDash 1.2.0 submits an optional URL's cleared input as "" and rejects it.
// Keep native authentication, validation, revisions and publication in charge.
// Upstream fix: https://github.com/emdash-cms/emdash/pull/4076 . Recheck on upgrade.
export function createPlugin({collection,links}={}){
 if(typeof collection!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(collection)||!Array.isArray(links)||links.length>12||new Set(links).size!==links.length||links.some(key=>typeof key!=='string'||!/^[a-z][a-z0-9_]{0,47}$/.test(key)))throw Error('Use the generated model’s selected optional-link fields.');
 const selected=[...links];
 return definePlugin({id:'composer-content-fields',version:'1.0.0',capabilities:['content:write'],hooks:{
  'content:beforeSave':({collection:current,content})=>{
   if(current!==collection)return;
   let next=content;
   for(const key of selected)if(Object.hasOwn(content,key)&&content[key]===''){
    if(next===content)next={...content};
    next[key]=null;
   }
   return next;
  },
 }});
}
