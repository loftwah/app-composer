// Pure scene state and public copy for the homepage studio.
// Keeping this module free of three.js lets the small state checks run in Node,
// and lets Astro render the same wording into the no-JavaScript fallback.

export const studioStations = [
  {
    id: "press",
    number: "01",
    name: "Paperwork",
    title: "The form press",
    kicker: "A PDF that stays on your desk",
    instruction: "Feed a sheet through the press, then make your mark.",
    actionIdle: "Stamp the form",
    actionActive: "Stamp again",
    initialProgress: 34,
    sceneLabel: "PRESS 01 / PAPERWORK",
    caption: "Paperwork keeps the document in your browser.",
    context:
      "Paperwork fills, signs and saves PDFs without uploading the document. The page in this scene is invented.",
    href: "/paperwork",
    linkLabel: "Open Paperwork",
    readout:
      "A fictional form waits under the platen. Nothing here is a real document.",
    afterAction:
      "Filed: a fictional page, stamped in your browser. Paperwork never sent it anywhere.",
  },
  {
    id: "draw",
    number: "02",
    name: "LDraw",
    title: "The drawing floor",
    kicker: "A line that can stand up",
    instruction: "Raise the drawing into paper architecture, then lay it flat again.",
    actionIdle: "Raise the drawing",
    actionActive: "Lay it flat",
    initialProgress: 58,
    sceneLabel: "DRAW 02 / LDRAW",
    caption: "LDraw keeps the drawing editable.",
    context:
      "LDraw draws and saves editable diagrams locally, then exports PNG or SVG. This drawing is invented.",
    href: "/ldraw",
    linkLabel: "Open LDraw",
    readout:
      "The pencil lines are partway raised. Give them height or return them to the page.",
    afterAction:
      "The same editable lines, now a structure you could change. Nothing was exported.",
  },
  {
    id: "lens",
    number: "03",
    name: "Analytics",
    title: "The evidence lens",
    kicker: "Recorded activity, not people",
    instruction: "Turn the lens to inspect a different ring of evidence.",
    actionIdle: "Inspect next ring",
    actionActive: "Inspect next ring",
    initialProgress: 50,
    sceneLabel: "LENS 03 / COMPOSER ANALYTICS",
    caption: "A separate instrument for supported, recorded activity.",
    context:
      "Composer analytics reports supported, recorded activity. It is not connected to Paperwork documents or LDraw drawings.",
    href: "/activity",
    linkLabel: "Open analytics",
    readout:
      "The lens is focused on recorded requests. These are supported events, not people.",
    afterAction:
      "The lens turns. This ring shows recorded, supported activity; it never counts PDFs or drawings.",
    rings: [
      {
        label: "Recorded requests",
        detail:
          "A supported page or app was requested. The record describes activity, not a person.",
      },
      {
        label: "Supported actions",
        detail:
          "A named action the app deliberately reports. Unsupported interactions leave no mark.",
      },
      {
        label: "Daily coverage",
        detail:
          "Which days actually carry recorded activity, and which days are still unknown.",
      },
    ],
  },
];

export const defaultStationId = "press";

export const stationById = (id) =>
  studioStations.find((station) => station.id === id) ?? studioStations[0];

export const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const smoothstep = (min, max, value) => {
  const t = clamp((value - min) / (max - min));
  return t * t * (3 - 2 * t);
};

export const damp = (current, target, speed, dt) =>
  current + (target - current) * (1 - Math.exp(-speed * dt));

// A wide, flexible press output. `feed` pulls more sheet from the rollers and
// lifts the leading edge into a curl. All values stay finite across 0..1.
export function paperPoint(u, v, feed) {
  const f = clamp(feed);
  const across = u * 2 - 1;
  const x = across * 0.98;
  const wave = Math.sin(v * Math.PI) * (0.32 + f * 0.7);
  const tip = smoothstep(0.58, 1, v);
  const z = 1.55 + v * 1.38 + f * 0.38 - tip * (0.1 + f * 0.07);
  const lift = wave * 0.44 + tip * (1.05 + f * 0.9);
  const ripple =
    Math.sin(v * 7.4 + u * 4.6) * 0.04 * (0.25 + v) +
    Math.sin(v * 15.2 - u * 2.2) * 0.014 * f;
  const twist = across * Math.sin(v * Math.PI) * (0.09 + f * 0.06);
  const sideways = Math.sin(v * 3.4) * across * 0.06 * f + Math.sin(v * Math.PI * 1.4) * 0.06;
  return [x + sideways, 1.16 + lift + ripple + twist, z];
}

// LDraw's paper steps begin as a flat spiral drawing and rise into a helix.
// Each step gets its own delay so the structure builds rather than snapping.
export function drawingPose(index, count, lift) {
  const l = clamp(lift);
  const t = clamp(index / Math.max(1, count - 1));
  const stagger = clamp(l * 1.34 - t * 0.34);
  const rise = smoothstep(0, 1, stagger);
  const angle = 0.55 + index * 0.47;
  const radius = 0.32 + t * 1.08;
  const flatY = 0.065;
  const topY = 0.18 + index * 0.255;
  const x = Math.cos(angle) * radius * (0.42 + rise * 0.58);
  const z = Math.sin(angle) * radius * (0.42 + rise * 0.58);
  return {
    x,
    z,
    y: flatY + rise * topY,
    rotY: -angle + 0.34 + rise * 0.22,
    rotX: (1 - rise) * 0.02,
    scaleY: 0.18 + rise * 0.82,
    rise,
    angle,
    radius,
  };
}

// The lens has three deliberate seating positions for its three evidence rings.
export function lensSeat(index) {
  const seats = [-0.18, 0, 0.18];
  return seats[((index % 3) + 3) % 3];
}

export function lensRing(id, index) {
  const station = stationById(id);
  return station.rings[((index % 3) + 3) % 3];
}
