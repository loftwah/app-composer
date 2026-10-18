import { z } from 'zod';
import { appSettings, validateConfigurationPatch } from './app-settings.mjs';
import { StackError } from './stacks.mjs';
import { portableGuestbook } from '../plugins/maintenance/protocol.ts';

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
  action: 'create' | 'stage' | 'activate' | 'moderate' | 'control';
  operationId: string;
  expectedVersion?: number;
  configuration?: GuestbookConfiguration;
  configurationRevision?: number;
  configurationDigest?: string;
  item?: string;
  itemRevision?: number;
  status?: 'approved' | 'hidden' | 'deleted';
  visible?: boolean;
  paused?: boolean;
}
const resourceItem = z.object({
  id, caption: z.string().max(160), author: z.string().max(60),
  status: z.enum(['pending', 'approved', 'hidden', 'rejected', 'deleted']),
  revision: revision.refine(value => value > 0),
  synthetic: z.union([z.literal(0), z.literal(1)]), created_at: z.string().max(40),
});
export type ResourceItem = z.infer<typeof resourceItem>;
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

async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing app response.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); throw Error('Oversized app response.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function boundedJSON(response: Response, limit = 32768): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await boundedBytes(response, limit))) as unknown;
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
    const build = z.object({ app: z.literal('guestbook'), revision: z.literal(source as string), dataVersion: z.literal(1), resourceContract: z.literal(1), resourcesEnabled: z.literal(true), resourceAccount: z.literal(account as string), resourceEnvironment: z.literal(environment as string), portabilityContract: z.literal(1).optional() }).parse(await boundedJSON(response));
    if (!response.ok || build.revision !== source) throw Error('The connected app source or runtime does not match.');
    return build;
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
      if (command.action === 'control' && (selected.visible !== command.visible || selected.paused !== command.paused)) throw Error('The app acknowledged different controls.');
    }
    return reply;
  }
  return {
    account, environment, source, target,
    async inspect(resourceId: string) {
      const build = await verify();
      return { actual: await this.status(resourceId), portabilitySupported: build.portabilityContract === 1 };
    },
    async portable(resourceId: string) {
      const build = await verify();
      if (build.portabilityContract !== 1) throw new StackError('UNAVAILABLE', 'The pinned Guestbook source does not support approved content and media portability.');
      const response = await send('/api/resources/' + id.parse(resourceId) + '/portable');
      if (!response.ok) throw new StackError('UNAVAILABLE', 'The app could not export current approved content. No recovery coverage has been confirmed.');
      const file = portableGuestbook.parse(await boundedJSON(response, 1200000));
      if (file.source.resource !== resourceId || file.source.workspace !== workspace || file.source.account !== account || file.source.environment !== environment || file.source.target !== target || file.source.build !== source || file.configuration.digest !== await configurationDigest(file.configuration.values)) throw Error('The app export does not belong to this exact source and scope.');
      for (const item of file.items) {
        const bytes = Uint8Array.from(atob(item.media.base64), char => char.charCodeAt(0));
        const signature = [137, 80, 78, 71, 13, 10, 26, 10];
        const data = new DataView(bytes.buffer);
        if (bytes.length < 33 || bytes.length > 100000 || signature.some((byte, index) => bytes[index] !== byte) ||
            String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR' || data.getUint32(16) < 1 || data.getUint32(16) > 1200 || data.getUint32(20) < 1 || data.getUint32(20) > 900) throw Error('The exported image is incompatible.');
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        if (Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') !== item.media.sha256) throw Error('The exported image digest does not match.');
      }
      const current = await this.status(resourceId);
      if (current.resource.version !== file.source.version || current.configuration?.revision !== file.configuration.revision || current.configuration.digest !== file.configuration.digest) throw Error('The app resource changed during export. Check again.');
      return file;
    },
    async enquiry(
      resourceId: string,
      suffix: '' | 'export' | 'receipt',
      command?: unknown,
      clientIP?: string,
      query?: { status?: string; page?: string; operation?: string },
      beforeDispatch?: () => Promise<void>,
    ) {
      if (command !== undefined && !beforeDispatch) {
        throw Error('A private enquiry dispatch requires a current workspace/publication guard.');
      }
      await verify();
      await beforeDispatch?.();
      const path = target + '/api/resources/' + id.parse(resourceId) + '/enquiries'
        + (suffix ? '/' + suffix : '')
        + (query ? '?' + new URLSearchParams(query) : '');
      const response = await service.fetch(new Request(path, {
        method: command === undefined ? 'GET' : 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: { ...headers, ...(clientIP ? { 'CF-Connecting-IP': clientIP } : {}) },
        ...(command === undefined ? {} : { body: JSON.stringify(command) }),
      }));
      return { status: response.status, body: await boundedJSON(response, 2500000) };
    },
    async content(resourceId: string) {
      await verify();
      const response = await send('/api/resources/' + id.parse(resourceId) + '/export');
      if (!response.ok) throw Error('The selected visitor book content could not be read.');
      const exported = z.object({
        contract: z.literal(1), format: z.literal('guestbook.resource-export/v1'),
        resource: z.object({
          id, workspace_id: z.literal(workspace), account_id: z.literal(account),
          environment: z.literal(environment), target: z.literal(target), version: revision,
        }),
        items: z.array(resourceItem).max(10000),
      }).parse(await boundedJSON(response, 2097152));
      if (exported.resource.id !== resourceId) throw Error('The app returned another visitor book.');
      // Export spans several reads in the app. A final version read makes
      // moderation/control drift explicit instead of displaying a mixed view.
      const actual = await this.status(resourceId);
      if (actual.resource.version !== exported.resource.version) throw Error('The visitor book changed while its content was loading. Refresh it.');
      return { actual, items: exported.items.filter(item => item.status !== 'deleted') };
    },
    async media(resourceId: string, item: string): Promise<Uint8Array> {
      await verify();
      const response = await send('/api/resources/' + id.parse(resourceId) + '/media/' + id.parse(item));
      if (!response.ok || response.headers.get('Content-Type')?.split(';')[0] !== 'image/png') throw Error('The private postcard is unavailable.');
      const bytes = await boundedBytes(response, 100000);
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes.length < 33 || signature.some((byte, index) => bytes[index] !== byte) ||
          String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR' || data.getUint32(16) < 1 || data.getUint32(16) > 1200 ||
          data.getUint32(20) < 1 || data.getUint32(20) > 900) throw Error('The app returned an incompatible postcard image.');
      return bytes;
    },
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
