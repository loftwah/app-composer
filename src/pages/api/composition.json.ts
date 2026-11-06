import {env} from 'cloudflare:workers';
export async function GET(){
 const db=env.DB as {prepare(sql:string):{all():Promise<{results:unknown[]}>}};
 // Sources and releases are independent reads; both feed one response.
 const [sources,releases]=await Promise.all([
  db.prepare('SELECT id,repository,commit_sha AS checked_commit,reviewed FROM composer_sources ORDER BY id').all(),
  db.prepare('SELECT id,state,manifest_json,created_at FROM composer_releases ORDER BY created_at DESC LIMIT 10').all(),
 ]);
 return new Response(JSON.stringify({contract:1,sources:sources.results,releases:releases.results}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
