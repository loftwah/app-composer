import { mountSpinEditor, nearbySearch } from './spin-editor.mjs';
import { renderSpinPng, renderSpinVideo, replayVideoType, winnerAngle } from './spin-export.mjs';
import { winnerArtwork } from './spin-winner-art.mjs';
import { spinOrigin } from '../lib/spin-site.mjs';
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
  const key = id => 'composer-spin-owner:' + id;
  const colors = ['#ff946b', '#ffe0a5', '#4eb8aa', '#c9acf0', '#f395b4', '#b7ce78', '#92d2f2'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = Math.PI * 2;
  let session;
  let owner = '';
  let playing = false;
  let sound = false;
  let automatic = false;
  let audio;
  let angle = 0;

  const showError = message => { get('error').textContent = message; };
  const showResult = message => { get('result').textContent = message; };
  const rules = config => config.entries.length === 2
    ? `First to ${Math.floor(config.bestOf / 2) + 1} wins. Each round draws from both choices.`
    : `Play ${config.bestOf} counted spins. Tied leaders get a final spin. Each counted spin starts with all choices.`;
  const templateLink = config => spinOrigin + '/#' + new URLSearchParams({ wheel: JSON.stringify(config) });
  const shareUrl = id => new URL(root.dataset.spinPath + '?session=' + encodeURIComponent(id), location.origin).href;

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
    context.clearRect(0, 0, context.canvas.width, canvas.height);
    context.save();
    context.translate(center, center);
    context.rotate(offset - Math.PI / 2 - step / 2);
    choices.forEach((label, index) => {
      context.save();
      context.rotate(index * step);
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, center - 14, 0, step);
      context.closePath();
      context.fillStyle = colors[index % colors.length];
      context.fill();
      context.strokeStyle = '#211521';
      context.lineWidth = 3;
      context.stroke();
      context.rotate(step / 2);
      context.fillStyle = '#15161a';
      context.font = '700 20px system-ui';
      const facingLeft = Math.cos(offset - Math.PI / 2 + index * step) < -.01;
      if (facingLeft) context.rotate(Math.PI);
      context.textAlign = facingLeft ? 'left' : 'right';
      context.fillText(choices.length > 12 ? String(index + 1) : fit(context, label, 164),
        (center - 43) * (facingLeft ? -1 : 1), 7);
      context.restore();
    });
    context.restore();
    context.beginPath();
    context.arc(center, center, 37, 0, tau);
    context.fillStyle = '#17181b';
    context.fill();
    context.strokeStyle = '#fff0dc';
    context.lineWidth = 4;
    context.stroke();
  }

  function updatePreview(labels) {
    const best = Number(bestOf.value);
    get('rules').textContent = rules({ entries: labels, bestOf: Number.isInteger(best) && best > 0 ? best : 1 });
    if (!session) drawWheel(labels);
  }

  function render(next) {
    const firstRender = !session;
    session = next;
    get('spin-heading').textContent = next.status === 'open' ? 'Spin the wheel.' : 'Spin replay';
    get('spin-intro').textContent = next.status === 'open' ? 'Your choices and series rules are locked.' : 'Watch the recorded wheel and check the result.';
    if (get('spin-guide')) get('spin-guide').hidden = true;
    if (firstRender) get('score-details').open = next.config.entries.length <= 6;
    setup.hidden = true;
    get('session').hidden = false;
    get('question').textContent = next.config.question;
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
    get('expiry').textContent = 'Available until ' + new Date(next.expiresAt).toLocaleDateString('en-AU') + '.';
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
    if (next.status !== 'open') {
      try { localStorage.removeItem(key(next.id)); } catch {}
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

  function tick() {
    if (!sound || !audio || audio.state !== 'running') return;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = 410;
    gain.gain.setValueAtTime(.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .06);
    tone.connect(gain).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + .07);
  }

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
    showResult('Spinning…');
    return new Promise(resolve => {
      function frame(now) {
        const fraction = Math.min((now - at) / 1250, 1);
        const rotation = start + distance * (1 - (1 - fraction) ** 4);
        drawWheel(choices, rotation);
        const current = Math.floor(rotation / (tau / choices.length));
        if (current !== segment) { segment = current; tick(); }
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

  const localEntries = currentId ? () => [] : mountSpinEditor(setup, updatePreview);
  setup.addEventListener('submit', event => {
    event.preventDefault();
    void perform(async () => {
      const config = validateSpinConfig({ question: question.value, entries: localEntries(), bestOf: Number(bestOf.value) });
      if (!config) throw new Error(`Use a question, 2–${spinChoiceLimit} distinct choices, and an odd best-of length from 1 to 21.`);
      const created = await request('', config);
      owner = created.owner;
      try { localStorage.setItem(key(created.session.id), owner); } catch {}
      history.replaceState(null, '', shareUrl(created.session.id));
      render(created.session);
      get('share').focus();
    });
  });

  async function drawOne() {
    const previous = session;
    const { session: next } = await request(previous.id, { owner, revision: previous.revision, action: 'spin' });
    if (next.status === 'open' && next.revision === previous.revision) throw new Error('The round did not advance. Refresh the result before trying again.');
    if (next.rounds.length > previous.rounds.length) await animate(next, next.rounds.at(-1));
    render(next);
  }

  get('draw').addEventListener('click', () => void perform(async () => {
    await drawOne();
    (session.status === 'open' ? get('draw') : get('replay')).focus();
  }));
  get('auto').addEventListener('click', () => {
    if (automatic) {
      automatic = false;
      get('auto').textContent = 'Spin full series';
      return;
    }
    if (playing) return;
    automatic = true;
    get('auto').textContent = 'Pause after this spin';
    void perform(async () => {
      try {
        while (automatic && session.status === 'open') await drawOne();
      } finally {
        automatic = false;
        get('auto').textContent = 'Spin full series';
        if (session.status !== 'open') get('replay').focus();
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
    get('share').textContent = 'Session link copied';
  }));
  get('copy-template').addEventListener('click', () => void perform(async () => {
    if (!navigator.clipboard) throw new Error('Open “Use these choices” and copy from the new wheel.');
    await navigator.clipboard.writeText(templateLink(session.config));
    get('copy-template').textContent = 'Wheel link copied';
  }));
  get('native-share').addEventListener('click', () => void perform(async () => {
    try { await navigator.share({ title: session.config.question, url: shareUrl(session.id) }); }
    catch (error) { if (error?.name !== 'AbortError') throw error; }
  }));
  get('sound').addEventListener('click', async event => {
    sound = !sound;
    event.currentTarget.setAttribute('aria-pressed', String(sound));
    if (sound && typeof AudioContext !== 'undefined') {
      audio ??= new AudioContext();
      await audio.resume().catch(() => {});
    }
  });
  get('replay').addEventListener('click', () => void perform(async () => {
    const next = session;
    await animate(next, next.rounds.at(-1));
    render(next);
  }));
  get('replay-series').addEventListener('click', () => void perform(async () => {
    const next = session;
    angle = 0;
    for (const round of next.rounds) {
      await animate(next, round);
      showResult(`Round ${round.index + 1}: ${next.config.entries[round.winner]}`);
      await new Promise(resolve => setTimeout(resolve, reduced.matches ? 550 : 410));
    }
    render(next);
  }));
  for (const [control, style] of [['png', 'square'], ['portrait', 'portrait'], ['story', 'story'], ['landscape', 'landscape']]) {
    get(control).addEventListener('click', () => void perform(() => makePng(style)));
  }
  get('replay-video').addEventListener('click', () => void perform(async () => {
    get('export-status').textContent = 'Making the replay video…';
    try {
      const video = await renderSpinVideo(session, shareUrl(session.id), drawWheel, reduced.matches);
      download(video.blob, `spin-${session.id.slice(0, 8)}-replay.${video.extension}`);
      get('export-status').textContent = 'Replay video downloaded.';
    } catch (error) {
      get('export-status').textContent = '';
      throw error;
    }
  }));
  get('receipt').addEventListener('click', () => {
    download(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }), 'spin-' + session.id + '.json');
  });

  if (currentId) {
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
