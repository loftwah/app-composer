import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpec,handoff,explorerSpec,deliveryProfiles,deliveryRunners,deliveryCommands,independentDeliveryCommands} from '../src/lib/spec.mjs';
import {selectedSources} from '../src/lib/app-settings.mjs';
import {buildRecipe,humanOnlyActions} from '../src/lib/build-recipe.mjs';

const base=()=>({
 version:2,
 preset:'composition',
 sources:selectedSources(['guestbook','showcase']),
 config:{title:'A fictional corner',intro:'Only synthetic fixtures',theme:'daylight',layout:'grid'},
 privacy:'review-first',
 cards:[],
 deployment:{mode:'preview',hostname:''},
 decisions:{},
});

test('delivery defaults to the local profile and older specifications still validate',()=>{
 assert.deepEqual(validateSpec(base()).delivery,{profile:'local',runner:''});
 const legacy=validateSpec(base());
 assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(legacy))),legacy);
 assert.deepEqual(explorerSpec({goal:'composition',target:'preview',appearance:'daylight'}).delivery,{profile:'local',runner:''});
 assert.equal(deliveryProfiles.join(','),'local,existing-runner');
 assert.doesNotThrow(()=>validateSpec({...base(),delivery:{profile:'local'}}));
 assert.throws(()=>validateSpec({...base(),delivery:{profile:'existing-runner'}}),/existing runner/);
 for(const runner of deliveryRunners)assert.deepEqual(validateSpec({...base(),delivery:{profile:'existing-runner',runner}}).delivery,{profile:'existing-runner',runner});
});

test('unsupported delivery profiles, runners and fields are rejected',()=>{
 for(const delivery of [
  {profile:'github-actions'},
  {profile:''},
  {profile:'local',runner:'jenkins'},
  {profile:'existing-runner',runner:'github-actions'},
  {profile:'existing-runner',runner:''},
  {profile:'local',extra:'value'},
  'local',
  [],
 ]){
  assert.throws(()=>validateSpec({...base(),delivery}),/delivery|runner|profile/i,JSON.stringify(delivery));
 }
});

test('the agent handoff carries the runnable commands, the runner choice and the preview caveat',()=>{
 const local=handoff(base());
 // An independent app runs its own repository commands; App Composer's operator
 // delivery scripts do not exist inside it.
 for(const command of independentDeliveryCommands)assert.match(local,new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.doesNotMatch(local,/node scripts\/delivery-journey\.mjs/);
 assert.match(local,/Delivery profile: local/);
 assert.match(local,/Version URL is not a sandbox/);
 assert.match(local,/own preview D1\/R2\/KV bindings/);
 assert.match(local,/Queue producers\/consumers and Workflows are refused/);
 assert.match(local,/Local green checks, a merged commit or a selected runner are not a production release/);
 assert.doesNotMatch(local,/add GitHub Actions/);
 const external=handoff({...base(),delivery:{profile:'existing-runner',runner:'gitlab'}});
 assert.match(external,/Delivery profile: existing-runner/);
 assert.match(external,/existing gitlab runner/);
 assert.match(external,/owned app's guarded commands/);
 assert.doesNotMatch(external,/examples\/local-delivery-runner\.sh/);
 assert.doesNotMatch(external,/`pnpm check`/);
 assert.match(external,/configured intent until one real run/);
 assert.match(external,/do not add GitHub Actions/i);
 // The operator reference keeps its own supported configuration path.
 const hello=handoff({...base(),version:1,preset:'hello',sources:undefined,config:{title:'Hello',intro:'Ready',theme:'daylight',layout:'grid'}});
 for(const command of deliveryCommands)assert.match(hello,new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('the composition handoff carries an ordered build plan an agent can actually run',()=>{
 const spec=validateSpec(base());
 const text=handoff(spec);
 // The previous handoff handed a newcomer App Composer's own operator tooling
 // and named no storage, credential or cross-app wiring. Each app must now
 // arrive with the work its own repository requires.
 assert.match(text,/Create the owner's own copy of each app/);
 assert.match(text,/a D1 database bound as DB/);
 assert.match(text,/an R2 bucket bound as MEDIA/);
 assert.match(text,/OWNER_API_TOKEN/);
 assert.match(text,/wrangler secret put OWNER_API_TOKEN/);
 assert.match(text,/ITEM_PROVIDER/);
 assert.match(text,/PROVIDER_ORIGIN/);
 assert.match(text,/\/build\.json and \/healthz report the exact owned commit/);
 assert.match(text,/Retain the upstream pin as source provenance/);
 assert.doesNotMatch(text,/pnpm compose --spec PATH --apply-settings/);
 assert.match(text,/applies settings only to the operator's already verified pair/);
 // Here / there is the provider, so it must be deployed before Linkarooie.
 const steps=buildRecipe(spec);
 const targets=steps.findIndex(step=>step.title==="Verify the owner's deployment targets");
 const storage=steps.findIndex(step=>step.title.startsWith('Provision storage'));
 const secret=steps.findIndex(step=>step.title.startsWith('Set the owner credential'));
 const guestbook=steps.findIndex(step=>step.title==='Deploy Here / there');
 const showcase=steps.findIndex(step=>step.title==='Deploy Linkarooie');
 assert.ok(targets>=0&&targets<storage&&targets<secret,'owned targets are verified before remote writes');
 assert.match(steps[targets].detail,/account, Worker names, routes, storage identifiers and service destinations/);
 assert.ok(guestbook>=0&&showcase>guestbook,'provider deploys first');
 assert.deepEqual(steps.map(step=>step.actor).filter(actor=>actor==='human'),[
  'human','human',
 ],'only the two owner credentials need the owner during the build');
 assert.deepEqual(humanOnlyActions(spec).slice(0,2),[
  'sign in to Cloudflare and authorise the account the apps deploy into',
  'create OWNER_API_TOKEN for Here / there',
 ]);
});

test('new Linkarooie-only handoffs omit Guestbook and older pins keep their requirement',()=>{
 const spec=explorerSpec({goal:'showcase',target:'preview',appearance:'daylight'});
 assert.deepEqual(spec.apps,['showcase']);
 const steps=buildRecipe(spec);
 assert.match(steps.find(step=>step.title==="Verify the owner's deployment targets").detail,/remove the ITEM_PROVIDER binding/);
 assert.ok(!steps.some(step=>step.title.includes('provider')));
 assert.ok(!steps.some(step=>step.title==='Deploy Here / there'));
 assert.match(steps.find(step=>step.title==='Verify the release').detail,/requested curated links/);
 assert.doesNotMatch(steps.find(step=>step.title==='Verify the release').detail,/hiding it at the source/);
 const legacy=validateSpec({...spec,sources:selectedSources(['guestbook','showcase']).slice(1)});
 assert.equal(buildRecipe(legacy)[0].title,'Choose an existing Here / there provider');
 const superseded=validateSpec({...spec,sources:spec.sources.map(source=>({...source,commit:'4301083349492130aa8c9c548963c49c09bd2c14'}))});
 assert.deepEqual(buildRecipe(superseded).map(step=>step.title),['Refresh the Linkarooie source pin']);
});
