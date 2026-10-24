import composition from "../../composition.lock.json" with { type: "json" };
import assessments from "../../config/device-support.json" with { type: "json" };
import ldraw from "../../lib/ldraw/source.json" with { type: "json" };
import ldrawManifest from "../../lib/ldraw/app.manifest.json" with { type: "json" };
import { readDeviceSupport, releaseDeviceSupport } from "./device-support.mjs";

// Support checks live outside the app's own commit, avoiding a self-referential
// evidence hash. They become visible only for the exact reviewed adopted source.
export function appDeviceSupport(id: string) {
  const app = composition.apps.find((app) => app.id === id);
  if (!app) {
    if (id === "ldraw")
      return releaseDeviceSupport(
        id,
        ldraw.commit,
        ldrawManifest.deviceSupport,
        assessments,
      );
    return readDeviceSupport();
  }
  const manifest = app.manifest as { deviceSupport?: unknown };
  return releaseDeviceSupport(
    id,
    app.commit,
    manifest.deviceSupport,
    assessments,
  );
}
