const bytes = new TextEncoder();
export const spinVersion = 'composer.spin/1';
export const spinLifetimeDays = 30;
export const spinChoiceLimit = 32;
export const spinIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const spinSecretPattern = /^[a-f0-9]{64}$/;
const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
const digest = value => crypto.subtle.digest('SHA-256', bytes.encode(value)).then(hex);
export const randomSecret = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const secretHash = (value, id) => digest(JSON.stringify(['spin-control-v1', id, value]));
export const configHash = (id, config) => digest(JSON.stringify(
  [spinVersion, id, config.question, config.entries, config.bestOf],
));
export const seedCommitment = (hash, seed) => digest(JSON.stringify(['spin-commit-v1', hash, seed]));

export function validateSpinConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const { question, entries, bestOf } = input;
  const clean = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
  const plain = value => !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value);
  if (!Array.isArray(entries) || entries.length < 2 || entries.length > spinChoiceLimit ||
      !Number.isInteger(bestOf) || bestOf < 1 || bestOf > 21 || bestOf % 2 !== 1) return null;
  const title = clean(question);
  const labels = entries.map(clean);
  if (!title || title.length > 100 || !plain(title) ||
      labels.some(label => !label || label.length > 56 || !plain(label)) ||
      new Set(labels.map(label => label.toLocaleLowerCase('en-AU'))).size !== labels.length) return null;
  return { question: title, entries: labels, bestOf };
}

export function spinProgress(config, rounds) {
  const totals = config.entries.map(() => 0);
  for (const round of rounds) totals[round.winner]++;
  const leaders = totals.map((_, index) => index).filter(index => totals[index] === Math.max(...totals));
  const eligible = config.entries.map((_, index) => index);
  if (eligible.length === 2) {
    const winner = totals.findIndex(score => score > config.bestOf / 2);
    return { totals, eligible, winner, tieBreak: false };
  }
  const counted = rounds.length >= config.bestOf;
  return {
    totals,
    eligible: counted ? leaders : eligible,
    winner: counted && leaders.length === 1 ? leaders[0] : -1,
    tieBreak: counted && leaders.length > 1,
  };
}

export function unbiasedIndex(word, length) {
  const bound = 2 ** 32 - (2 ** 32 % length);
  return word < bound ? word % length : -1;
}

export async function spinRound(seed, hash, config, rounds) {
  const progress = spinProgress(config, rounds);
  if (progress.winner >= 0) throw new Error('The series is complete.');
  const index = rounds.length;
  const key = await crypto.subtle.importKey('raw', bytes.encode(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (let retry = 0; retry < 64; retry++) {
    const message = bytes.encode(JSON.stringify(['spin-round-v1', hash, index, retry]));
    const word = new DataView(await crypto.subtle.sign('HMAC', key, message)).getUint32(0);
    const selected = unbiasedIndex(word, progress.eligible.length);
    if (selected >= 0) {
      return {
        index, winner: progress.eligible[selected], eligible: progress.eligible, tieBreak: progress.tieBreak,
      };
    }
  }
  throw new Error('The draw could not be derived.');
}

export async function verifySpin(receipt) {
  if (receipt?.version !== spinVersion || !spinIdPattern.test(receipt.id) ||
      !['completed', 'abandoned'].includes(receipt.status) ||
      !spinSecretPattern.test(receipt.seed) || !Array.isArray(receipt.rounds) ||
      receipt.rounds.length > 22) return false;
  const config = validateSpinConfig(receipt.config);
  if (!config || JSON.stringify(config) !== JSON.stringify(receipt.config)) return false;
  const hash = await configHash(receipt.id, config);
  if (hash !== receipt.configHash || await seedCommitment(hash, receipt.seed) !== receipt.commitment) return false;
  const replay = [];
  for (const stored of receipt.rounds) {
    if (spinProgress(config, replay).winner >= 0) return false;
    const expected = await spinRound(receipt.seed, hash, config, replay);
    if (!stored || stored.index !== expected.index || stored.winner !== expected.winner ||
        stored.tieBreak !== expected.tieBreak ||
        JSON.stringify(stored.eligible) !== JSON.stringify(expected.eligible)) return false;
    replay.push(expected);
  }
  const progress = spinProgress(config, replay);
  return receipt.winner === progress.winner &&
    JSON.stringify(receipt.totals) === JSON.stringify(progress.totals) &&
    (receipt.status === 'completed') === (progress.winner >= 0);
}
