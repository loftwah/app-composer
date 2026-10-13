import {validateSpec} from './spec.mjs';

// The authored reference exposes these three fields; gallery layout is irrelevant.
export function helloConfiguration(input,origin) {
 const spec=validateSpec(input);
 if(spec.preset!=='hello')throw new Error('Use a Hello reference specification. Pair configuration uses pnpm compose.');
 if(spec.deployment.mode!=='existing-domain')throw new Error('Hello configuration requires a verified existing domain; preview provisioning and purchases are separate actions.');
 if(spec.deployment.hostname!==new URL(origin).hostname)throw new Error('The specification hostname must match the explicit reference origin.');
 const {title,intro,theme}=spec.config;
 return {title,intro,theme};
}
