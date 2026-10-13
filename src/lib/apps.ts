// Public, shipped applications only. Catalogue publishing remains owned by EmDash.
export const apps = [
 {id:'guestbook',name:'Here / there',category:'Publishing',description:'Collect photos and messages, review submissions and choose what to publish.',href:'/guestbook/',standalone:'https://guestbook.loftwah.com',source:'https://github.com/loftwah/app-composer-guestbook',colour:'#ff9b55',initial:'H'},
 {id:'showcase',name:'Top shelf',category:'Publishing',description:'Arrange your links and approved Here / there photos into a page.',href:'/showcase/',standalone:'https://showcase.loftwah.com',source:'https://github.com/loftwah/app-composer-showcase',colour:'#8adeb0',initial:'T'},
 {id:'hello',name:'Hello World',category:'Development',description:'Keep a small first application to prove your agent can build and deploy.',href:'https://ready.loftwah.com',standalone:'https://ready.loftwah.com',source:'https://github.com/loftwah/app-composer-hello',colour:'#b8b8ff',initial:'H'},
 {id:'state',name:'Portable AI State',category:'Identity & memory',description:'Try encrypted assistant profiles using fictional data only.',href:'https://ai.loftwah.com',standalone:'https://ai.loftwah.com',source:'https://github.com/loftwah/app-composer-state',colour:'#f4c879',initial:'P'}
] as const;
