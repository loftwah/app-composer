import {validateSpec} from './spec.mjs';

// The authored reference exposes these three fields; gallery layout is irrelevant.
export function helloConfiguration(input,origin,{allowVerifiedWorkersDev=false}={}) {
 const spec=validateSpec(input);
 if(spec.preset!=='hello')throw new Error('Use a Hello reference specification. Pair configuration uses pnpm compose.');
 const ownedAddress=allowVerifiedWorkersDev&&new URL(origin).hostname.endsWith('.workers.dev')&&spec.deployment.mode==='preview';
 if(spec.deployment.mode!=='existing-domain'&&!ownedAddress)throw new Error('Hello configuration requires a verified existing domain; preview provisioning and purchases are separate actions.');
 if((!ownedAddress||spec.deployment.hostname)&&spec.deployment.hostname!==new URL(origin).hostname)throw new Error('The specification hostname must match the explicit reference origin.');
 const {title,intro,theme}=spec.config;
 return {title,intro,theme};
}
