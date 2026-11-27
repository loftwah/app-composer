import { mountSpinEditor, nearbySearch } from './spin-editor.mjs';
import { renderSpinPng, renderSpinVideo, replayVideoType, winnerAngle } from './spin-export.mjs';
import { spinClick, spinChime } from './spin-audio.mjs';
import { winnerArtwork } from './spin-winner-art.mjs';
import { readSpinExample } from '../lib/spin-examples.mjs';
import { spinDiscovery, spinOrigin } from '../lib/spin-site.mjs';
import { spinPresetById } from '../lib/spin-presets.mjs';
import { spinChoiceLimit, spinProgress, validateSpinConfig, verifySpin } from '../lib/spin-protocol.mjs';

const root = document.querySelector('[data-spin]');
if (root) mount(root);

function mount(root) {
  const get = name => root.querySelector('[data-' + name + ']');
  const canvas = get('wheel');
  const ctx = canvas.getContext('2d');
  const setup = get('setup');
  const { question, bestOf } = setup.elements;
  const currentId = new URL(location.href).searchParams.get('session');
  let example = root.dataset.spinExample;
  const key = id => 'composer-spin-owner:' + id;
  const markRing = new Path2D('M18 1a18 18 0 1 1-19-19');
  const markPointer = new Path2D('m4-19 15 1-1 15-7-7z');
  const colors = ['#fc5b05', '#faf9f7', '#c8b9a7', '#e4d9ca', '#e7ad89', '#f2e5da'];
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

  const showError = message => { get('error').textContent = message; };
  const showResult = message => {
    const status = get('result');
    if (status.textContent !== message) status.textContent = message;
  };
  const focusAction = name => requestAnimationFrame(() => get(name).focus({ preventScroll: true }));
  const rules = config => config.bestOf === 1 ? 'One spin. Every enabled choice has equal odds.' :
    config.entries.length === 2
    ? `First to ${Math.floor(config.bestOf / 2) + 1} wins. Each round draws from both choices.`
    : `Play ${config.bestOf} counted spins. Tied leaders get a final spin. Each counted spin starts with all choices.`;
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
    context.fillStyle = '#17181b';
    context.fill();
    context.strokeStyle = '#887f74';
    context.lineWidth = 2;
    context.stroke();

    for (let tick = 0; tick < 72; tick++) {
      const bearing = offset + tick * tau / 72;
      const inside = center - (tick % 6 === 0 ? 32 : 26);
      const outside = center - 17;
      context.beginPath();
      context.moveTo(Math.cos(bearing) * inside, Math.sin(bearing) * inside);
      context.lineTo(Math.cos(bearing) * outside, Math.sin(bearing) * outside);
      context.strokeStyle = tick % 6 === 0 ? '#faf9f7' : '#a69b8e';
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
      context.fillStyle = colors[index % colors.length];
      context.fill();
      context.strokeStyle = '#17181b';
      context.lineWidth = 3;
      context.stroke();

      const radius = choices.length < 5 ? disc * .68 : disc * .75;
      context.save();
      context.translate(Math.cos(bearing) * radius, Math.sin(bearing) * radius);
      if (choices.length > 6 && choices.length <= 12) {
        context.rotate(Math.cos(bearing) < 0 ? bearing + Math.PI : bearing);
      }
      context.fillStyle = '#17181b';
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
    context.arc(0, 0, 59, 0, tau);
    context.fillStyle = '#17181b';
    context.fill();
    context.strokeStyle = '#faf9f7';
    context.lineWidth = 3;
    context.stroke();
    const markScale = 1.5;
    context.save();
    context.scale(markScale, markScale);
    context.strokeStyle = '#faf9f7';
    context.lineCap = 'round';
    context.lineWidth = 5;
    context.stroke(markRing);
    context.fillStyle = '#fc5b05';
    context.fill(markPointer);
    context.fillStyle = '#faf9f7';
    context.beginPath();
    context.arc(0, 0, 4.5, 0, tau);
    context.fill();
    context.restore();
    context.restore();
  }

  function updatePreview(labels, foodIdeas) {
    if (get('find-ideas')) get('find-ideas').hidden = !foodIdeas;
    const best = Number(bestOf.value);
    get('rules').textContent = rules({ entries: labels, bestOf: Number.isInteger(best) && best > 0 ? best : 1 });
    if (!session) {
      get('spin-heading').textContent = question.value.trim() || 'What should we pick?';
      drawWheel(labels);
      showResult(labels.length >= 2 ? `${labels.length} choices on the wheel` : 'Enable two choices to spin.');
    }
  }

  function render(next) {
    const firstRender = !session || session.id !== next.id;
    session = next;
    get('spin-heading').textContent = next.config.question;
    const showingExample = Boolean(example);
    get('spin-intro').hidden = !showingExample;
    get('spin-intro').textContent = showingExample ? 'Recorded draw' : '';
    get('share').hidden = false;
    get('share').setAttribute('aria-label', next.status === 'completed' ? 'Copy result link' : 'Copy draw link');
    get('share-label').textContent = 'Copy link';
    get('spin-again').hidden = next.status === 'open';
    if (firstRender) get('export-status').textContent = '';
    if (get('spin-guide')) get('spin-guide').hidden = true;
    if (firstRender) get('score-details').open = next.config.entries.length <= 6;
    setup.hidden = true;
    if (get('spin-presets')) get('spin-presets').hidden = true;
    if (get('find-ideas')) get('find-ideas').hidden = true;
    get('spin-now').hidden = true;
    get('wheel-panel').dataset.state = next.status;
    get('session').hidden = false;
    const series = next.status === 'open' && next.tieBreak ? 'The next spin is a tie-break.' : rules(next.config);
    get('series').textContent = `${series} ${next.rounds.length} ${next.rounds.length === 1 ? 'spin' : 'spins'} recorded.`;
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
    get('rounds').replaceChildren(...next.rounds.map(round => {
      const li = document.createElement('li');
      li.textContent = `Round ${round.index + 1}${round.tieBreak ? ' · tie-break' : ''} — ${next.config.entries[round.winner]}`;
      return li;
    }));
    get('commitment').textContent = next.commitment;
    get('expiry').textContent = example ? 'Public launch example from a completed session.' :
      'Available until ' + new Date(next.expiresAt).toLocaleDateString('en-AU') + '.';
    get('refresh').hidden = Boolean(example);
    get('draw').hidden = !owner || next.status !== 'open';
    get('auto').hidden = get('draw').hidden || next.config.bestOf === 1;
    get('abandon').hidden = !owner || next.status !== 'open';
    get('exports').hidden = next.status === 'open';
    get('replay').hidden = next.rounds.length === 0;
    get('replay-series').hidden = next.rounds.length < 2;
    const winner = next.config.entries[next.winner];
    const takeaway = next.status === 'completed' && spinPresetById.takeaway.entries.includes(winner);
    const art = next.status === 'completed' ? winnerArtwork(winner) : '';
    const artwork = get('winner-art').querySelector('img');
    get('winner-art').hidden = !takeaway && !art;
    artwork.hidden = !art;
    if (art) artwork.src = art;
    get('nearby').hidden = !takeaway;
    if (takeaway) get('nearby').href = nearbySearch(winner);
    get('remix').href = templateLink(next.config);
    get('png').hidden = next.status !== 'completed';
    get('portrait').hidden = next.status !== 'completed';
    get('story').hidden = next.status !== 'completed';
    get('landscape').hidden = next.status !== 'completed';
    get('replay-video').hidden = next.status !== 'completed' || !replayVideoType();
    get('native-share').hidden = typeof navigator.share !== 'function';
    const last = next.rounds.at(-1);
    angle = last ? winnerAngle(last.winner, next.config.entries.length) : 0;
    drawWheel(next.config.entries);
    showResult(next.status === 'completed' ? next.config.entries[next.winner] + ' wins!' :
      next.status === 'abandoned' ? 'Session abandoned' :
        last ? 'Round ' + (last.index + 1) + ': ' + next.config.entries[last.winner] :
          'Wheel locked. Share the link before spinning.');
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
    const buttons = [...root.querySelectorAll('button')].filter(button => !button.disabled && !button.hasAttribute('data-auto'));
    for (const button of buttons) button.disabled = true;
    try { await action(); }
    catch (error) { showError(error instanceof Error ? error.message : 'The action could not finish.'); }
    finally {
      playing = false;
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
    showResult('Spinning…');
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

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function makePng(style) {
    const blob = await renderSpinPng(session, shareUrl(session.id), style, drawWheel);
    download(blob, `spin-${session.id.slice(0, 8)}-${style}.png`);
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
    focusAction(spinImmediately && session.status === 'open' ? 'draw' : spinImmediately ? 'spin-again' : 'share');
  }

  const localEntries = currentId || example ? () => [] : mountSpinEditor(setup, get('spin-now'), updatePreview);
  setup.addEventListener('submit', event => {
    event.preventDefault();
    armSound();
    void perform(async () => {
      const config = validateSpinConfig({ question: question.value, entries: localEntries(), bestOf: Number(bestOf.value) });
      if (!config) throw new Error(`Use a question, 2–${spinChoiceLimit} distinct choices, and an odd best-of length from 1 to 21.`);
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
      get('auto').textContent = 'Spin full series';
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
        if (session.status !== 'open') focusAction('spin-again');
      }
    });
  });
  get('abandon').addEventListener('click', () => {
    if (!confirm('Abandon this session? The seed will be revealed and this wheel cannot spin again.')) return;
    void perform(async () => render((await request(session.id, { owner, revision: session.revision, action: 'abandon' })).session));
  });
  get('refresh').addEventListener('click', () => void perform(async () => render((await request(session.id)).session)));
  get('share').addEventListener('click', () => void perform(async () => {
    if (!navigator.clipboard) throw new Error('Copy the session link from the address bar.');
    await navigator.clipboard.writeText(shareUrl(session.id));
    get('share-label').textContent = 'Link copied';
    get('share').setAttribute('aria-label', 'Link copied');
    const copiedId = session.id;
    setTimeout(() => {
      if (session.id !== copiedId) return;
      get('share').setAttribute('aria-label', session.status === 'completed' ? 'Copy result link' : 'Copy draw link');
      get('share-label').textContent = 'Copy link';
    }, 1600);
  }));
  get('copy-template').addEventListener('click', () => void perform(async () => {
    if (!navigator.clipboard) throw new Error('Open “Edit this wheel” to change its choices.');
    await navigator.clipboard.writeText(templateLink(session.config));
    get('copy-template').textContent = 'Wheel link copied';
  }));
  get('native-share').addEventListener('click', () => void perform(async () => {
    try { await navigator.share({ title: session.config.question, url: shareUrl(session.id) }); }
    catch (error) { if (error?.name !== 'AbortError') throw error; }
  }));
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
  get('find-ideas')?.addEventListener('click', () => {
    const heading = root.querySelector('#spin-taste-heading');
    heading.focus({preventScroll: true});
    heading.scrollIntoView({block: 'start'});
  });
  get('share-spin').addEventListener('click', () => void perform(async () => {
    const url = spinOrigin + '/';
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: spinDiscovery.name, url }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    if (!navigator.clipboard) throw new Error('Open the Spin sharing kit to copy the app link.');
    await navigator.clipboard.writeText(url);
    get('share-spin-label').textContent = 'App link copied';
    setTimeout(() => { get('share-spin-label').textContent = 'Share Spin'; }, 1600);
  }));
  get('replay').addEventListener('click', () => {
    armSound();
    void perform(async () => {
      const next = session;
      await animate(next, next.rounds.at(-1));
      if (next.status === 'completed') chime();
      render(next);
    });
  });
  get('replay-series').addEventListener('click', () => {
    armSound();
    void perform(async () => {
      const next = session;
      angle = 0;
      for (const round of next.rounds) {
        await animate(next, round);
        showResult(`Round ${round.index + 1}: ${next.config.entries[round.winner]}`);
        await new Promise(resolve => setTimeout(resolve, reduced.matches ? 550 : 410));
      }
      if (next.status === 'completed') chime();
      render(next);
    });
  });
  for (const [control, style] of [['png', 'square'], ['portrait', 'portrait'], ['story', 'story'], ['landscape', 'landscape']]) {
    get(control).addEventListener('click', () => void perform(() => makePng(style)));
  }
  get('replay-video').addEventListener('click', () => {
    armSound();
    void perform(async () => {
      get('export-status').textContent = 'Making the replay video…';
      try {
        const video = await renderSpinVideo(session, shareUrl(session.id), drawWheel, reduced.matches, sound ? audio : undefined);
        download(video.blob, `spin-${session.id.slice(0, 8)}-replay.${video.extension}`);
        get('export-status').textContent = 'Replay video downloaded.';
      } catch (error) {
        get('export-status').textContent = '';
        throw error;
      }
    });
  });
  get('receipt').addEventListener('click', () => {
    download(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }), 'spin-' + session.id + '.json');
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
