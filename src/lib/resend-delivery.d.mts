import type {EmailMessage} from 'emdash/plugin';
export function deliverResend(message:EmailMessage,runtime:Record<string,string|undefined>,send?:typeof fetch):Promise<void>;
