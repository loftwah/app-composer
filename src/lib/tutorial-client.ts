import {readTutorialProgress, tutorialKey} from './tutorial-progress.mjs';

const root = document.querySelector<HTMLElement>('[data-tutorial]')!;
const lessons = [...root.querySelectorAll<HTMLElement>('[data-lesson]')];
const lessonIds = lessons.map(lesson => lesson.dataset.lesson!);
const observations = [...root.querySelectorAll<HTMLInputElement>('[data-observation]')];
const checkIds = observations.map(input => input.dataset.observation!);
let current = lessonIds[0];
let checked = new Set<string>();
const storageStatus = root.querySelector<HTMLElement>('[data-storage-status]')!;
try {
 const raw = localStorage.getItem(tutorialKey);
 if (raw) {
  const saved = readTutorialProgress(raw, checkIds, lessonIds);
  if (saved) {current = saved.lesson; checked = new Set(saved.checked);}
  else storageStatus.textContent = 'Saved notes use an unsupported format. Start again here; verified setup reports are unaffected.';
 }
} catch {storageStatus.textContent = 'Device storage is unavailable. Notes work for this visit.';}

function save(announce = true) {
 try {localStorage.setItem(tutorialKey, JSON.stringify({version:1, checked:[...checked], lesson:current}));
  if (announce) storageStatus.textContent = 'Learning notes saved on this device.';
 } catch {storageStatus.textContent = 'Notes could not be saved. They work for this visit; keep this tab open.';}
}
function updateObservations() {
 for (const input of observations) input.checked = checked.has(input.dataset.observation!);
 root.querySelector('[data-progress-count]')!.textContent = `${checked.size} of ${checkIds.length} observations noted`;
 root.querySelector<HTMLProgressElement>('progress')!.value = checked.size;
 for (const id of lessonIds) {
  const ids = checkIds.filter(check => check.startsWith(id+'-'));
  const count = ids.filter(check => checked.has(check)).length;
  const state = root.querySelector<HTMLElement>(`[data-lesson-state="${id}"]`)!;
  state.hidden = count === 0;
  state.textContent = `${count} of ${ids.length} observations noted`;
 }
 root.querySelector('[data-notes-count]')!.textContent = `${checked.size}/${checkIds.length}`;
}
const initialLesson = current;
const picker = root.querySelector<HTMLSelectElement>('[data-lesson-picker]')!;
function showLesson() {
 const requested = location.hash.slice(1);
 current = lessonIds.includes(requested) ? requested : current;
 for (const lesson of lessons) lesson.hidden = lesson.dataset.lesson !== current;
 for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-lesson-link]')) {
  if (link.dataset.lessonLink === current) link.setAttribute('aria-current','step');
  else link.removeAttribute('aria-current');
 }
 root.querySelector('[data-lesson-context]')!.textContent = `Lesson ${lessonIds.indexOf(current)+1} of ${lessonIds.length} · reviewed 14 October 2026`;
 picker.value = current;
 const index = lessonIds.indexOf(current);
 for (const [selector, nextIndex, label] of [['[data-lesson-previous]',index-1,'Previous'],['[data-lesson-next]',index+1,'Next']] as const) {
  const link = root.querySelector<HTMLAnchorElement>(selector)!;
  const next = lessons[nextIndex];link.hidden = !next;
  if (next) {
   link.href = '#'+next.dataset.lesson;
   link.setAttribute('aria-label',`${label} lesson: ${next.querySelector('h2')!.textContent}`);
  }
 }
 updateAnchorOffset();
 const start = document.querySelector<HTMLAnchorElement>('[data-start]')!;
 start.href = '#'+current;
 start.firstChild!.textContent = current === lessonIds[0] ? 'Start the tutorial ' : 'Continue the tutorial ';
}
function updateAnchorOffset() {
 const article = lessons.find(lesson=>lesson.dataset.lesson===current)!;
 const content = root.querySelector<HTMLElement>('.lesson-content')!;
 // Native fragment restoration can run after pageshow. Give it the same
 // document offset as our controller so a bookmark cannot slide under the bar.
 article.style.scrollMarginTop = `${article.getBoundingClientRect().top-content.getBoundingClientRect().top+16}px`;
}
window.addEventListener('resize',updateAnchorOffset);
function positionLesson(focus = false) {
 // Measure the document position, not the sticky toolbar's current position.
 const content = root.querySelector<HTMLElement>('.lesson-content')!;
 const top = Math.max(0,content.getBoundingClientRect().top+window.scrollY-16);
 if (focus) document.getElementById(current+'-title')!.focus({preventScroll:true});
 window.scrollTo({top,behavior:'instant'});
}
function navigateLesson(id: string) {
 if (!lessonIds.includes(id)) return;
 if (location.hash !== '#'+id) history.pushState(null,'','#'+id);
 current=id;showLesson();positionLesson(true);save(false);
}
// Keep ordinary links, copy-link and new-tab behaviour. Own only same-page,
// unmodified activation so native fragment scrolling cannot race panel changes.
document.addEventListener('click',event=>{
 if (event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
 const target=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
 if(!target||target.target||target.hasAttribute('download'))return;
 const url=new URL(target.href);
 if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search)return;
 const id=url.hash.slice(1);if(!lessonIds.includes(id))return;
 event.preventDefault();navigateLesson(id);
});
picker.hidden=false;picker.disabled=false;
picker.addEventListener('change',()=>navigateLesson(picker.value));
root.dataset.tutorialEnhanced='true';
for (const input of observations) {
 input.disabled = false;
 input.addEventListener('change', () => {
  if (input.checked) checked.add(input.dataset.observation!);
  else checked.delete(input.dataset.observation!);
  updateObservations(); save();
 });
}
for (const input of root.querySelectorAll<HTMLInputElement>('[data-answer]')) {
 input.disabled = false;
 input.addEventListener('change', () => {
  const feedback = input.closest('fieldset')!.querySelector<HTMLElement>('[data-answer-feedback]')!;
  const correct = input.value === input.dataset.correct;
  feedback.hidden = false; feedback.dataset.result = correct ? 'correct' : 'try-again';
  feedback.textContent = `${correct?'That’s right.':'Take another look.'} ${input.dataset.explanation}`;
 });
}
for (const button of root.querySelectorAll<HTMLButtonElement>('[data-copy-prompt]')) {
 button.hidden = false;
 button.addEventListener('click', async () => {
  const id = button.dataset.copyPrompt!;
  const message = root.querySelector<HTMLElement>(`[data-copy-status="${id}"]`)!;
  const prompt = root.querySelector<HTMLElement>(`[data-agent-prompt="${id}"]`)!;
  try {await navigator.clipboard.writeText(prompt.textContent!); message.textContent = 'Copied. Paste into your agent in the selected project.';}
  catch {message.textContent = 'Clipboard access is unavailable. Select the request text above and copy it manually.';}
 });
}
const clear = root.querySelector<HTMLButtonElement>('[data-clear-progress]')!;
const confirm = root.querySelector<HTMLElement>('[data-clear-confirm]')!;
clear.hidden = false;
clear.addEventListener('click', () => {confirm.hidden=false; clear.hidden=true; root.querySelector<HTMLButtonElement>('[data-confirm-clear]')!.focus();});
root.querySelector('[data-cancel-clear]')!.addEventListener('click', () => {confirm.hidden=true; clear.hidden=false; clear.focus();});
root.querySelector('[data-confirm-clear]')!.addEventListener('click', () => {
 checked.clear(); current=lessonIds[0]; updateObservations();
 try {localStorage.removeItem(tutorialKey); storageStatus.textContent = 'Learning notes cleared. Your setup report and Init draft are unaffected.';}
 catch {storageStatus.textContent = 'Notes cleared for this visit. Device storage could not be changed.';}
 confirm.hidden=true; clear.hidden=false;
 history.replaceState(null,'','#'+current); showLesson();positionLesson(true);
});
// Back/Forward changes the URL before rendering. Let the browser retain its
// saved scroll position; do not force a new title jump on history traversal.
let historyHash: string | null = null;
window.addEventListener('popstate',()=>{historyHash=location.hash;current=lessonIds.includes(location.hash.slice(1))?location.hash.slice(1):initialLesson;showLesson();save(false);});
window.addEventListener('hashchange',event=>{const restored=historyHash===new URL(event.newURL).hash;historyHash=null;if(restored)return;showLesson();if(lessonIds.includes(location.hash.slice(1)))positionLesson(true);});
function positionDirectLink(){if(lessonIds.includes(location.hash.slice(1)))requestAnimationFrame(()=>positionLesson());}
window.addEventListener('pageshow',event=>{updateObservations();showLesson();if(!event.persisted)positionDirectLink();});
updateObservations();showLesson();
if(document.readyState==='complete')positionDirectLink();
