import {setTimeout as delay} from 'node:timers/promises';
export async function verifyLive(source, lock, origin = 'https://composer.loftwah.com') {
  let reason = 'Deployment has not propagated';
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const identity = async (path) => {
        const res = await fetch(origin + path + '?verification=' + Date.now(), {
          headers: {'User-Agent': 'Mozilla/5.0 (AppComposer verification)'},
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw Error('HTTP ' + res.status + ' at ' + path);
        return res.json();
      };

      // Issue every cache-busted identity read for this attempt together: the
      // root source plus each pinned service. Wait for all of them to settle
      // before comparing, so no request from this attempt stays in flight into
      // the next retry and no comparison runs against a partial result.
      const checks = [
        {path: '/build.json'},
        ...lock.apps.map((a) => ({path: '/' + a.id + '/build.json', app: a})),
      ];
      const results = await Promise.allSettled(checks.map((c) => identity(c.path)));
      const failed = results.find((r) => r.status === 'rejected');
      if (failed) throw failed.reason;

      const root = results[0].value;
      if (root.commit !== source) throw Error('Root source is still ' + root.commit);
      for (let i = 1; i < results.length; i++) {
        const a = checks[i].app;
        const mounted = results[i].value;
        if (mounted.app !== a.id || mounted.revision !== a.commit || mounted.dataVersion !== a.manifest.dataVersion)
          throw Error('Mounted pin differs: ' + a.id);
      }
      return;
    } catch (error) {
      reason = error.message;
      if (attempt < 19) await delay(1500);
    }
  }
  throw Error('Live source verification failed after bounded propagation checks: ' + reason);
 }
