import { spinProgress, validateSpinConfig, verifySpin } from '../lib/spin-protocol.mjs';

const root = document.querySelector('[data-spin]');
if (root) mount(root);

function mount(root) {
  const get = name => root.querySelector('[data-' + name + ']');
  const canvas = get('wheel');
  const ctx = canvas.getContext('2d');
  const setup = get('setup');
  const { question, entries, bestOf } = setup.elements;
  const currentId = new URL(location.href).searchParams.get('session');
  const key = id => 'composer-spin-owner:' + id;
  const colors = ['#ff7434', '#e8c657', '#61c2ab', '#8da9f9', '#f088ae', '#b5cb64'];
  const presets = {
    dinner: ['What’s for dinner?', ['Pizza', 'Thai', 'Tacos', 'Burgers']],
    game: ['What should we play?', ['Codenames', 'Mario Kart', 'Jackbox', 'Chess']],
    yes: ['Should we do it?', ['Yes', 'No']],
    coin: ['Call it!', ['Heads', 'Tails']],
    first: ['Who goes first?', ['Player one', 'Player two', 'Player three']],
    custom: ['', ['', '']],
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = Math.PI * 2;
  let session;
  let owner = '';
  let playing = false;
  let sound = false;
  let automatic = false;
  let audio;
  let angle = 0;

  const localEntries = () => entries.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const showError = message => { get('error').textContent = message; };
  const showResult = message => { get('result').textContent = message; };
  const rules = config => config.entries.length === 2
    ? `First to ${Math.floor(config.bestOf / 2) + 1} wins. Each round draws from both choices.`
    : `Play ${config.bestOf} counted spins. Tied leaders get a final spin. Each counted spin starts with all choices.`;
  const shareUrl = id => new URL(root.dataset.spinPath + '?session=' + encodeURIComponent(id), location.origin).href;

  function fit(context, value, max) {
    let text = value;
    while (text.length > 1 && context.measureText(text + (text !== value ? '…' : '')).width > max) text = Array.from(text).slice(0, -1).join('');
    return text === value ? text : text + '…';
  }

  function drawWheel(labels, offset = angle) {
    if (!ctx) return;
    const center = canvas.width / 2;
    const choices = labels.length > 1 ? labels : ['Add choices', 'Start a wheel'];
    const step = tau / choices.length;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(offset - Math.PI / 2 - step / 2);
    choices.forEach((label, index) => {
      ctx.save();
      ctx.rotate(index * step);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, center - 14, 0, step);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#17181b';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.rotate(step / 2);
      ctx.fillStyle = '#15161a';
      ctx.font = '700 20px system-ui';
      const facingLeft = Math.cos(offset - Math.PI / 2 + index * step) < -.01;
      if (facingLeft) ctx.rotate(Math.PI);
      ctx.textAlign = facingLeft ? 'left' : 'right';
      ctx.fillText(fit(ctx, label, 164), (center - 43) * (facingLeft ? -1 : 1), 7);
      ctx.restore();
    });
    ctx.restore();
    ctx.beginPath();
    ctx.arc(center, center, 37, 0, tau);
    ctx.fillStyle = '#17181b';
    ctx.fill();
    ctx.strokeStyle = '#fff0dc';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function updatePreview() {
    const labels = localEntries();
    const best = Number(bestOf.value);
    get('rules').textContent = rules({ entries: labels, bestOf: Number.isInteger(best) && best > 0 ? best : 1 });
    if (!session) drawWheel(labels.slice(0, 12));
  }

  function render(next) {
    session = next;
    setup.hidden = true;
    get('session').hidden = false;
    get('question').textContent = next.config.question;
    const series = next.status === 'open' && next.tieBreak ? 'The next spin is a tie-break.' : rules(next.config);
    get('series').textContent = `${series} ${next.rounds.length} ${next.rounds.length === 1 ? 'spin' : 'spins'} recorded.`;
    get('scores').replaceChildren(...next.config.entries.map((label, index) => {
      const item = document.createElement('li');
      if (index === next.winner) item.className = 'winner';
      const name = document.createElement('span');
      name.textContent = label;
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
    get('png').hidden = next.status !== 'completed';
    get('portrait').hidden = next.status !== 'completed';
    get('native-share').hidden = typeof navigator.share !== 'function';
    const last = next.rounds.at(-1);
    angle = last ? -last.winner * tau / next.config.entries.length : 0;
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
    const target = -last.winner * tau / choices.length;
    if (reduced.matches) {
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

  async function makePng(height) {
    const output = document.createElement('canvas');
    output.width = 1080;
    output.height = height;
    const image = output.getContext('2d');
    if (!image) throw new Error('Image export is unavailable.');
    const center = output.width / 2;
    image.fillStyle = '#17181b';
    image.fillRect(0, 0, 1080, height);
    image.textAlign = 'center';
    image.fillStyle = '#ff9b6d';
    image.font = '700 30px system-ui';
    image.fillText('APP COMPOSER SPIN', center, 78);
    image.fillStyle = '#fff6eb';
    image.font = '600 42px system-ui';
    image.fillText(fit(image, session.config.question, 940), center, 153);
    const size = height === 1080 ? 550 : 700;
    image.drawImage(canvas, center - size / 2, 185, size, size);
    image.font = '700 68px system-ui';
    image.fillText(fit(image, session.config.entries[session.winner] + ' wins!', 940), center, size + 272);
    image.font = '600 30px system-ui';
    image.fillText(`Best of ${session.config.bestOf} · ${session.totals.join(' : ')}`, center, size + 330);
    image.font = '400 20px system-ui';
    image.fillText(shareUrl(session.id), center, height - 53);
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image export did not finish.');
    download(blob, 'app-composer-spin-' + session.id.slice(0, 8) + '.png');
  }

  setup.addEventListener('input', updatePreview);
  setup.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    [question.value, entries.value] = [presets[button.dataset.preset][0], presets[button.dataset.preset][1].join('\n')];
    updatePreview();
    if (button.dataset.preset === 'custom') question.focus();
  }));
  setup.addEventListener('submit', event => {
    event.preventDefault();
    void perform(async () => {
      const config = validateSpinConfig({ question: question.value, entries: localEntries(), bestOf: Number(bestOf.value) });
      if (!config) throw new Error('Use a question, 2–12 distinct choices, and an odd best-of length from 1 to 21.');
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
  get('png').addEventListener('click', () => void perform(() => makePng(1080)));
  get('portrait').addEventListener('click', () => void perform(() => makePng(1350)));
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
  } else updatePreview();
}
