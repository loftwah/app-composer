const hosts = ['composer.loftwah.com','guestbook.loftwah.com','showcase.loftwah.com','ready.loftwah.com','ai.loftwah.com','share.loftwah.com'];
const text=(value,max)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b-\u001f]/.test(value))throw new Error('Invalid report text.');return value;};
export function validateInspectionReport(value){
 if(!value||value.contract!==1||value.kind!=='page-inspection')throw new Error('Choose a version 1 Link Check page-inspection report.');
 const url=new URL(text(value.url,2048));if(url.protocol!=='https:'||!hosts.includes(url.hostname)||url.username||url.password||url.port||url.search||url.hash||/[\u0000-\u0020\\%]/.test(value.url)||/\/(?:_emdash|api|admin|studio|owner|private)(?:\/|$)/i.test(url.pathname))throw new Error('The report must describe a supported public app hostname and public path.');
 const checkedAt=text(value.checkedAt,40);if(!Number.isFinite(Date.parse(checkedAt)))throw new Error('The report needs a valid inspection date.');
 const sourceSha=text(value.sourceSha,40);if(!/^[a-f0-9]{40}$/.test(sourceSha))throw new Error('The report needs a complete source commit.');
 if(!Array.isArray(value.findings)||value.findings.length>80)throw new Error('Invalid report findings.');
 const findings=value.findings.map(item=>{if(!item||!['pass','fix','review'].includes(item.status))throw new Error('Invalid finding state.');return{status:item.status,label:text(item.label,160),detail:text(item.detail,4000)};});
 return{contract:1,kind:'page-inspection',url:url.href,sourceSha,checkedAt,title:text(value.title,4000),findings};
}
