// A release precondition, separate from accepting an event or claiming adoption.
export function assertReceiptCounterSchema(sql){
 if(typeof sql!=='string')throw Error('Apply the reviewed postcard counter migration before release.');
 const normal=sql.replace(/\s+/g,' ').toLowerCase();
 if(!normal.includes("'postcard_received'")||!normal.includes("event != 'postcard_received' or app = 'guestbook'")||!normal.includes('n between 1 and 1000'))throw Error('Apply the reviewed postcard counter migration before release.');
 return true;
}
