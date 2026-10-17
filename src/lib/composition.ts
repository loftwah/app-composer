// The active composition is the only authoritative record of which source
// revision each mounted mini-app route serves. Anything that reports "current"
// app identity reads it from here rather than from hand-maintained prose, so a
// promotion cannot leave a second stale copy of the pins behind.
import lock from '../../composition.lock.json' with { type: 'json' };

export interface MountedApp {
  id: string;
  name: string;
  repository: string;
  commit: string;
  short: string;
  url: string;
  route: string;
  version: string;
}

export const composition = {
  id: lock.id as string,
  reviewed: lock.reviewed as string,
};

export const mountedApps: MountedApp[] = lock.apps.map((app: any) => ({
  id: app.id,
  name: app.manifest.name as string,
  repository: app.repository as string,
  commit: app.commit as string,
  short: String(app.commit).slice(0, 10),
  url: app.url as string,
  route: (app.manifest.routes as string[] | undefined)?.[0] ?? '/' + app.id,
  version: app.manifest.version as string,
}));

export function mountedApp(id: string): MountedApp | undefined {
  return mountedApps.find(app => app.id === id);
}
