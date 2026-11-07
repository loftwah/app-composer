import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpec,handoff,explorerSpec,deliveryProfiles,deliveryRunners,deliveryCommands} from '../src/lib/spec.mjs';
import {selectedSources} from '../src/lib/app-settings.mjs';

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
 for(const command of deliveryCommands)assert.match(local,new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.match(local,/Delivery profile: local/);
 assert.match(local,/Version URL is not a sandbox/);
 assert.match(local,/own preview D1\/R2\/KV bindings/);
 assert.match(local,/Queue producers\/consumers and Workflows are refused/);
 assert.match(local,/Local green checks, a merged commit or a selected runner are not a production release/);
 assert.doesNotMatch(local,/add GitHub Actions/);
 const external=handoff({...base(),delivery:{profile:'existing-runner',runner:'gitlab'}});
 assert.match(external,/Delivery profile: existing-runner/);
 assert.match(external,/existing gitlab runner/);
 assert.match(external,/examples\/local-delivery-runner\.sh/);
 assert.match(external,/configured intent until one real run/);
 assert.match(external,/do not add GitHub Actions/);
});
