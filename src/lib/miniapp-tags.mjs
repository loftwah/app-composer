// MIT. Bridge validation for the independently owned Linkarooie tag collection.
import{tagKeys,tagLimit,tagFields,exactTagObject}from'./miniapp-tag-fields.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export function tagCommand(value){
 const action=value?.action,keys=action==='create'||action==='edit'?['action','expectedRevision','item']:action==='visibility'?['action','expectedRevision','id','status']:action==='delete'?['action','expectedRevision','id']:action==='reorder'?['action','expectedRevision','ids']:[];
 if(!keys.length||!exactTagObject(value,keys)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||value.expectedRevision>2147483647)throw Error('Choose a supported tag action and revision.');
 const result={action,expectedRevision:value.expectedRevision};
 if(action==='create'){result.item=tagFields(value.item);if(result.item.status!=='draft')throw Error('Save a tag draft first.');}
 else if(action==='edit'){if(!exactTagObject(value.item,['id',...tagKeys])||!uuid(value.item.id))throw Error('Choose a current tag.');const{id,...fields}=value.item;result.item={id,...tagFields(fields)};}
 else if(action==='reorder'){if(!Array.isArray(value.ids)||value.ids.length>tagLimit||!value.ids.every(uuid)||new Set(value.ids).size!==value.ids.length)throw Error('Choose each tag once.');result.ids=[...value.ids];}
 else{if(!uuid(value.id))throw Error('Choose a current tag.');result.id=value.id;if(action==='visibility'){if(!['draft','published','hidden'].includes(value.status))throw Error('Choose a visibility.');result.status=value.status;}}
 return result;
}
