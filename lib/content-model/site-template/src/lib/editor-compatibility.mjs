import {definePlugin} from 'emdash';

// EmDash 1.2.0 submits an optional URL's cleared input as "" and rejects it.
// Keep native authentication, validation, revisions and publication in charge.
// Upstream fix: https://github.com/emdash-cms/emdash/pull/4076 . Recheck on upgrade.
export function createPlugin({collection,links,rows=[],adminEntry}={}){
 if(typeof collection!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(collection)||!Array.isArray(links)||links.length>12||new Set(links).size!==links.length||links.some(key=>typeof key!=='string'||!/^[a-z][a-z0-9_]{0,47}$/.test(key)))throw Error('Use the generated model’s selected optional-link fields.');
 if(!Array.isArray(rows)||rows.length>12||new Set(rows.map(row=>row?.key)).size!==rows.length||rows.some(row=>!row||Object.keys(row).some(key=>!['key','links'].includes(key))||typeof row.key!=='string'||!/^[a-z][a-z0-9_]{0,47}$/.test(row.key)||['__proto__','prototype','constructor'].includes(row.key)||!Array.isArray(row.links)||row.links.length>6||new Set(row.links).size!==row.links.length||row.links.some(key=>typeof key!=='string'||!/^[a-z][a-z0-9_]{0,47}$/.test(key)||['__proto__','prototype','constructor'].includes(key))))throw Error('Use only the generated model’s selected optional links inside repeating rows.');
 const selected=[...links],selectedRows=rows.map(row=>({key:row.key,links:[...row.links]}));
 return definePlugin({id:'composer-content-fields',version:'1.3.0',capabilities:['content:write'],admin:{entry:adminEntry,fieldWidgets:[{name:'integer',label:'Whole number',fieldTypes:['integer']},{name:'date',label:'Calendar date',fieldTypes:['string']}]},hooks:{
  'content:beforeSave':({collection:current,content})=>{
   if(current!==collection)return;
   let next=content;
   for(const key of selected)if(Object.hasOwn(content,key)&&content[key]===''){
    if(next===content)next={...content};
    next[key]=null;
   }
   for(const {key,links:fields} of selectedRows){
    if(!Object.hasOwn(content,key)||!Array.isArray(content[key]))continue;
    let changed=false;
    const rows=content[key].map(row=>{
     if(!row||typeof row!=='object'||Array.isArray(row))return row;
     let copy=row;
     for(const field of fields)if(Object.hasOwn(row,field)&&row[field]===''){if(copy===row)copy={...row};copy[field]=null;changed=true;}
     return copy;
    });
    if(changed){if(next===content)next={...content};next[key]=rows;}
   }
   return next;
  },
 }});
}
