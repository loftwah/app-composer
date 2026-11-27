import { mountSpinEditor, nearbySearch } from './spin-editor.mjs';
import { paintSpinWheel, spinAngleAt, spinDetent, spinDistance, spinDuration, turn, winnerAngle } from './spin-wheel.mjs';
import { loadSpinPhotos } from './spin-art.mjs';
import { mountSpinShare } from './spin-share.mjs';
import { spinClick, spinChime } from './spin-audio.mjs';
import { readSpinExample } from '../lib/spin-examples.mjs';
import { spinOrigin } from '../lib/spin-site.mjs';
import { spinDefaultPreset, spinPresetById } from '../lib/spin-presets.mjs';
import { openSpinMode, spinChoiceLimit, spinModeLabel, validateSpinConfig, verifySpin } from '../lib/spin-protocol.mjs';

const root = document.querySelector('[data-spin]');
if (root) mount(root);

function mount(root) {
  const get = name => root.querySelector('[data-' + name + ']');
  const canvas = get('wheel');
  const ctx = canvas.getContext('2d');
  const setup = get('setup');
  const presetBar = get('spin-presets');
  const hub = get('spin-hub');
  const spinControl = () => get('spin-primary').querySelector('button:not([hidden])');
  const { question, bestOf } = setup.elements;
  const currentId = new URL(location.href).searchParams.get('session');
  let example = root.dataset.spinExample;
  const key = id => 'composer-spin-owner:' + id;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let session;
  let owner = '';
  let playing = false;
  let sound = true;
  try { sound = localStorage.getItem('composer-spin-sound') !== 'off'; } catch {}
  let automatic = false;
  let audio;
  let angle = 0;
  let wheelLabels = [];
  let direction = 1;
  const panel = get('wheel-panel');
  const sharing = mountSpinShare(get('share-dialog'), get('share-result'), () => {
    armSound();
    return sound ? audio : undefined;
  }, reduced);

  const showError = message => { get('error').textContent = message; };
  const showResult = message => {
    const status = get('result');
    if (status.textContent !== message) status.textContent = message;
  };
  const focusAction = name => requestAnimationFrame(() => get(name).focus({ preventScroll: true }));
  const rules = config => config.bestOf === openSpinMode ? 'Each spin counts. Finish whenever you like.' :
    config.bestOf === 1 ? 'One spin. Each choice has the same chance.' :
      config.entries.length === 2 ? `First to ${Math.floor(config.bestOf / 2) + 1} wins the series.` :
        `${config.bestOf} spins. The highest score wins. Ties get extra spins.`;
  const templateLink = config => spinOrigin + '/#' + new URLSearchParams({ wheel: JSON.stringify(config) });
  const shareUrl = id => example ? spinOrigin + '/?example=' + encodeURIComponent(example) :
    new URL(root.dataset.spinPath + '?session=' + encodeURIComponent(id), location.origin).href;

  function syncHub() {
    const control = spinControl();
    hub.disabled = playing || !control || control.disabled;
    hub.setAttribute('aria-label', control === get('stage-replay') ? 'Watch the spin again' :
      control === get('spin-again') ? 'Spin this wheel again' : 'Spin the wheel');
  }

  function activateWheel() {
    const control = spinControl();
    if (control && !playing && !control.disabled) control.click();
  }

  function warmWheelPhotos(labels) {
    const loading = loadSpinPhotos(labels);
    if (!loading) return;
    void loading.then(() => {
      if (playing || wheelLabels !== labels) return;
      const completed = session?.status === 'completed';
      const winner = completed ? session.winner : session?.rounds.at(-1)?.winner ?? -1;
      paintSpinWheel(ctx, labels, angle, { winner, shade: completed });
    });
  }

  function updatePreview(labels) {
    const best = Number(bestOf.value);
    get('rules').textContent = rules({ entries: labels, bestOf: best });
    if (!session) {
      get('spin-heading').textContent = question.value.trim() || 'What should we pick?';
      get('spin-heading').title = get('spin-heading').textContent;
      wheelLabels = labels;
      warmWheelPhotos(labels);
      paintSpinWheel(ctx, labels, angle);
      get('result-label').textContent = labels.length < 2 ? 'Build your wheel' :
        reduced.matches ? 'Tap the wheel or press Spin' : 'Tap or flick the wheel';
      showResult(labels.length >= 2 ? `${labels.length} choices` : 'Add at least two choices.');
      get('share').disabled = playing || get('spin-now').disabled;
    }
    syncHub();
  }

  function render(next, keepAngle = false) {
    const firstRender = !session || session.id !== next.id;
    session = next;
    get('spin-heading').textContent = next.config.question;
    get('spin-heading').title = next.config.question;
    get('full-question').textContent = next.config.question;
    const showingExample = Boolean(example);
    get('spin-intro').hidden = !showingExample;
    get('spin-intro').textContent = showingExample ? 'Recorded draw' : '';
    const openMode = next.config.bestOf === openSpinMode;
    const isOpen = next.status === 'open';
    const completed = next.status === 'completed';
    const count = next.rounds.length;
    const canSpin = isOpen && Boolean(owner);
    get('share-label').textContent = completed ? 'Share result' : 'Share draw';
    bestOf.value = String(next.config.bestOf);
    bestOf.disabled = true;
    get('rules').textContent = rules(next.config);
    get('spin-again').hidden = isOpen || Boolean(currentId && !owner) || showingExample;
    get('stage-replay').hidden = !get('spin-again').hidden || count === 0 || isOpen;
    get('waiting').hidden = !isOpen || canSpin;
    get('finish').hidden = !openMode || !canSpin;
    get('finish').disabled = playing || count === 0;
    get('score-heading').textContent = openMode ? 'Session tally' : 'Series score';
    get('scores').setAttribute('aria-label', openMode ? 'Session tally' : 'Series score');
    get('draw').textContent = count ? 'Next spin' : 'Spin';
    if (firstRender) get('score-details').open = next.config.entries.length <= 6;
    setup.hidden = true;
    if (get('edit-choices')) get('edit-choices').hidden = true;
    for (const button of presetBar.querySelectorAll('[aria-pressed]')) button.removeAttribute('aria-pressed');
    get('spin-now').hidden = true;
    get('undo-wheel').hidden = true;
    panel.dataset.state = next.status;
    get('session').hidden = false;
    get('session-heading').textContent = completed ? 'The result' : 'The draw';
    const countLabel = `${count} ${count === 1 ? 'spin' : 'spins'}`;
    get('series').textContent = `${spinModeLabel(next.config.bestOf)} · ${countLabel} recorded.`;
    const wins = next.totals[next.winner];
    get('result-label').textContent = completed
      ? next.winner < 0 ? 'Final result' : next.config.bestOf === 1 ? 'Winner' : `Winner · ${wins} ${wins === 1 ? 'win' : 'wins'}`
      :
      next.status === 'abandoned' ? 'Draw closed' :
        next.tieBreak ? `Tie-break next · ${countLabel} recorded` : openMode ? `${countLabel} recorded` :
          next.config.bestOf === 1 ? 'Single spin' : `Round ${Math.min(count + 1, next.config.bestOf)} of ${next.config.bestOf}`;
    get('scores').replaceChildren(...next.config.entries.map((label, index) => {
      const item = document.createElement('li');
      if (index === next.winner) item.className = 'winner';
      const name = document.createElement('span');
      name.textContent = next.config.entries.length > 12 ? `${index + 1}. ${label}` : label;
      const score = document.createElement('strong');
      score.textContent = String(next.totals[index]);
      item.append(name, score);
      return item;
    }));
    const visibleRounds = next.rounds.slice(-50);
    get('history-note').hidden = visibleRounds.length === count;
    get('history-note').textContent = `Showing the latest ${visibleRounds.length} of ${count} spins. Download the finished session receipt for the full history.`;
    get('rounds').replaceChildren(...visibleRounds.map(round => {
      const li = document.createElement('li');
      li.textContent = `Round ${round.index + 1}${round.tieBreak ? ' · tie-break' : ''} — ${next.config.entries[round.winner]}`;
      return li;
    }));
    get('commitment').textContent = next.commitment;
    get('expiry').textContent = example ? 'Public launch example from a completed session.' :
      'Available until ' + new Date(next.expiresAt).toLocaleDateString('en-AU') + '.';
    get('refresh').hidden = !isOpen || Boolean(example);
    get('draw').hidden = !owner || next.status !== 'open';
    get('auto').hidden = get('draw').hidden || next.config.bestOf <= 1;
    get('abandon').hidden = !owner || next.status !== 'open';
    get('playback').hidden = isOpen || (!showingExample && !currentId && count === 0);
    get('replay-last').hidden = count === 0 || !get('stage-replay').hidden;
    get('create-own').hidden = !showingExample && !currentId;
    get('replay-series').hidden = count < 2;
    get('replay-series').textContent = openMode && count > 3 ? 'Replay the last 3 spins' : 'Replay the series';
    const winner = next.config.entries[next.winner];
    const takeaway = next.status === 'completed' && spinPresetById.takeaway.entries.includes(winner);
    get('nearby').hidden = !takeaway;
    if (takeaway) get('nearby').href = nearbySearch(winner);
    get('remix').href = templateLink(next.config);
    const last = next.rounds.at(-1);
    const settledWinner = next.status === 'completed' && next.winner >= 0 ? next.winner : last?.winner;
    if (settledWinner !== undefined) angle = winnerAngle(settledWinner, next.config.entries.length);
    else if (!keepAngle) angle = 0;
    wheelLabels = next.config.entries;
    warmWheelPhotos(wheelLabels);
    paintSpinWheel(ctx, wheelLabels, angle, { winner: completed ? next.winner : isOpen ? (last?.winner ?? -1) : -1, shade: completed });
    showResult(next.status === 'completed' ? (next.winner < 0 ? 'It’s a tie' : next.config.entries[next.winner]) :
      next.status === 'abandoned' ? 'This spin was stopped' :
        last ? next.config.entries[last.winner] : 'Ready to spin');
    if (completed) sharing.present({ session: next, link: shareUrl(next.id), question: next.config.question });
    else sharing.hideResult();
    const result = get('result');
    result.toggleAttribute('data-long-result', result.textContent.length > 18);
    syncHub();
    get('verification').textContent = '';
    get('verification-warning').textContent = '';
    if (next.status !== 'open') {
      try { if (!example) localStorage.removeItem(key(next.id)); } catch {}
      get('verification').textContent = 'Checking the result…';
      const report = (message, warn) => {
        if (session !== next) return;
        get('verification').textContent = message;
        if (warn) get('verification-warning').textContent = message;
      };
      void verifySpin(next).then(verified => {
        report(verified ? 'Matches the original spin.' : 'This result does not match the original spin.', !verified);
      }).catch(() => {
        report('Spin couldn’t check this result.', true);
      });
    }
  }

  async function request(id = '', body) {
    const response = await fetch('/api/spin' + (id ? '?id=' + encodeURIComponent(id) : ''), body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    } : undefined);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Spin did not answer.');
    return result;
  }

  async function perform(action) {
    if (playing) return;
    playing = true;
    showError('');
    panel.removeAttribute('data-celebrate');
    get('share').disabled = true;
    syncHub();
    presetBar.inert = true;
    const pauseButton = automatic ? get('auto') : null;
    const draftBusy = !session;
    if (draftBusy) {
      setup.inert = true;
      bestOf.disabled = true;
    }
    const buttons = ['spin-now', 'draw', 'spin-again', 'stage-replay', 'auto', 'abandon', 'refresh', 'replay-last', 'replay-series', 'lock-wheel', 'clear-wheel', 'reset-wheel', 'undo-wheel']
      .map(get).filter(button => !button.disabled && button !== pauseButton);
    get('finish').disabled = true;
    for (const button of buttons) button.disabled = true;
    try { await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'The action could not finish.';
      if (get('share-dialog').open) sharing.error(message);
      else showError(message);
      if (panel.dataset.state === 'pending') {
        if (session) render(session, true);
        else {
          delete panel.dataset.state;
          direction = 1;
          updatePreview(wheelLabels);
        }
      }
    }
    finally {
      playing = false;
      presetBar.inert = false;
      get('finish').disabled = !session?.rounds.length;
      if (draftBusy) {
        setup.inert = false;
        bestOf.disabled = Boolean(session) || Boolean(currentId || example);
      }
      for (const button of buttons) button.disabled = false;
      get('share').disabled = !session && Boolean(currentId || example || get('spin-now').disabled);
      syncHub();
    }
  }

  function armSound() {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!sound || !Audio) return;
    try {
      audio ??= new Audio();
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
    } catch {}
  }

  function soundButton() {
    get('sound').setAttribute('aria-pressed', String(sound));
    get('sound-label').textContent = sound ? 'Sound on' : 'Sound off';
    get('sound-on').toggleAttribute('hidden', !sound);
    get('sound-off').toggleAttribute('hidden', sound);
  }
  soundButton();

  const tick = strength => { if (sound && audio?.state === 'running') spinClick(audio, audio.destination, strength); };
  const celebrate = () => {
    panel.setAttribute('data-celebrate', '');
    chime();
  };
  const chime = () => { if (sound && audio?.state === 'running') spinChime(audio); };

  function animate(next, last, spinDirection = 1) {
    const choices = next.config.entries;
    const target = winnerAngle(last.winner, choices.length);
    if (reduced.matches) {
      angle = target;
      paintSpinWheel(ctx, choices, angle, { winner: last.winner });
      return Promise.resolve();
    }
    const start = angle;
    const distance = spinDistance(start, target, spinDirection);
    const at = performance.now();
    let lastTooth = spinDetent(start, choices.length);
    let lastClick = at - 80;
    let lastKnock = at - 90;
    panel.dataset.state = 'spinning';
    get('result-label').textContent = last.tieBreak ? 'Tie-break spin' : 'Wheel spinning';
    showResult('Round and round…');
    return new Promise(resolve => {
      function frame(now) {
        const fraction = Math.min((now - at) / spinDuration, 1);
        const rotation = spinAngleAt(start, distance, fraction);
        const tooth = spinDetent(rotation, choices.length);
        if (tooth !== lastTooth) {
          lastTooth = tooth;
          lastKnock = now;
          if (now - lastClick >= 43) {
            tick(.54 + .46 * fraction);
            lastClick = now;
          }
        }
        const bend = -spinDirection * .23 * Math.max(0, 1 - (now - lastKnock) / 76);
        paintSpinWheel(ctx, choices, rotation, { bend });
        if (fraction < 1) requestAnimationFrame(frame);
        else {
          angle = target;
          paintSpinWheel(ctx, choices, angle, { winner: last.winner });
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  async function startDraw(config, spinImmediately) {
    if (spinImmediately) {
      panel.dataset.state = 'pending';
      get('result-label').textContent = 'Starting a draw';
      showResult('Locking the choices…');
    }
    const created = await request('', config);
    owner = created.owner;
    try { localStorage.setItem(key(created.session.id), owner); } catch {}
    const hasPreviousDraw = Boolean(session);
    example = '';
    history[hasPreviousDraw ? 'pushState' : 'replaceState'](null, '', shareUrl(created.session.id));
    render(created.session, spinImmediately);
    if (spinImmediately) await drawOne();
    if (spinImmediately) focusAction(session.status === 'open' ? 'draw' : 'spin-again');
    else {
      openShare();
      get('copy-link').focus();
    }
  }

  const localEntries = currentId || example ? () => [] : mountSpinEditor(setup, get('spin-now'), updatePreview);
  const draftConfig = () => validateSpinConfig({ question: question.value, entries: localEntries(), bestOf: Number(bestOf.value) });
  function openShare() {
    const config = session?.config ?? draftConfig();
    if (!config) {
      showError(`Add a question and 2–${spinChoiceLimit} distinct choices to share this wheel.`);
      return;
    }
    sharing.open({
      session, link: session ? shareUrl(session.id) : templateLink(config),
      question: config.question, isDraft: !session,
    });
  }
  get('share').addEventListener('click', openShare);
  setup.addEventListener('submit', event => {
    event.preventDefault();
    armSound();
    void perform(async () => {
      const config = draftConfig();
      if (!config) throw new Error(`Use a question, 2–${spinChoiceLimit} distinct choices, and choose a spin mode.`);
      await startDraw(config, event.submitter === get('spin-now'));
    });
  });
  get('spin-again').addEventListener('click', () => {
    armSound();
    void perform(() => startDraw(session.config, true));
  });
  const wheelTap = get('wheel-tap');
  hub.addEventListener('click', activateWheel);
  let gesture;
  let suppressPointerClick = false;
  const bearingAt = (event, rect) => Math.atan2(event.clientY - rect.y - rect.height / 2, event.clientX - rect.x - rect.width / 2);
  wheelTap.addEventListener('pointerdown', event => {
    if (event.isPrimary) suppressPointerClick = false;
    const control = spinControl();
    if (event.target === hub || !event.isPrimary || event.button !== 0 || !control || control.disabled || control === get('stage-replay') || reduced.matches) return;
    const rect = wheelTap.getBoundingClientRect();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, angle, delta: 0, bearing: bearingAt(event, rect), rect, moved: false };
    wheelTap.setPointerCapture(event.pointerId);
  });
  wheelTap.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 12) return;
    gesture.moved = true;
    const bearing = bearingAt(event, gesture.rect);
    const shift = bearing - gesture.bearing;
    gesture.bearing = bearing;
    gesture.delta += Math.atan2(Math.sin(shift), Math.cos(shift));
    angle = (gesture.angle + gesture.delta) % turn;
    paintSpinWheel(ctx, wheelLabels, angle);
  });
  wheelTap.addEventListener('pointercancel', cancelFlick);
  wheelTap.addEventListener('lostpointercapture', cancelFlick);
  function cancelFlick(event) {
    if (gesture?.id !== event.pointerId) return;
    angle = gesture.angle;
    gesture = undefined;
    paintSpinWheel(ctx, wheelLabels, angle);
  }
  wheelTap.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const { moved, delta, angle: start } = gesture;
    gesture = undefined;
    if (!moved) return;
    suppressPointerClick = true;
    if (Math.abs(delta) < .13) {
      angle = start;
      paintSpinWheel(ctx, wheelLabels, angle);
      return;
    }
    direction = delta < 0 ? -1 : 1;
    activateWheel();
  });
  wheelTap.addEventListener('click', event => {
    if (event.target === hub) return;
    if (suppressPointerClick) {
      suppressPointerClick = false;
      return;
    }
    activateWheel();
  });
  window.addEventListener('popstate', () => location.reload());

  async function drawOne() {
    const previous = session;
    const spinDirection = direction;
    direction = 1;
    panel.dataset.state = 'pending';
    get('result-label').textContent = previous.tieBreak ? 'Tie-break spin' : 'Starting the spin';
    showResult('Picking a winner…');
    const { session: next } = await request(previous.id, { owner, revision: previous.revision, action: 'spin' });
    if (next.status === 'open' && next.revision === previous.revision) throw new Error('The round did not advance. Refresh the result before trying again.');
    const advanced = next.rounds.length > previous.rounds.length;
    if (advanced) await animate(next, next.rounds.at(-1), spinDirection);
    render(next);
    if (advanced && next.status === 'completed') celebrate();
  }

  get('draw').addEventListener('click', () => {
    armSound();
    void perform(async () => {
      await drawOne();
      focusAction(session.status === 'open' ? 'draw' : 'spin-again');
    });
  });
  get('auto').addEventListener('click', () => {
    if (automatic) {
      automatic = false;
      get('auto').textContent = 'Pausing…';
      get('auto').disabled = true;
      return;
    }
    if (playing) return;
    armSound();
    automatic = true;
    get('auto').textContent = 'Pause series';
    void perform(async () => {
      try {
        while (automatic && session.status === 'open') await drawOne();
      } finally {
        automatic = false;
        get('auto').textContent = 'Run series';
        get('auto').disabled = false;
        if (session.status !== 'open') focusAction('spin-again');
      }
    });
  });
  get('finish').addEventListener('click', () => void perform(async () => {
    const next = (await request(session.id, { owner, revision: session.revision, action: 'finish' })).session;
    render(next);
    if (next.status === 'open') throw new Error('The tally changed. Review it and finish the session again.');
    if (next.winner >= 0) celebrate();
    else chime();
    focusAction('share');
  }));
  get('abandon').addEventListener('click', () => {
    if (!confirm('Abandon this session? The seed will be revealed and this wheel cannot spin again.')) return;
    void perform(async () => render((await request(session.id, { owner, revision: session.revision, action: 'abandon' })).session));
  });
  get('refresh').addEventListener('click', () => void perform(async () => render((await request(session.id)).session)));
  get('sound').addEventListener('click', () => {
    sound = !sound;
    try { localStorage.setItem('composer-spin-sound', sound ? 'on' : 'off'); } catch {}
    soundButton();
    if (sound) {
      armSound();
      if (audio?.state === 'suspended') void audio.resume().then(tick).catch(() => {});
      else tick();
    }
  });
  get('edit-choices')?.addEventListener('click', () => {
    const heading = root.querySelector('#spin-choices');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start' });
  });

  function openPreset(id) {
    if ((!session && !currentId && !example) || !Object.hasOwn(spinPresetById, id)) return;
    const url = new URL(root.dataset.spinPath, location.origin);
    if (id !== spinDefaultPreset) url.searchParams.set('preset', id);
    location.assign(url);
  }
  presetBar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) openPreset(button.hasAttribute('data-quick-chains') ? spinDefaultPreset : button.dataset.quickPreset);
  });
  get('preset-picker').addEventListener('change', event => openPreset(event.currentTarget.value));
  get('clear-wheel').addEventListener('click', () => openPreset('custom'));
  get('reset-wheel').addEventListener('click', () => openPreset(spinDefaultPreset));
  function replayLast() {
    armSound();
    void perform(async () => {
      const next = session;
      const last = next.rounds.at(-1);
      await animate(next, last);
      if (last.winner !== next.winner) {
        get('result-label').textContent = 'Last recorded spin';
        showResult(next.config.entries[last.winner]);
        await new Promise(resolve => setTimeout(resolve, 650));
      }
      render(next);
      if (next.status === 'completed' && next.winner >= 0) celebrate();
    });
  }
  get('stage-replay').addEventListener('click', replayLast);
  get('replay-last').addEventListener('click', replayLast);
  get('replay-series').addEventListener('click', () => {
    armSound();
    void perform(async () => {
      const next = session;
      angle = 0;
      for (const round of next.config.bestOf === openSpinMode ? next.rounds.slice(-3) : next.rounds) {
        await animate(next, round);
        showResult(`Round ${round.index + 1}: ${next.config.entries[round.winner]}`);
        await new Promise(resolve => setTimeout(resolve, reduced.matches ? 550 : 410));
      }
      render(next);
      if (next.status === 'completed' && next.winner >= 0) celebrate();
    });
  });
  if (example) {
    showResult('Opening example…');
    void perform(async () => render(await readSpinExample(example)));
  } else if (currentId) {
    showResult('Opening session…');
    try { owner = localStorage.getItem(key(currentId)) || ''; } catch {}
    void perform(async () => {
      try { render((await request(currentId)).session); }
      catch (error) {
        showResult('Session unavailable');
        get('start-over').hidden = false;
        throw error;
      }
    });
  }
}
