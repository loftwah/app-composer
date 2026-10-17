import { z } from 'zod';
import { appSettings, validateConfigurationPatch } from './app-settings.mjs';
import { StackError } from './stacks.mjs';

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const sourceRevision = z.string().regex(/^[a-f0-9]{40}$/);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const config = z.object({
  title: z.string().min(1).max(80), intro: z.string().max(240),
  theme: z.enum(['daylight', 'midnight']), layout: z.enum(['grid', 'editorial']),
  guestAccess: z.enum(['closed', 'postcards']),
}).strict();
export type GuestbookConfiguration = z.infer<typeof config>;
const resource = z.object({
  id, workspace: id, account: z.string().max(80), environment: z.string().max(40),
  target: z.url(), version: revision, activeRevision: revision.nullable(),
  visible: z.boolean(), paused: z.boolean(),
});
const configuration = z.object({
  revision: revision.refine(value => value > 0), digest: z.string().regex(/^[a-f0-9]{64}$/),
  source: sourceRevision, values: config,
});
const acknowledgement = z.object({ contract: z.literal(1), outcome: z.literal('applied'), resource, configuration: configuration.nullable() });
export type AppAcknowledgement = z.infer<typeof acknowledgement>;
export interface ResourceRuntime {
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ACCOUNT_ID?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
  GUESTBOOK_OWNER_TOKEN?: unknown;
  GUESTBOOK?: { fetch(request: Request): Promise<Response> };
}
export interface ResourceCommand {
  action: 'create' | 'stage' | 'activate';
  operationId: string;
  expectedVersion?: number;
  configuration?: GuestbookConfiguration;
  configurationRevision?: number;
  configurationDigest?: string;
}
export interface RemoteOutcome {
  outcome: 'applied' | 'refused' | 'unknown';
  reply?: AppAcknowledgement;
  message?: string;
}
export const configurationDigest = async (value: GuestbookConfiguration) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(config.parse(value))));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
};
export function effectiveGuestbookConfiguration(values: Record<string, string>): GuestbookConfiguration {
  const model = appSettings.guestbook;
  const complete = Object.fromEntries(model.fields.map(field => [field.key, values[field.key] ?? field.default]));
  return config.parse(validateConfigurationPatch(complete, 'guestbook'));
}

async function boundedJSON(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing app response.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 32768) { await reader.cancel(); throw Error('Oversized app response.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function resourceConnection(runtime: ResourceRuntime, workspace: string) {
  const origin = 'https://composer.loftwah.com';
  const account = runtime.RESOURCE_ACCOUNT_ID, environment = runtime.RESOURCE_ENVIRONMENT;
  const service = runtime.GUESTBOOK, token = runtime.GUESTBOOK_OWNER_TOKEN;
  const source: unknown = appSettings.guestbook?.source?.commit;
  if (runtime.PUBLIC_ORIGIN !== origin || typeof account !== 'string' || !account ||
      typeof environment !== 'string' || !/^[a-z0-9-]{1,40}$/.test(environment) ||
      !service || typeof service.fetch !== 'function' || typeof token !== 'string' || !token || token.length > 4096 ||
      typeof source !== 'string' || !/^[a-f0-9]{40}$/.test(source)) {
    throw new StackError('UNAVAILABLE', 'Owned Guestbooks need their reviewed server connection, account and environment.');
  }
  const target = origin + '/guestbook';
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'X-Composer-Workspace': workspace,
    'X-Composer-Account': account,
    'X-Composer-Environment': environment,
    'X-Composer-Source': source,
    'X-Composer-Target': target,
    'X-Composer-Verification': '1',
  };
  const send = (path: string, body?: ResourceCommand) => service.fetch(new Request(target + path, {
    method: body ? 'POST' : 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(8000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  async function verify() {
    const response = await service!.fetch(new Request(target + '/build.json', { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'X-Composer-Verification': '1' } }));
    const build = z.object({ app: z.literal('guestbook'), revision: z.literal(source as string), dataVersion: z.literal(1), resourceContract: z.literal(1), resourcesEnabled: z.literal(true), resourceAccount: z.literal(account as string), resourceEnvironment: z.literal(environment as string) }).parse(await boundedJSON(response));
    if (!response.ok || build.revision !== source) throw Error('The connected app source or runtime does not match.');
  }
  async function checked(value: unknown, resourceId: string, command?: ResourceCommand, operationSource = source): Promise<AppAcknowledgement> {
    const reply = acknowledgement.parse(value);
    const selected = reply.resource;
    if (selected.id !== resourceId || selected.workspace !== workspace || selected.account !== account || selected.environment !== environment || selected.target !== target) throw Error('The app acknowledged another resource or target.');
    if (reply.configuration && reply.configuration.digest !== await configurationDigest(reply.configuration.values)) throw Error('The app configuration values and identity disagree.');
    if (command) {
      const expectedVersion = command.action === 'create' ? 0 : (command.expectedVersion ?? -1) + 1;
      if (reply.resource.version !== expectedVersion) throw Error('The app acknowledged another version.');
      if (command.action === 'stage' && (!reply.configuration || reply.configuration.revision !== expectedVersion || reply.configuration.source !== operationSource || reply.configuration.digest !== await configurationDigest(command.configuration!))) throw Error('The staged configuration acknowledgement differs.');
      if (command.action === 'activate' && (!reply.configuration || reply.resource.activeRevision !== command.configurationRevision || reply.configuration.revision !== command.configurationRevision || reply.configuration.digest !== command.configurationDigest || reply.configuration.source !== operationSource)) throw Error('The activation acknowledgement differs.');
    }
    return reply;
  }
  return {
    account, environment, source, target,
    async status(resourceId: string): Promise<AppAcknowledgement> {
      await verify();
      const response = await send('/api/resources/' + id.parse(resourceId));
      if (!response.ok) throw Error('The selected app resource could not be read.');
      const actual = await checked(await boundedJSON(response), resourceId);
      if (actual.resource.activeRevision !== (actual.configuration?.revision ?? null)) throw Error('The current app configuration and active revision disagree.');
      return actual;
    },
    async reconcile(resourceId: string, operationId: string, command: ResourceCommand, operationSource: string): Promise<AppAcknowledgement | null> {
      // Reads verify the currently deployed source. A historical receipt belongs
      // to the immutable source recorded when its operation was submitted.
      const recordedSource = sourceRevision.parse(operationSource);
      await verify();
      const response = await send('/api/resources/' + id.parse(resourceId) + '?operation=' + encodeURIComponent(operationId));
      if (!response.ok) throw Error('The app operation could not be reconciled.');
      const value = z.object({ contract: z.literal(1), recorded: z.boolean(), result: z.unknown().optional() }).parse(await boundedJSON(response));
      return value.recorded ? checked(value.result, resourceId, command, recordedSource) : null;
    },
    async command(resourceId: string, command: ResourceCommand, beforeWrite: () => Promise<void>): Promise<RemoteOutcome> {
      // Recheck both membership/revision and the actual integrated service
      // immediately before the credential-bearing app write.
      try { await verify(); await beforeWrite(); }
      catch { return { outcome: 'refused', message: 'The selected workspace, source or app connection changed before this write.' }; }
      try {
        const response = await send('/api/resources/' + id.parse(resourceId), command);
        if (!response.ok) return { outcome: response.status < 500 ? 'refused' : 'unknown', message: response.status < 500 ? 'The app refused this resource operation.' : 'The app did not confirm the resource operation. Reconcile before retrying.' };
        const reply = await checked(await boundedJSON(response), resourceId, command);
        return { outcome: 'applied', reply };
      } catch { return { outcome: 'unknown', message: 'The resource acknowledgement was interrupted or incompatible. Reconcile before retrying.' }; }
    },
  };
}
