import {validateDeviceSupport} from '../src/lib/device-support.mjs';

function exactDescriptor(value, reviewed) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(reviewed).length &&
    Object.entries(reviewed).every(
      ([key, expected]) => Object.hasOwn(value, key) && value[key] === expected,
    ),
  );
}

export function validateManifest(m) {
  if (m.deviceSupport !== undefined) validateDeviceSupport(m.deviceSupport);
  if (m.contract !== 1) throw new Error("Unsupported contract version");
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(m.id))
    throw new Error("Invalid app namespace");
  if (!["cloudflare-worker", "static-assets"].includes(m.runtime) || m.dataVersion !== 1)
    throw new Error("Incompatible runtime or data version");
  if (
    !Array.isArray(m.routes) ||
    m.routes.some((p) => !/^\/[a-z][a-z0-9-]*$/.test(p))
  )
    throw new Error("Invalid route declaration");
  if (
    !Array.isArray(m.capabilities) ||
    m.capabilities.some(
      (c) =>
        ![
          "items:read",
          "items:moderate",
          "media:private",
          "features:write",
        ].includes(c),
    )
  )
    throw new Error("Unapproved capability increase");
  if (m.runtime === "static-assets" && (m.capabilities.length || m.provider || m.memberService || m.features || m.services)) throw new Error("Static utilities cannot declare data or service capabilities");
  for (const [key, f] of Object.entries(m.configuration ?? {})) {
    if (
      ![
        "title",
        "intro",
        "theme",
        "layout",
        ...(m.id === "showcase"
          ? [
              "handle",
              "website",
              "github",
              "bluesky",
              "linkedin",
              "x",
              "avatar",
              "banner",
              "shareImage",
            ]
          : []),
        ...(m.id === "guestbook" ? ["guestAccess"] : []),
      ].includes(key)
    )
      throw new Error("Unsupported configuration field: " + key);
    if (
      key === "guestAccess" &&
      (f.type !== "select" ||
        f.default !== "closed" ||
        !Array.isArray(f.options) ||
        ![
          "closed,postcards",
          ...(exactDescriptor(m.memberService, {
            version: 2,
            entrypoint: "GuestbookMemberService",
            transport: "service-binding",
            path: "/__composer/member",
          })
            ? ["closed,postcards,members"]
            : []),
        ].includes(f.options.join(",")))
    )
      throw new Error(
        "Guest contributions must default closed with the reviewed postcard mode",
      );
    if (!["string", "select"].includes(f.type))
      throw new Error("Unsupported field kind");
    if (f.format !== undefined && !["handle", "https-url"].includes(f.format))
      throw new Error("Unsupported field format");
    if (
      f.hosts !== undefined &&
      (!Array.isArray(f.hosts) ||
        f.hosts.length > 4 ||
        f.hosts.some(
          (host) =>
            typeof host !== "string" ||
            !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host),
        ))
    )
      throw new Error("Invalid destination hosts");
  }
  if (
    m.cardPresentation &&
    (m.id !== "showcase" ||
      m.cardPresentation.version !== 1 ||
      !Array.isArray(m.cardPresentation.icons) ||
      m.cardPresentation.icons.length > 8 ||
      m.cardPresentation.icons.some(
        (icon) =>
          ![
            "link",
            "book",
            "code",
            "music",
            "video",
            "game",
            "heart",
            "star",
          ].includes(icon),
      ))
  )
    throw new Error("Unsupported card presentation");
  if (m.cardCollection !== undefined) {
    const c = m.cardCollection;
    if (
      m.id !== "showcase" ||
      !c ||
      typeof c !== "object" ||
      Array.isArray(c) ||
      Object.keys(c).length !== 4 ||
      c.version !== 1 ||
      c.limit !== 64 ||
      c.featuredLimit !== 8 ||
      !Array.isArray(c.groups) ||
      c.groups.join(",") !== "Music,Games,Projects,Writing,Connect"
    )
      throw new Error("Unsupported card collection");
  }
  if (m.achievementCollection !== undefined) {
    const a = m.achievementCollection;
    if (
      m.id !== "showcase" ||
      !a ||
      typeof a !== "object" ||
      Array.isArray(a) ||
      Object.keys(a).length !== 3 ||
      a.version !== 1 ||
      a.limit !== 8 ||
      !Array.isArray(a.datePrecisions) ||
      a.datePrecisions.join(",") !== "year,month,day"
    )
      throw new Error("Unsupported achievement collection");
  }
  if (
    m.memberProfiles !== undefined &&
    (m.id !== "showcase" ||
      !exactDescriptor(m.memberProfiles, {
        version: 1,
        ownership: "installation-account",
        publication: "explicit-snapshot",
        publicPath: "/p/:handle/",
        bridge: "/api/member-profiles",
      }))
  )
    throw Error("Unsupported member profile contract");
  if (
    m.memberService !== undefined &&
    (m.id !== "guestbook" ||
      ![1, 2].some((version) =>
        exactDescriptor(m.memberService, {
          version,
          entrypoint: "GuestbookMemberService",
          transport: "service-binding",
          path: "/__composer/member",
        }),
      ))
  )
    throw Error("Unsupported member service contract");
  if (m.tagCollection !== undefined) {
    const t = m.tagCollection;
    if (
      m.id !== "showcase" ||
      !t ||
      typeof t !== "object" ||
      Array.isArray(t) ||
      Object.keys(t).length !== 3 ||
      t.version !== 1 ||
      t.limit !== 12 ||
      !Array.isArray(t.context) ||
      t.context.join(",") !== "description,citation,related-work"
    )
      throw new Error("Unsupported tag collection");
  }
  if (m.profileSettings !== undefined) {
    const p = m.profileSettings;
    if (
      m.id !== "showcase" ||
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      Object.keys(p).length !== 3 ||
      p.version !== 1 ||
      p.format !== "linkarooie.profile-settings" ||
      p.maxFileBytes !== 32768
    )
      throw new Error("Unsupported profile settings portability");
  }
  if (m.providerSources !== undefined) {
    const source = m.providerSources;
    const keys = ["version", "kinds", "provider", "selection", "eligibility"];
    if (
      m.id !== "showcase" ||
      !source ||
      typeof source !== "object" ||
      Array.isArray(source) ||
      Object.keys(source).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(source, key)) ||
      source.version !== 1 ||
      !Array.isArray(source.kinds) ||
      source.kinds.length !== 1 ||
      source.kinds[0] !== "guestbook.resource" ||
      source.provider !== "guestbook" ||
      source.selection !== "explicit-resource-and-activated-configuration" ||
      source.eligibility !== "checked-at-each-render-and-export"
    )
      throw new Error("Unsupported scoped provider sources");
  }
  if (
    m.portability !== undefined &&
    (m.id !== "guestbook" ||
      !exactDescriptor(m.portability, {
        version: 1,
        format: "guestbook.approved-portable/v1",
        export: "/api/resources/:resource/portable",
        restore: "/api/resources/:freshResource/restore",
        maximumItems: 8,
        scope: "current-authorized-workspace-account-environment-target",
        restoredVisibility: "private",
        requiresLiveSource: true,
      }))
  )
    throw new Error("Unsupported approved-content portability");
  if (
    m.privateEnquiries !== undefined &&
    (m.id !== "guestbook" ||
      !exactDescriptor(m.privateEnquiries, {
        version: 1,
        model: "briefs/v1",
        owner: "/api/resources/:resource/enquiries",
        public: "/r/:resource/c/:configuration/enquiry",
        default: "closed",
        retentionDays: 30,
        receiptDays: 35,
        notifications: false,
      }))
  )
    throw new Error("Unsupported private enquiry contract");
  if (m.guestInvitation !== undefined) {
    const invitation = m.guestInvitation,
      limits = invitation?.limits;
    if (
      m.id !== "guestbook" ||
      !invitation ||
      typeof invitation !== "object" ||
      Array.isArray(invitation) ||
      Object.keys(invitation).sort().join(",") !==
        "default,kind,limits,route,states,version" ||
      invitation.version !== 1 ||
      invitation.kind !== "postcard" ||
      invitation.route !== "/r/:resource/api/invitation" ||
      !Array.isArray(invitation.states) ||
      invitation.states.join(",") !== "open,paused,closed,full" ||
      invitation.default !== "closed" ||
      !limits ||
      typeof limits !== "object" ||
      Array.isArray(limits) ||
      Object.keys(limits).sort().join(",") !==
        "alias,bytes,height,message,width" ||
      limits.message !== 160 ||
      limits.alias !== 60 ||
      limits.width !== 1200 ||
      limits.height !== 900 ||
      limits.bytes !== 100000
    )
      throw new Error("Unsupported guest invitation contract");
  }
  return m;
}
export function validateComposition(manifests) {
  const namespaces = new Set(),
    routes = new Set();
  for (const m of manifests) {
    validateManifest(m);
    if (namespaces.has(m.id)) throw new Error("App namespace collision");
    namespaces.add(m.id);
    for (const route of m.routes) {
      if (routes.has(route)) throw new Error("App route collision");
      routes.add(route);
    }
  }
  return true;
}
export function guardPromotion(active, candidate, expected) {
  if (active.id !== expected)
    throw new Error("Active release changed; this candidate is stale");
  validateComposition(candidate.apps.map((a) => a.manifest));
  for (const app of candidate.apps) {
    const old = active.apps.find((a) => a.id === app.id);
    if (old && app.manifest.dataVersion !== old.manifest.dataVersion)
      throw new Error(
        "Unsafe data boundary: code rollback does not restore data",
      );
    if (
      old &&
      app.manifest.capabilities.some(
        (c) => !old.manifest.capabilities.includes(c),
      )
    )
      throw new Error("Permission expansion requires explicit approval");
  }
  return true;
}
export function publicItem(provider, item) {
  if (
    provider.contract !== 1 ||
    item.contract !== 1 ||
    item.provider !== provider.id ||
    item.visibility !== "public" ||
    !item.id
  )
    throw new Error("Source item is unavailable or incompatible");
  const url = new URL(item.url),
    image = new URL(item.image);
  if (
    url.origin !== new URL(provider.origin).origin ||
    image.origin !== url.origin ||
    url.protocol !== "https:"
  )
    throw new Error("Item origin violates the declared provider");
  return item;
}
