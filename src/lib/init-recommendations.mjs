import {presets,questions,validateSpec,pruneAnswers,handoff} from './spec.mjs';
import {selectedSources} from './app-settings.mjs';
import {assistanceHandoff} from '../../lib/get-ready/preferences.mjs';
const limits={composition:'Photos require an invitation and owner review. Customer deployment still needs an authorised agent and a verified target.',guestbook:'Contributions remain private until approved. New customer storage and deployment need agent implementation and verification.',showcase:'Cards are curated HTTPS links or eligible photos. This does not automatically collect content or provision a customer deployment.',hello:'The supported reference changes title, introduction and theme. Broader code changes require a separate reviewed implementation.'};
export function presetRecommendation(id){
 const option=questions.find(q=>q.id==='goal').options.find(o=>o[0]===id);if(!option||!Object.hasOwn(presets,id))throw Error('Choose a supported starting point.');
 return {id,label:option[1],reason:option[2],limitation:limits[id],apps:[...presets[id].apps],sources:selectedSources(presets[id].apps)};
}
export function recommendationSpec(input,id){
 const current=validateSpec(input),recommendation=presetRecommendation(id),before=presets[current.preset],after=presets[id];
 const decisions={...pruneAnswers({...current.decisions,goal:id}),...(Object.hasOwn(current.decisions,'owner-priority')?{'owner-priority':current.decisions['owner-priority']}:{})};
 return validateSpec({...current,preset:id,sources:recommendation.sources,appSettings:Object.fromEntries(Object.entries(current.appSettings).filter(([app])=>recommendation.apps.includes(app))),config:{...current.config,title:current.config.title===before.title?after.title:current.config.title,intro:current.config.intro===before.intro?after.intro:current.config.intro},decisions});
}
export function assistedHandoff(spec,preference){return handoff(spec)+assistanceHandoff(preference);}
