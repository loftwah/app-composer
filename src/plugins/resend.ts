import {definePlugin} from 'emdash';
import {deliverResend} from '../lib/resend-delivery.mjs';

// Native format is required to read deployment secrets without persisting a key in CMS settings.
export function createPlugin() {
  return definePlugin({
    id:'composer-resend',version:'1.0.0',
    capabilities:['hooks.email-transport:register'],
    hooks:{'email:deliver':{exclusive:true,timeout:10000,handler:async({message})=>{
      await deliverResend(message,process.env);
    }}},
  });
}
