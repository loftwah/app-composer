const controls = document.getElementById('controls');
const scenes = [...document.querySelectorAll('.scene')];
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const position = document.getElementById('position');
let current = 0;

function show(index) {
  current = Math.max(0, Math.min(index, scenes.length - 1));
  scenes.forEach((scene, sceneIndex) => { scene.hidden = sceneIndex !== current; });
  previous.disabled = current === 0;
  next.disabled = current === scenes.length - 1;
  position.textContent = `${current + 1} / ${scenes.length}`;
}

previous.addEventListener('click', () => show(current - 1));
next.addEventListener('click', () => show(current + 1));
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
controls.hidden = false;
show(0);
