import identity from '../../lib/build.json';
export function GET(){return new Response(JSON.stringify(identity),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
