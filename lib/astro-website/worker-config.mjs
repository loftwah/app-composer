// Bounded, local-only Wrangler configuration for a static Workers.dev site.
// Pure: validates an explicit Worker name and returns fresh config data.
// Carries no account, route, binding, secret or entrypoint and contacts no
// provider. It is data for the exclusive local project writer, not a release.
const MAX_LENGTH = 63;
// Lowercase DNS-safe label: alphanumeric ends, internal hyphens only.
const WORKER_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function createAstroWebsiteWorkerConfig(workerName) {
  if (typeof workerName !== 'string' ||
      workerName.length > MAX_LENGTH ||
      WORKER_NAME.exec(workerName)?.[0] !== workerName)
    throw Object.assign(new Error('Use 1–63 lowercase letters, digits or hyphens for the Worker name. Start and end with a letter or digit.'), { code: 'invalid_worker_name' });
  return {
    name: workerName,
    // Pinned to the existing local Wrangler preview runtime.
    compatibility_date: '2026-10-20',
    assets: {
      directory: './dist',
      not_found_handling: '404-page',
      html_handling: 'auto-trailing-slash',
    },
  };
}
