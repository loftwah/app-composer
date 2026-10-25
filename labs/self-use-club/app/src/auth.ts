import type { Env } from './env.ts';

const cookieName = 'rrc_admin';
const maxAge = 60 * 60 * 12;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function sessionValue(env: Env): Promise<string> {
  return toHex(await digest(`riverton-admin-session-v1:${env.ADMIN_TOKEN ?? ''}`));
}

export function readCookie(request: Request, name: string): string {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

export async function isAuthorised(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_TOKEN) return false;
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Bearer ') && (await constantTimeEqual(header.slice(7), env.ADMIN_TOKEN))) return true;
  const cookie = readCookie(request, cookieName);
  if (!cookie) return false;
  return constantTimeEqual(cookie, await sessionValue(env));
}

export async function sessionCookie(request: Request, env: Env): Promise<string> {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=${await sessionValue(env)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearedCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
