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

function save() {
 try {localStorage.setItem(tutorialKey, JSON.stringify({version:1, checked:[...checked], lesson:current}));
  storageStatus.textContent = 'Learning notes saved on this device.';
 } catch {storageStatus.textContent = 'Notes could not be saved. They work for this visit; keep this tab open.';}
}
function updateObservations() {
 for (const input of observations) input.checked = checked.has(input.dataset.observation!);
 root.querySelector('[data-progress-count]')!.textContent = `${checked.size} of ${checkIds.length} observations noted`;
 root.querySelector<HTMLProgressElement>('progress')!.value = checked.size;
 for (const id of lessonIds) {
  const ids = checkIds.filter(check => check.startsWith(id+'-'));
  const count = ids.filter(check => checked.has(check)).length;
  root.querySelector(`[data-lesson-state="${id}"]`)!.textContent = count ? `${count} of ${ids.length} observations noted` : 'Not noted yet';
 }
}
function showLesson(focus = false) {
 const requested = location.hash.slice(1);
 current = lessonIds.includes(requested) ? requested : current;
 for (const lesson of lessons) lesson.hidden = lesson.dataset.lesson !== current;
 for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-lesson-link]')) {
  if (link.dataset.lessonLink === current) link.setAttribute('aria-current','step');
  else link.removeAttribute('aria-current');
 }
 root.querySelector('[data-lesson-context]')!.textContent = `Lesson ${lessonIds.indexOf(current)+1} of ${lessonIds.length} · reviewed 14 October 2026`;
 const start = document.querySelector<HTMLAnchorElement>('[data-start]')!;
 start.href = '#'+current;
 start.firstChild!.textContent = current === lessonIds[0] ? 'Start the tutorial ' : 'Continue the tutorial ';
 if (focus) {
  const title = document.getElementById(current+'-title')!;
  title.focus({preventScroll:true});
  title.scrollIntoView({block:'start',behavior:'instant'});
 }
}
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
 history.replaceState(null,'','#'+current); showLesson(true);
});
window.addEventListener('hashchange', () => {showLesson(true); save();});
window.addEventListener('pageshow', () => {updateObservations(); showLesson();});
updateObservations(); showLesson();
