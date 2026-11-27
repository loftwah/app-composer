import type { D1Database } from '@cloudflare/workers-types';
import { configHash, openSpinMode, randomSecret, secretHash, seedCommitment, spinLifetimeDays, spinOpenRound, spinProgress, spinRound, spinVersion, validateSpinConfig } from './spin-protocol.mjs';

interface Config { question: string; entries: string[]; bestOf: number }
type SpinAction = 'spin' | 'finish' | 'abandon';
interface OpenRound { round_index: number; winner: number; spun_at: number }
interface Round { index: number; winner: number; eligible: number[]; tieBreak: boolean; at: string }
interface Session {
  id: string; owner_hash: string; seed: string; config: string; config_hash: string;
  commitment: string; rounds: string; status: 'open' | 'completed' | 'abandoned';
  revision: number; created_at: number; expires_at: number;
}

async function publicSession(db: D1Database, row: Session) {
  const config = JSON.parse(row.config) as Config;
  let rounds: Round[] = JSON.parse(row.rounds);
  if (config.bestOf === openSpinMode && row.revision > 0) {
    const { results } = await db.prepare(`SELECT round_index, winner, spun_at
      FROM composer_spin_open_rounds WHERE session_id=? AND round_index<? ORDER BY round_index`)
      .bind(row.id, row.revision).all<OpenRound>();
    const eligible = config.entries.map((_, index) => index);
    rounds = results.map(round => ({
      index: round.round_index, winner: round.winner, eligible, tieBreak: false, at: new Date(round.spun_at).toISOString(),
    }));
  }
  const { totals, winner, tieBreak } = spinProgress(config, rounds, row.status === 'completed');
  return {
    version: spinVersion, id: row.id, config, configHash: row.config_hash, commitment: row.commitment,
    status: row.status, revision: row.revision, rounds, totals, winner, tieBreak, expiresAt: new Date(row.expires_at).toISOString(),
    ...(row.status === 'open' ? {} : { seed: row.seed }),
  };
}

async function find(db: D1Database, id: string, now: number) {
  return db.prepare('SELECT * FROM composer_spin_sessions WHERE id=? AND expires_at>?')
    .bind(id, now).first<Session>();
}

export async function createSpin(db: D1Database, value: unknown, now: number) {
  const config = validateSpinConfig(value);
  if (!config) return null;
  const id = crypto.randomUUID();
  const owner = randomSecret();
  const seed = randomSecret();
  const [hash, ownerHash] = await Promise.all([configHash(id, config), secretHash(owner, id)]);
  const commitment = await seedCommitment(hash, seed);
  const expires = now + spinLifetimeDays * 86_400_000;
  const row: Session = {
    id, owner_hash: ownerHash, seed, config: JSON.stringify(config), config_hash: hash, commitment,
    rounds: '[]', status: 'open', revision: 0, created_at: now, expires_at: expires,
  };
  await db.prepare(`INSERT INTO composer_spin_sessions
    (id,owner_hash,seed,config,config_hash,commitment,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(id, ownerHash, seed, row.config, hash, commitment, now, expires).run();
  return { owner, session: await publicSession(db, row) };
}

export async function readSpin(db: D1Database, id: string, now: number) {
  const row = await find(db, id, now);
  return row ? publicSession(db, row) : null;
}

export async function advanceSpin(db: D1Database, id: string, owner: string, revision: number, action: SpinAction, now: number) {
  const row = await find(db, id, now);
  if (!row) return { status: 404 as const };
  if (await secretHash(owner, id) !== row.owner_hash) return { status: 403 as const };
  if (row.status !== 'open' || row.revision !== revision) return { status: 200 as const, session: await publicSession(db, row) };
  const config = JSON.parse(row.config) as Config;
  const open = config.bestOf === openSpinMode;
  if (action === 'finish' && (!open || revision === 0)) return { status: 409 as const };
  if (open && action === 'spin') {
    const round = await spinOpenRound(row.seed, row.config_hash, config.entries, revision);
    // The insert and revision trigger are one SQLite statement. Duplicate or stale spins append nothing.
    const changed = await db.prepare(`INSERT INTO composer_spin_open_rounds (session_id,round_index,winner,spun_at)
      SELECT id,?,?,? FROM composer_spin_sessions WHERE id=? AND revision=? AND status='open' AND expires_at>?`)
      .bind(round.index, round.winner, now, id, revision, now).run();
    const newest = changed.meta.changes === 1 ? { ...row, revision: revision + 1 } : await find(db, id, now);
    return newest ? { status: 200 as const, session: await publicSession(db, newest) } : { status: 404 as const };
  }
  const rounds = JSON.parse(row.rounds) as Round[];
  if (action === 'spin') {
    const result = await spinRound(row.seed, row.config_hash, config, rounds);
    rounds.push({ ...result, at: new Date(now).toISOString() });
  }
  const status = action === 'abandon' ? 'abandoned' : action === 'finish' || spinProgress(config, rounds).winner >= 0 ? 'completed' : 'open';
  const changed = await db.prepare(`UPDATE composer_spin_sessions
    SET rounds=?,status=?,revision=revision+1 WHERE id=? AND revision=? AND status='open' AND expires_at>?`)
    .bind(JSON.stringify(rounds), status, id, revision, now).run();
  const newest = changed.meta.changes === 1 ? { ...row, status, rounds: JSON.stringify(rounds), revision: row.revision + 1 } : await find(db, id, now);
  return newest ? { status: 200 as const, session: await publicSession(db, newest) } : { status: 404 as const };
}

export async function purgeExpiredSpins(db: D1Database, now: number) {
  await db.prepare('DELETE FROM composer_spin_sessions WHERE expires_at<=?').bind(now).run();
}
