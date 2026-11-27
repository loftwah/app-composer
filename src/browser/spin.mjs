import { mountSpinEditor, nearbySearch } from './spin-editor.mjs';
import { winnerAngle } from './spin-export.mjs';
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
  const { question, bestOf } = setup.elements;
  const currentId = new URL(location.href).searchParams.get('session');
  let example = root.dataset.spinExample;
  const key = id => 'composer-spin-owner:' + id;
  const sectors = [
    ['#efff48', '#161349'], ['#ff73bd', '#161349'], ['#3c37dc', '#ffffff'],
    ['#99f0e1', '#161349'], ['#fffaf0', '#161349'], ['#ffad66', '#161349'],
  ];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = Math.PI * 2;
  let session;
  let owner = '';
  let playing = false;
  let sound = true;
  try { sound = localStorage.getItem('composer-spin-sound') !== 'off'; } catch {}
  let automatic = false;
  let audio;
  let angle = 0;
  const sharing = mountSpinShare(get('share-dialog'), drawWheel, () => {
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
    config.bestOf === 1 ? 'One spin decides it. Every choice has equal odds.' :
      config.entries.length === 2 ? `First to ${Math.floor(config.bestOf / 2) + 1} wins the series.` :
        `${config.bestOf} spins. Most wins takes it. Ties get extra spins.`;
  const templateLink = config => spinOrigin + '/#' + new URLSearchParams({ wheel: JSON.stringify(config) });
  const shareUrl = id => example ? spinOrigin + '/?example=' + encodeURIComponent(example) :
    new URL(root.dataset.spinPath + '?session=' + encodeURIComponent(id), location.origin).href;

  function fit(context, value, max) {
    let text = value;
    while (text.length > 1 && context.measureText(text + (text !== value ? '…' : '')).width > max) text = Array.from(text).slice(0, -1).join('');
    return text === value ? text : text + '…';
  }

  function drawWheel(labels, offset = angle, context = ctx) {
    if (!context) return;
    const center = context.canvas.width / 2;
    const choices = labels.length > 1 ? labels : ['Add choices', 'Start a wheel'];
    const step = tau / choices.length;
    const disc = center - 38;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.save();
    context.translate(center, center);

    context.beginPath();
    context.arc(0, 0, center - 11, 0, tau);
    context.fillStyle = '#1f1b93';
    context.fill();
    context.strokeStyle = '#2920a0';
    context.lineWidth = 2;
    context.stroke();

    for (let tick = 0; tick < 72; tick++) {
      const bearing = offset + tick * tau / 72;
      const inside = center - (tick % 6 === 0 ? 32 : 26);
      const outside = center - 17;
      context.beginPath();
      context.moveTo(Math.cos(bearing) * inside, Math.sin(bearing) * inside);
      context.lineTo(Math.cos(bearing) * outside, Math.sin(bearing) * outside);
      context.strokeStyle = tick % 6 === 0 ? '#efff48' : '#9a9af8';
      context.lineWidth = tick % 6 === 0 ? 3 : 1.4;
      context.stroke();
    }

    const labelSize = choices.length < 5 ? 29 : 22;
    choices.forEach((label, index) => {
      const bearing = offset - Math.PI / 2 + index * step;
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, disc, bearing - step / 2, bearing + step / 2);
      context.closePath();
      const [surface, ink] = sectors[index % sectors.length];
      context.fillStyle = surface;
      context.fill();
      context.strokeStyle = '#1f1b93';
      context.lineWidth = 3;
      context.stroke();

      const radius = choices.length < 5 ? disc * .68 : disc * .75;
      context.save();
      context.translate(Math.cos(bearing) * radius, Math.sin(bearing) * radius);
      if (choices.length > 6 && choices.length <= 12) {
        context.rotate(Math.cos(bearing) < 0 ? bearing + Math.PI : bearing);
      }
      context.fillStyle = ink;
      context.font = `750 ${labelSize}px system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const splitAt = label.lastIndexOf(' ');
      if (choices.length <= 4 && splitAt > 0 && context.measureText(label).width > 145) {
        context.fillText(fit(context, label.slice(0, splitAt), 145), 0, -labelSize * .49);
        context.fillText(fit(context, label.slice(splitAt + 1), 145), 0, labelSize * .49);
      } else {
        context.fillText(choices.length > 12 ? String(index + 1) : fit(context, label, choices.length > 6 ? 115 : 160), 0, 0);
      }
      context.restore();
    });

    context.beginPath();
    context.arc(0, 0, 53, 0, tau);
    context.fillStyle = '#1f1b93';
    context.fill();
    context.strokeStyle = '#fffaf0';
    context.lineWidth = 3;
    context.stroke();
    context.save();
    context.rotate(offset);
    context.fillStyle = '#efff48';
    context.beginPath();
    context.moveTo(-27, -13);
    context.lineTo(8, -13);
    context.lineTo(8, -26);
    context.lineTo(30, 0);
    context.lineTo(8, 26);
    context.lineTo(8, 13);
    context.lineTo(-27, 13);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
  }

  function updatePreview(labels) {
    const best = Number(bestOf.value);
    get('rules').textContent = rules({ entries: labels, bestOf: best });
    if (!session) {
      get('spin-heading').textContent = question.value.trim() || 'What should we pick?';
      get('spin-heading').title = get('spin-heading').textContent;
      drawWheel(labels);
      showResult(labels.length >= 2 ? `${labels.length} choices on the wheel` : 'Enable two choices to spin.');
    }
  }

  function render(next) {
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
    get('wheel-panel').dataset.state = next.status;
    get('session').hidden = false;
    get('session-heading').textContent = completed ? 'The result' : 'The draw';
    const countLabel = `${count} ${count === 1 ? 'spin' : 'spins'}`;
    get('series').textContent = `${spinModeLabel(next.config.bestOf)} · ${countLabel} recorded.`;
    get('result-label').textContent = completed ? (next.winner < 0 ? 'Final result' : 'We have a winner') :
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
    angle = settledWinner === undefined ? 0 : winnerAngle(settledWinner, next.config.entries.length);
    drawWheel(next.config.entries);
    showResult(next.status === 'completed' ? (next.winner < 0 ? 'Session ended in a tie' : next.config.entries[next.winner]) :
      next.status === 'abandoned' ? 'Session abandoned' :
        last ? next.config.entries[last.winner] : 'The wheel is locked');
    get('verification').textContent = '';
    if (next.status !== 'open') {
      try { if (!example) localStorage.removeItem(key(next.id)); } catch {}
      get('verification').textContent = 'Checking receipt…';
      void verifySpin(next).then(verified => {
        if (session === next) get('verification').textContent = verified ?
          'Verified against the original commitment.' : 'The receipt does not match its commitment.';
      }).catch(() => {
        if (session === next) get('verification').textContent = 'Could not verify this receipt.';
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
    get('share').disabled = true;
    presetBar.inert = true;
    const pauseButton = automatic ? get('auto') : null;
    const draftBusy = !session;
    if (draftBusy) {
      setup.inert = true;
      bestOf.disabled = true;
    }
    const buttons = ['spin-now', 'draw', 'spin-again', 'stage-replay', 'auto', 'abandon', 'refresh', 'replay-last', 'replay-series', 'lock-wheel']
      .map(get).filter(button => !button.disabled && button !== pauseButton);
    get('finish').disabled = true;
    for (const button of buttons) button.disabled = true;
    try { await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'The action could not finish.';
      if (get('share-dialog').open) sharing.error(message);
      else showError(message);
    }
    finally {
      playing = false;
      presetBar.inert = false;
      get('finish').disabled = !session?.rounds.length;
      get('share').disabled = !session && Boolean(currentId || example);
      if (draftBusy) {
        setup.inert = false;
        bestOf.disabled = Boolean(session) || Boolean(currentId || example);
      }
      for (const button of buttons) button.disabled = false;
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

  const tick = () => { if (sound && audio?.state === 'running') spinClick(audio); };
  const chime = () => { if (sound && audio?.state === 'running') spinChime(audio); };

  function animate(next, last) {
    const choices = next.config.entries;
    const target = winnerAngle(last.winner, choices.length);
    if (reduced.matches) {
      angle = target;
      drawWheel(choices, target);
      return Promise.resolve();
    }
    const start = angle;
    const distance = (target - start + 8 * tau) % tau + 4 * tau;
    const at = performance.now();
    let segment = -1;
    let lastTick = at - 120;
    get('wheel-panel').dataset.state = 'spinning';
    get('result-label').textContent = 'On the wheel';
    showResult('Round and round…');
    return new Promise(resolve => {
      function frame(now) {
        const fraction = Math.min((now - at) / 1250, 1);
        const rotation = start + distance * (1 - (1 - fraction) ** 4);
        drawWheel(choices, rotation);
        const current = Math.floor(rotation / (tau / choices.length));
        if (current !== segment && now - lastTick > 45) {
          segment = current;
          lastTick = now;
          tick();
        }
        if (fraction < 1) requestAnimationFrame(frame);
        else { angle = target; resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  async function startDraw(config, spinImmediately) {
    const created = await request('', config);
    owner = created.owner;
    try { localStorage.setItem(key(created.session.id), owner); } catch {}
    const hasPreviousDraw = Boolean(session);
    example = '';
    history[hasPreviousDraw ? 'pushState' : 'replaceState'](null, '', shareUrl(created.session.id));
    render(created.session);
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
  get('wheel-tap').addEventListener('click', () => {
    const button = get(session ? 'draw' : 'spin-now');
    if (!button.hidden && !button.disabled) button.click();
  });
  window.addEventListener('popstate', () => location.reload());

  async function drawOne() {
    const previous = session;
    const { session: next } = await request(previous.id, { owner, revision: previous.revision, action: 'spin' });
    if (next.status === 'open' && next.revision === previous.revision) throw new Error('The round did not advance. Refresh the result before trying again.');
    if (next.rounds.length > previous.rounds.length) await animate(next, next.rounds.at(-1));
    if (next.rounds.length > previous.rounds.length && next.status === 'completed') chime();
    render(next);
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
    get('auto').textContent = 'Pause after this spin';
    void perform(async () => {
      try {
        while (automatic && session.status === 'open') await drawOne();
      } finally {
        automatic = false;
        get('auto').textContent = 'Spin full series';
        get('auto').disabled = false;
        if (session.status !== 'open') focusAction('spin-again');
      }
    });
  });
  get('finish').addEventListener('click', () => void perform(async () => {
    const next = (await request(session.id, { owner, revision: session.revision, action: 'finish' })).session;
    render(next);
    if (next.status === 'open') throw new Error('The tally changed. Review it and finish the session again.');
    chime();
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
      if (next.status === 'completed') chime();
      render(next);
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
      if (next.status === 'completed') chime();
      render(next);
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
