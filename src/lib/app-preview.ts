import {appConfiguration} from './app-settings.mjs';
type PreviewSpec=Parameters<typeof appConfiguration>[0]&{preset:string;cards:{title:string;url:string}[];mediaStudio?:{imageModel:string;videoModel:string;aspect:string;durationSeconds:number}};
const element=(tag:string,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
const stories:Record<string,string>={composition:'Here / there collects and reviews the photos. Linkarooie gives approved moments and curated links a place together.',guestbook:'A community wall, event guestbook or travel collection. Submitted photos stay private until reviewed.',showcase:'An edited collection of links and approved photos. Curate the order, add context and keep the source connection.','media-studio':'Upload and organise media, make editorial stills, vary a reference, animate a still and publish one piece deliberately. The library works without a model account.',hello:'A small first app to prove your environment. Keep its own source, change the greeting and verify the new release.'};
const mediaLabels:Record<string,string>={ 'studio-print':'Studio Print · paper-cut editorial','studio-film':'Studio Film · screenprinted cinematic','studio-draft':'Studio Draft · fast photographic','studio-quick':'Studio Quick · cheapest draft' };

function mediaStudioPreview(spec:PreviewSpec){
 const media=spec.mediaStudio??{imageModel:'studio-print',videoModel:'hailuo-standard',aspect:'portrait',durationSeconds:6};
 const app=element('section','','sample-app');
 app.dataset.theme='daylight';
 app.append(
  element('div','Media Studio · independent studio','sample-brand'),
  element('h3',spec.config.title),
  element('p',spec.config.intro),
 );
 const grid=element('div','','sample-photos');
 for(const [src,caption] of [['/media-studio/editorial-print.jpg','Studio print · a ceramicist at the wheel'],['/media-studio/variation.jpg','Reference variation · same palette, new frame']]){
  const figure=element('figure'),image=document.createElement('img');
  image.src=src;image.alt='Generated sample still: '+caption.toLowerCase();image.width=960;image.height=960;image.loading='lazy';
  figure.append(image,element('figcaption',caption));grid.append(figure);
 }
 app.append(grid,element('p','Library, search, downloads and public pages work without a model account · '+mediaLabels[media.imageModel]+' · '+media.videoModel+' video · '+media.aspect+' · '+media.durationSeconds+'s','sample-kind'));
 return app;
}

export function renderAppPreview(spec:PreviewSpec,target=document.querySelector('[data-app-layout]')!){
 target.replaceChildren();
 if(target.matches('[data-app-layout]'))document.querySelector('#preset-story')!.textContent=stories[spec.preset];
 for(const id of spec.apps){
  if(id==='media-studio'){target.append(mediaStudioPreview(spec));continue;}
  const config=id==='hello'?spec.config:appConfiguration(spec,id);
  const app=element('section','','sample-app'+(id==='hello'?' sample-hello':''));app.dataset.theme=config.theme;
  app.append(element('div',id==='guestbook'?'Here / there · photo guestbook':id==='showcase'?'Linkarooie · curated collection':'Your Hello app','sample-brand'),element('h3',config.title));if(id==='showcase'&&config.handle)app.append(element('div','@'+config.handle,'sample-handle'));app.append(element('p',config.intro));
  if(id==='showcase'){const social=element('div','','sample-social');for(const field of ['website','github','bluesky','linkedin'])if(config[field])social.append(element('span',field==='github'?'GitHub':field==='linkedin'?'LinkedIn':field==='bluesky'?'Bluesky':'Website'));if(social.childElementCount)app.append(social);}
  if(id!=='hello'&&config.layout!=='compact'){
   const photos=element('div','','sample-photos '+config.layout);
   for(const [src,caption] of [['/brand/demo/ringmarket-v5.webp','Signal check at the ring market'],['/brand/demo/lighthouse-v5.webp','The tide lighthouse, slow moon']].slice(0,config.layout==='editorial'?1:2)){
    const figure=element('figure'),image=document.createElement('img');image.src=src;image.alt='Fictional demo postcard: '+caption.toLowerCase();image.width=1200;image.height=900;image.loading='lazy';figure.append(image,element('figcaption',caption));photos.append(figure);
   }app.append(photos);
   }
  if(id==='showcase') {if(config.layout==='compact')for(const title of ['Signal check at the ring market','The tide lighthouse, slow moon'])app.append(element('div',title,'sample-link'));for(const card of spec.cards){const line=element('div',card.title,'sample-link'),url=element('small',new URL(card.url).hostname);line.append(document.createElement('br'),url);app.append(line);}
  }
  app.append(element('p',id==='hello'?'Title, introduction and theme':id==='guestbook'?'Sample approved photos · submissions require review':'Sample collection · approved originals stay connected','sample-kind'));target.append(app);
 }
}
