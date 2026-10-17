import test from 'node:test';import assert from 'node:assert/strict';
import {defaultAssistancePreference,validateAssistancePreference,assistanceHandoff,defaultSetupPreferences,validateSetupPreferences} from '../lib/get-ready/preferences.mjs';
import {presetRecommendation,recommendationSpec,assistedHandoff,initialRecommendation} from '../src/lib/init-recommendations.mjs';
import {validateSpec,presets} from '../src/lib/spec.mjs';import {selectedSources} from '../src/lib/app-settings.mjs';
const initial=()=>validateSpec({version:2,preset:'composition',sources:selectedSources(['guestbook','showcase']),config:{title:presets.composition.title,intro:presets.composition.intro,theme:'midnight',layout:'editorial'},cards:[{title:'A fictional reference',url:'https://example.test/'}],privacy:'review-first',deployment:{mode:'existing-domain',hostname:'app.example.test'},decisions:{goal:'composition',target:'existing-domain',privacy:'review-first',appearance:'midnight','owner-priority':'Keep the source'}});
test('a composition link previews its starting point without replacing a saved draft',()=>{
 const saved=recommendationSpec(initial(),'showcase');
 const before=JSON.stringify(saved);
 assert.equal(initialRecommendation('?start=composition&analytics=off&qa=1',saved.preset),'composition');
 assert.equal(JSON.stringify(saved),before);
 for(const search of ['', '?start=unreviewed', '?start=constructor', '?start=composition&start=hello'])assert.equal(initialRecommendation(search,saved.preset),'showcase');
 const applied=recommendationSpec(saved,initialRecommendation('?start=composition',saved.preset));
 assert.deepEqual(applied.apps,['guestbook','showcase']);
 assert.deepEqual(applied.cards,saved.cards);
 assert.equal(applied.config.theme,saved.config.theme);
 assert.equal(applied.deployment.hostname,saved.deployment.hostname);
});
test('assistance intent is strict, independent of address and cannot grant execution authority',()=>{
 assert.equal(defaultAssistancePreference.level,'easy');for(const level of ['easy','guided','advanced']){const preference=validateAssistancePreference({version:1,level});assert.match(assistanceHandoff(preference),/grants no access, setup, purchase, permission, destructive action or deployment authority/);assert.deepEqual(validateSetupPreferences(defaultSetupPreferences),defaultSetupPreferences);}
 for(const input of [{version:2,level:'easy'},{version:1,level:'execute'},{version:1,level:'advanced',token:'fictional'},{version:1,level:'constructor'},{version:1,level:['easy']},{version:1,level:null}])assert.throws(()=>validateAssistancePreference(input));
});
test('recommendations use actual preset/contracts and preserve unrelated content, appearance, target and decisions',()=>{
 const original=initial(),custom=validateSpec({...original,config:{...original.config,title:'Owner-edited title',intro:'Owner-edited introduction'}});
 for(const preset of ['composition','guestbook','showcase','hello']){const info=presetRecommendation(preset),next=recommendationSpec(custom,preset);assert.deepEqual(info.apps,presets[preset].apps);assert.deepEqual(next.sources,selectedSources(next.apps));assert.equal(next.config.title,custom.config.title);assert.equal(next.config.intro,custom.config.intro);assert.equal(next.config.theme,'midnight');assert.equal(next.deployment.hostname,custom.deployment.hostname);assert.equal(next.decisions['owner-priority'],'Keep the source');assert.equal(next.decisions.goal,preset);assert.equal(next.deployment.approval,'verification-required');assert(next.privacy==='review-first');if(preset==='showcase'||preset==='composition')assert.deepEqual(next.cards,custom.cards);}
 const picked=recommendationSpec(original,'showcase');assert.equal(picked.config.title,presets.showcase.title);assert.equal(picked.config.intro,presets.showcase.intro);assert.equal(picked.config.layout,'editorial');assert(!Object.hasOwn(picked.decisions,'privacy'));assert.equal(original.preset,'composition');assert.throws(()=>presetRecommendation('unreviewed-app'));
});
test('all help levels hand off the exact same validated app configuration with distinct bounded presentation intent',()=>{
 const spec=recommendationSpec(initial(),'showcase'),before=JSON.stringify(spec);for(const level of ['easy','guided','advanced']){const text=assistedHandoff(spec,{version:1,level});assert(text.includes(JSON.stringify(spec,null,2)));assert(text.includes('Help preference: '+level));assert.match(text,/Purchases, expanded permissions and destructive actions require explicit MP approval/);assert.equal(JSON.stringify(spec),before);}
});
