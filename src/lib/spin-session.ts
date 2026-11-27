import type { D1Database } from '@cloudflare/workers-types';
import { configHash, randomSecret, secretHash, seedCommitment, spinLifetimeDays, spinProgress, spinRound, spinVersion, validateSpinConfig } from './spin-protocol.mjs';

interface Config { question: string; entries: string[]; bestOf: number }
interface Round { index: number; winner: number; eligible: number[]; tieBreak: boolean; at: string }
interface Session {
  id: string; owner_hash: string; seed: string; config: string; config_hash: string;
  commitment: string; rounds: string; status: 'open' | 'completed' | 'abandoned';
  revision: number; created_at: number; expires_at: number;
}

function publicSession(row: Session) {
  const config = JSON.parse(row.config) as Config;
  const rounds = JSON.parse(row.rounds) as Round[];
  const { totals, winner, tieBreak } = spinProgress(config, rounds);
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
  return { owner, session: publicSession(row) };
}

export async function readSpin(db: D1Database, id: string, now: number) {
  const row = await find(db, id, now);
  return row ? publicSession(row) : null;
}

export async function advanceSpin(db: D1Database, id: string, owner: string, revision: number, abandon: boolean, now: number) {
  const row = await find(db, id, now);
  if (!row) return { status: 404 as const };
  if (await secretHash(owner, id) !== row.owner_hash) return { status: 403 as const };
  if (row.status !== 'open' || row.revision !== revision) return { status: 200 as const, session: publicSession(row) };
  const config = JSON.parse(row.config) as Config;
  const rounds = JSON.parse(row.rounds) as Round[];
  if (!abandon) {
    const result = await spinRound(row.seed, row.config_hash, config, rounds);
    rounds.push({ ...result, at: new Date(now).toISOString() });
  }
  const status = abandon ? 'abandoned' : spinProgress(config, rounds).winner >= 0 ? 'completed' : 'open';
  const changed = await db.prepare(`UPDATE composer_spin_sessions
    SET rounds=?,status=?,revision=revision+1 WHERE id=? AND revision=? AND status='open' AND expires_at>?`)
    .bind(JSON.stringify(rounds), status, id, revision, now).run();
  const newest = changed.meta.changes === 1 ? { ...row, status, rounds: JSON.stringify(rounds), revision: row.revision + 1 } : await find(db, id, now);
  return newest ? { status: 200 as const, session: publicSession(newest) } : { status: 404 as const };
}

export async function purgeExpiredSpins(db: D1Database, now: number) {
  await db.prepare('DELETE FROM composer_spin_sessions WHERE expires_at<=?').bind(now).run();
}
