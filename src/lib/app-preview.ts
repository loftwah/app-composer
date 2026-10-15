import {appConfiguration} from './app-settings.mjs';
type PreviewSpec=Parameters<typeof appConfiguration>[0]&{preset:string;cards:{title:string;url:string}[]};
const element=(tag:string,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
const stories:Record<string,string>={composition:'Here / there collects and reviews the photos. Top shelf gives approved moments and curated links a place together.',guestbook:'A community wall, event guestbook or travel collection. Submitted photos stay private until reviewed.',showcase:'An edited collection of links and approved photos. Curate the order, add context and keep the source connection.',hello:'A small first app to prove your environment. Keep its own source, change the greeting and verify the new release.'};
export function renderAppPreview(spec:PreviewSpec,target=document.querySelector('[data-app-layout]')!){
 target.replaceChildren();
 if(target.matches('[data-app-layout]'))document.querySelector('#preset-story')!.textContent=stories[spec.preset];
 for(const id of spec.apps){
  const config=id==='hello'?spec.config:appConfiguration(spec,id);
  const app=element('section','','sample-app'+(id==='hello'?' sample-hello':''));app.dataset.theme=config.theme;
  app.append(element('div',id==='guestbook'?'Here / there · photo guestbook':id==='showcase'?'Top shelf · curated collection':'Your Hello app','sample-brand'),element('h3',config.title));if(id==='showcase'&&config.handle)app.append(element('div','@'+config.handle,'sample-handle'));app.append(element('p',config.intro));
  if(id==='showcase'){const social=element('div','','sample-social');for(const field of ['website','github','bluesky','linkedin'])if(config[field])social.append(element('span',field==='github'?'GitHub':field==='linkedin'?'LinkedIn':field==='bluesky'?'Bluesky':'Website'));if(social.childElementCount)app.append(social);}
  if(id!=='hello'&&config.layout!=='compact'){
   const photos=element('div','','sample-photos '+config.layout);
   for(const [src,caption] of [['/brand/courtyard-ai-v1.jpg','Courtyard, late afternoon'],['/brand/coastal-path-ai-v1.jpg','The walk home']].slice(0,config.layout==='editorial'?1:2)){
    const figure=element('figure'),image=document.createElement('img');image.src=src;image.alt='Generated fictional '+caption.toLowerCase();image.width=1200;image.height=src.includes('courtyard')?630:800;image.loading='lazy';figure.append(image,element('figcaption',caption));photos.append(figure);
   }app.append(photos);
   }
  if(id==='showcase') {if(config.layout==='compact')for(const title of ['Courtyard, late afternoon','The walk home'])app.append(element('div',title,'sample-link'));for(const card of spec.cards){const line=element('div',card.title,'sample-link'),url=element('small',new URL(card.url).hostname);line.append(document.createElement('br'),url);app.append(line);}
  }
  app.append(element('p',id==='hello'?'Title, introduction and theme':id==='guestbook'?'Sample approved photos · submissions require review':'Sample collection · approved originals stay connected','sample-kind'));target.append(app);
 }
}
