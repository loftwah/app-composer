import composition from "../../composition.lock.json";
import assessments from "../../config/device-support.json";
import { readDeviceSupport, releaseDeviceSupport } from "./device-support.mjs";

// Support checks live outside the app's own commit, avoiding a self-referential
// evidence hash. They become visible only for the exact reviewed adopted source.
export function appDeviceSupport(id: string) {
  const app = composition.apps.find((app) => app.id === id);
  if (!app) return readDeviceSupport();
  const manifest = app.manifest as { deviceSupport?: unknown };
  return releaseDeviceSupport(
    id,
    app.commit,
    manifest.deviceSupport,
    assessments,
  );
}
