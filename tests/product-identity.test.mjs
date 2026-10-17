import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const exists=path=>existsSync(new URL(path,root));
function walk(dir,out=[]){
 for(const entry of readdirSync(new URL(dir,root),{withFileTypes:true})){const path=dir+entry.name;if(entry.isDirectory())walk(path+'/',out);else out.push(path);}
 return out;
}
const textSources=[...walk('src/'),...walk('config/')].filter(path=>/\.(astro|ts|mjs|css|json|html)$/.test(path));

test('the product homepage is the front door for every instance',()=>{
 assert.match(read('src/pages/index.astro'),/ProductHome/);
 // The regression this suite prevents: instance.json replacing the product home.
 assert.doesNotMatch(read('src/pages/index.astro'),/InstanceHome|instance\.enabled/);
 assert.equal(exists('src/components/InstanceHome.astro'),false);
 const home=read('src/components/ProductHome.astro');
 assert.match(home,/Make software\./);
 assert.match(home,/App Composer is an agent-operated studio/);
 assert.match(home,/Installed in this instance/);
 assert.match(home,/ownerInstance\.profile/);
});

test('owner configuration adds one instance note, never a second product identity',()=>{
 const instance=JSON.parse(read('config/instance.json'));
 assert.deepEqual(Object.keys(instance).sort(),['description','enabled','name','owner','profile']);
 assert.equal(instance.enabled,true);
 assert.equal(instance.profile,'/showcase/');
 for(const source of textSources)assert.doesNotMatch(read(source),/instance-share-v1|InstanceHome/,'Personal homepage drift returned in '+source);
 for(const path of ['public/brand/instance-share-v1.jpg','config/instance-share-template.html','public/brand/creators'])assert.equal(exists(path),false,path+' is the retired personal-profile homepage');
});

test('the homepage and default sharing use the product artwork',()=>{
 const base=read('src/layouts/Base.astro');
 assert.match(base,/share-composer-20261018\.jpg/);
 assert.doesNotMatch(base,/instance-share/);
 for(const path of ['public/brand/share-composer-20261018.jpg','public/brand/share-composer-20261018.webp','public/brand/share-composer-20261018-600.webp'])assert.equal(exists(path),true,path+' must exist');
});

test('the app library describes each app, not the owner',()=>{
 const line=read('src/lib/apps.ts').split('\n').find(entry=>entry.includes("id:'showcase'"));
 assert.ok(line,'the Linkarooie library entry exists');
 assert.match(line,/description:'Arrange your links and approved Here \/ there photos into a page\.'/);
 assert.match(line,/name:'Linkarooie'/);
 assert.match(line,/image:'\/brand\/apps\/linkarooie-art-20261018-480\.webp'/);
 assert.doesNotMatch(line,/Loftwah|creators\//);
 assert.equal(exists('public/brand/apps/linkarooie-art-20261018-480.webp'),true);
 const profile=JSON.parse(read('docs/creator-stacks/loftwah-public-profile.json'));
 const card=profile.cards.find(item=>item.reference==='composer');
 assert.equal(card.description,'Build apps with your agent: design the spec, prepare the environment and connect independent mini-apps.');
 assert.doesNotMatch(card.description,/workspace behind/);
});

test('reviewed client guards stay in place',()=>{
 const explorer=read('src/lib/explorer-client.ts');
 assert.match(explorer,/initDraftReplacePrompt/,'Use in Init must ask before replacing an existing draft');
 assert.match(explorer,/data-focus-key/,'Explorer re-renders must restore keyboard focus');
 assert.match(explorer,/saveStatus\.refused\(\)/,'Blocked local storage must be explained, not thrown');
 assert.match(read('src/lib/explorer-status.mjs'),/blockedStorageNotice/,'the blocked-storage notice keeps its own standing copy');
 const model=read('src/lib/content-model-client.ts');
 assert.match(model,/data-model-import[\s\S]*if\(pending&&!confirm\(/,'Importing a model must confirm before replacing open work');
 const review=read('src/pages/review.astro');
 assert.match(review,/<textarea id="review-prompt"/,'The manual copy fallback must be selectable');
 assert.match(review,/details\.open=true/,'The clipboard fallback must open the prompt disclosure');
 for(const path of ['src/pages/catalogue.astro','src/pages/catalogue/[slug].astro']){
  assert.match(read(path),/Astro\.response\.status=503/,path+' must keep the failure status');
  assert.doesNotMatch(read(path),/return new Response\('(Published catalogue is unavailable|This mini-app is temporarily unavailable)/,path+' must render a full page, not bare text');
 }
 assert.match(read('src/pages/init.astro'),/href="#draft-preview"/);
 assert.match(read('src/pages/init/content.astro'),/href="#model-export"/);
});
