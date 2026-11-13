import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { drawingPose, paperPoint, clamp, smoothstep } from "./studio-data.js";
import {
  composerSignTexture,
  contactShadowTexture,
  enamelTexture,
  floorMarkTexture,
  floorTexture,
  formTexture,
  labelTexture,
  outputSheetTexture,
  paperTexture,
  sketchTexture,
  stampTexture,
  tapeTexture,
} from "./studio-textures.js";

export const COLORS = {
  ink: 0x0c1d24,
  inkSoft: 0x173039,
  orange: 0xfc5b05,
  orangeDeep: 0xc64304,
  orangeLight: 0xff8a4c,
  cream: 0xf3e5c9,
  paper: 0xfbf2df,
  teal: 0x4d918d,
  tealDeep: 0x1c5457,
  brass: 0xb98a4b,
  brassLight: 0xdbb46f,
  steel: 0x8e9f9d,
  graphite: 0x2a3538,
  navy: 0x122d3b,
};

const FONT = "Space, ui-sans-serif, system-ui, sans-serif";

function toonGradient() {
  const data = new Uint8Array([70, 145, 220, 255]);
  const texture = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function createStudioWorld({ mobile = false, theme = "dark" } = {}) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);

  const resources = new Set();
  const gradients = toonGradient();
  const remember = (resource) => {
    resources.add(resource);
    return resource;
  };
  const paperMap = remember(paperTexture());
  const sheetMap = remember(outputSheetTexture());
  const enamelMap = remember(enamelTexture());
  const floorMap = remember(floorTexture("dark"));
  const floorLightMap = remember(floorTexture("light"));
  const formMap = remember(formTexture());
  const stampMap = remember(stampTexture());
  const signMap = remember(composerSignTexture());
  const contactMap = remember(contactShadowTexture());

  const toon = (color, map = null) =>
    remember(
      new THREE.MeshToonMaterial({
        color,
        map,
        gradientMap: gradients,
        side: THREE.FrontSide,
      }),
    );
  const paperMaterial = remember(
    new THREE.MeshToonMaterial({
      color: 0xf4e6ca,
      map: paperMap,
      gradientMap: gradients,
      side: THREE.DoubleSide,
    }),
  );
  const sheetMaterial = remember(
    new THREE.MeshToonMaterial({
      color: 0xf1dfbd,
      map: sheetMap,
      gradientMap: gradients,
      side: THREE.DoubleSide,
    }),
  );
  const paperEdgeMaterial = remember(
    new THREE.LineBasicMaterial({ color: 0xa88b62, transparent: true, opacity: 0.8 }),
  );
  const inkLineMaterial = remember(
    new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0.84 }),
  );
  const creamLineMaterial = remember(
    new THREE.LineBasicMaterial({ color: 0xf6e9d1, transparent: true, opacity: 0.7 }),
  );
  const materials = {
    paper: paperMaterial,
    sheet: sheetMaterial,
    ink: toon(COLORS.ink),
    inkSoft: toon(COLORS.inkSoft),
    orange: toon(COLORS.orange, enamelMap),
    orangeDeep: toon(COLORS.orangeDeep, enamelMap),
    orangeLight: toon(COLORS.orangeLight, enamelMap),
    cream: toon(0xe9d6b5, paperMap),
    teal: toon(COLORS.teal, enamelMap),
    tealDeep: toon(COLORS.tealDeep),
    brass: toon(COLORS.brass, enamelMap),
    brassLight: toon(COLORS.brassLight, enamelMap),
    steel: toon(COLORS.steel),
    graphite: toon(COLORS.graphite),
    navy: toon(COLORS.navy),
    glass: remember(
      new THREE.MeshPhysicalMaterial({
        color: 0xcdeae1,
        transparent: true,
        opacity: 0.2,
        roughness: 0.06,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
    stamp: remember(
      new THREE.MeshBasicMaterial({
        map: stampMap,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
    form: remember(
      new THREE.MeshStandardMaterial({
        map: formMap,
        roughness: 0.94,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    ),
  };
  const boundary = toon(0x1b2f34);

  const ambient = {};

  function geometry(value) {
    remember(value);
    return value;
  }

  function rounded(width, height, depth, radius = 0.05) {
    return geometry(new RoundedBoxGeometry(width, height, depth, 2, radius));
  }

  function mesh(parent, geo, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const item = new THREE.Mesh(geo, material);
    item.position.set(...position);
    item.rotation.set(...rotation);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }

  function box(parent, width, height, depth, material, position, rotation = [0, 0, 0], radius = 0.045) {
    return mesh(parent, rounded(width, height, depth, radius), material, position, rotation);
  }

  function cylinder(parent, top, bottom, height, material, position, rotation = [0, 0, 0], segments = 24) {
    return mesh(
      parent,
      geometry(new THREE.CylinderGeometry(top, bottom, height, segments)),
      material,
      position,
      rotation,
    );
  }

  function sphere(parent, radius, material, position, segments = 18) {
    return mesh(
      parent,
      geometry(new THREE.SphereGeometry(radius, segments, Math.max(8, Math.round(segments * 0.7)))),
      material,
      position,
    );
  }

  function torus(parent, radius, tube, material, position, rotation = [0, 0, 0], segments = 40) {
    return mesh(
      parent,
      geometry(new THREE.TorusGeometry(radius, tube, 10, segments)),
      material,
      position,
      rotation,
    );
  }

  function rod(parent, from, to, radius, material, segments = 10) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const length = start.distanceTo(end);
    const item = cylinder(
      parent,
      radius,
      radius,
      length,
      material,
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      undefined,
      segments,
    );
    item.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize(),
    );
    return item;
  }

  function outline(item, { color = 0x081318, opacity = 0.78, threshold = 30 } = {}) {
    const edges = geometry(new THREE.EdgesGeometry(item.geometry, threshold));
    const material = remember(
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    const lines = new THREE.LineSegments(edges, material);
    lines.renderOrder = 3;
    item.add(lines);
    return item;
  }

  const hullMaterial = remember(
    new THREE.MeshBasicMaterial({ color: 0x071318, side: THREE.BackSide }),
  );
  function inkHull(item, amount = 0.012) {
    const hull = new THREE.Mesh(item.geometry, hullMaterial);
    hull.scale.setScalar(1 + amount);
    hull.renderOrder = 0;
    hull.castShadow = false;
    hull.receiveShadow = false;
    item.add(hull);
    return item;
  }

  function plaque(parent, texture, width, height, position, rotation = [0, 0, 0]) {
    const material = remember(
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    const item = mesh(
      parent,
      geometry(new THREE.PlaneGeometry(width, height)),
      material,
      position,
      rotation,
    );
    item.castShadow = false;
    item.receiveShadow = false;
    return item;
  }

  function addRivets(parent, xs, y, z, material = materials.brass, radius = 0.045) {
    for (const x of xs) sphere(parent, radius, material, [x, y, z], 10);
  }

  function gearGeometry(radius, teeth, depth, holeRadius = 0.28) {
    const shape = new THREE.Shape();
    const root = radius * 0.84;
    const tip = radius;
    const steps = teeth * 4;
    for (let index = 0; index < steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      const arc = (Math.PI * 2) / steps;
      const r = index % 4 < 2 ? tip : root;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
      if (index % 4 === 1) {
        shape.lineTo(Math.cos(angle + arc * 0.18) * tip, Math.sin(angle + arc * 0.18) * tip);
      }
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius * holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return geometry(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012,
      }),
    );
  }

  function archGeometry(width, height, depth, thickness) {
    const shape = new THREE.Shape();
    const shoulder = height - width / 2;
    shape.moveTo(-width / 2, 0);
    shape.lineTo(-width / 2, shoulder);
    shape.absarc(0, shoulder, width / 2, Math.PI, 0, true);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2 - thickness, 0);
    shape.lineTo(width / 2 - thickness, shoulder);
    shape.absarc(0, shoulder, width / 2 - thickness, 0, Math.PI, false);
    shape.lineTo(-width / 2 + thickness, 0);
    shape.closePath();
    return geometry(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.02,
        bevelThickness: 0.02,
      }),
    );
  }

  // ---------------------------------------------------------------- lighting

  const hemi = new THREE.HemisphereLight(0xffe7c0, 0x183b44, 1.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d2, 2.65);
  key.position.set(-7, 13, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 42;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x93d9d2, 1.25);
  rim.position.set(9, 7, -7);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xff9b62, 0.42);
  fill.position.set(-2, 3, 9);
  scene.add(fill);
  const lampGlow = new THREE.PointLight(0xffb26d, 6.2, 7.5, 2);
  lampGlow.position.set(-3.4, 5.8, -0.2);
  scene.add(lampGlow);
  const fog = new THREE.Fog(0x0b1b21, 24, 46);
  scene.fog = fog;

  // -------------------------------------------------------------------- floor

  const floorMaterial = remember(
    new THREE.MeshStandardMaterial({
      map: floorMap,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  const floor = box(root, 38, 0.6, 30, floorMaterial, [0, -0.32, 1.2], [0, 0, 0], 0.02);
  floor.receiveShadow = true;
  floor.castShadow = false;

  const markingMaterial = (texture) =>
    remember(
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
  const addFloorMark = (position, number, title, rotation = 0) => {
    const mark = mesh(
      root,
      geometry(new THREE.PlaneGeometry(2.55, 2.55)),
      markingMaterial(floorMarkTexture(number, title)),
      [position[0], 0.012, position[1]],
      [-Math.PI / 2, 0, rotation],
    );
    mark.castShadow = false;
    mark.receiveShadow = false;
    mark.renderOrder = 1;
  };
  addFloorMark([-2.75, 4.9], "01", "PAPERWORK", -0.12);
  addFloorMark([0.65, 3.9], "02", "LDRAW", 0.08);
  addFloorMark([5.3, 3.2], "03", "ANALYTICS", -0.18);

  const contactMaterial = remember(
    new THREE.MeshBasicMaterial({
      map: contactMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
      toneMapped: false,
    }),
  );
  for (const [x, z, width, depth, opacity] of [
    [-2.45, 2.38, 4.8, 4.0, 0.9],
    [1.15, 0.9, 5.1, 5.1, 0.72],
    [5.35, -1.15, 4.4, 4.4, 0.78],
  ]) {
    const contact = mesh(
      root,
      geometry(new THREE.PlaneGeometry(width, depth)),
      contactMaterial.clone(),
      [x, 0.014, z],
      [-Math.PI / 2, 0, 0],
    );
    contact.material.opacity = opacity;
    contact.castShadow = false;
    contact.receiveShadow = false;
    contact.renderOrder = 1;
    remember(contact.material);
  }

  const scrapMaterial = materials.paper;
  for (let index = 0; index < 11; index += 1) {
    const scrap = mesh(
      root,
      geometry(new THREE.PlaneGeometry(0.18 + Math.random() * 0.28, 0.12 + Math.random() * 0.2)),
      scrapMaterial,
      [-7 + Math.random() * 14, 0.018, -3 + Math.random() * 7.2],
      [-Math.PI / 2, 0, Math.random() * Math.PI],
    );
    scrap.castShadow = false;
    scrap.receiveShadow = true;
  }

  // --------------------------------------------------------- backdrop workshop

  const back = new THREE.Group();
  back.position.set(0, 0, -4.2);
  root.add(back);

  const towers = new THREE.Group();
  towers.position.set(0, 0, -6.4);
  root.add(towers);
  for (let index = 0; index < 13; index += 1) {
    const width = 0.9 + (index % 4) * 0.34;
    const height = 2.2 + ((index * 7) % 9) * 0.55;
    const tower = box(
      towers,
      width,
      height,
      0.7,
      index % 3 === 0 ? materials.tealDeep : materials.inkSoft,
      [-9 + index * 1.55, height / 2 - 0.1, 0],
      [0, 0.06 * (index % 3), 0],
      0.08,
    );
    tower.castShadow = false;
    for (let row = 0; row < 3; row += 1) {
      box(
        towers,
        0.18,
        0.1,
        0.02,
        index % 4 === 0 ? materials.orange : materials.cream,
        [tower.position.x - width / 2 + 0.26 + row * 0.28, height * 0.35 + row * 0.55, 0.37],
        [0, 0, 0],
        0.01,
      ).castShadow = false;
    }
  }

  for (const [x, width, height, material] of [
    [-4.6, 4.4, 5.9, materials.orange],
    [1.2, 4.9, 6.35, materials.orangeDeep],
    [6.8, 4.2, 5.7, materials.orange],
  ]) {
    const arch = mesh(
      back,
      archGeometry(width, height, 0.34, 0.34),
      material,
      [x, 0, 0],
    );
    arch.castShadow = true;
    inkHull(arch, 0.008);
    outline(arch, { opacity: 0.4 });
    const glass = mesh(
      back,
      geometry(new THREE.PlaneGeometry(width - 0.8, height - 0.8)),
      materials.tealDeep,
      [x, (height - 0.8) / 2, -0.02],
    );
    glass.material = remember(
      new THREE.MeshBasicMaterial({
        color: 0x12383e,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    glass.castShadow = false;
    glass.receiveShadow = false;
  }

  const beam = new THREE.Group();
  root.add(beam);
  box(beam, 20.5, 0.2, 0.62, materials.orange, [0, 7.18, -3.9], [0, 0, 0], 0.03);
  box(beam, 20.5, 0.16, 0.46, materials.orangeDeep, [0, 6.54, -3.9], [0, 0, 0], 0.03);
  box(beam, 20.5, 0.5, 0.12, materials.orangeDeep, [0, 6.86, -3.9], [0, 0, 0], 0.02);
  for (let index = 0; index < 17; index += 1) {
    sphere(beam, 0.04, materials.brass, [-9.6 + index * 1.2, 7.06, -3.56], 10);
  }
  for (const x of [-8.6, 9.6]) {
    box(beam, 0.34, 7.3, 0.52, materials.orange, [x, 3.6, -4.05], [0, 0, 0], 0.05);
    box(beam, 0.12, 7.1, 1.55, materials.orangeDeep, [x, 3.6, -3.7], [0, 0, 0], 0.02);
  }
  rod(beam, [-8.6, 7.05, -3.9], [-5.2, 6.6, -3.9], 0.035, materials.ink);
  rod(beam, [9.6, 7.05, -3.9], [6.2, 6.6, -3.9], 0.035, materials.ink);

  // Pipes and conduits give the back wall a specific, used silhouette.
  const pipeMaterial = materials.orange;
  const pipe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-7.9, 0.2, -3.7),
    new THREE.Vector3(-7.9, 3.4, -3.7),
    new THREE.Vector3(-7.1, 4.2, -3.7),
    new THREE.Vector3(-6.6, 4.2, -3.7),
    new THREE.Vector3(-6.6, 6.7, -3.7),
  ]);
  const pipeMesh = mesh(
    root,
    geometry(new THREE.TubeGeometry(pipe, 42, 0.085, 10, false)),
    pipeMaterial,
  );
  pipeMesh.castShadow = true;
  for (const point of [
    [-7.9, 1.05, -3.7],
    [-7.9, 2.55, -3.7],
    [-6.6, 5.5, -3.7],
  ]) {
    cylinder(root, 0.14, 0.14, 0.17, materials.brass, point, [Math.PI / 2, 0, 0], 16);
  }
  const pipe2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(8.9, 0.3, -3.6),
    new THREE.Vector3(8.9, 4.7, -3.6),
    new THREE.Vector3(8.3, 5.4, -3.6),
    new THREE.Vector3(7.9, 5.4, -3.6),
    new THREE.Vector3(7.9, 6.5, -3.6),
  ]);
  mesh(root, geometry(new THREE.TubeGeometry(pipe2, 36, 0.07, 9, false)), materials.teal);
  for (const [x, y, z] of [
    [8.9, 1.1, -3.6],
    [8.9, 3.4, -3.6],
    [7.9, 5.9, -3.6],
  ]) {
    cylinder(root, 0.12, 0.12, 0.15, materials.brass, [x, y, z], [Math.PI / 2, 0, 0], 14);
  }
  const valve = new THREE.Group();
  valve.position.set(-6.6, 4.2, -3.68);
  root.add(valve);
  torus(valve, 0.32, 0.035, materials.orange, [0, 0, 0], [0, 0, 0], 24);
  for (let index = 0; index < 4; index += 1) {
    rod(valve, [0, 0, 0], [Math.cos((index / 4) * Math.PI * 2) * 0.3, Math.sin((index / 4) * Math.PI * 2) * 0.3, 0], 0.018, materials.brass);
  }
  cylinder(valve, 0.075, 0.075, 0.22, materials.brass, [0, 0, -0.06], [Math.PI / 2, 0, 0], 12);

  // Wall gears.
  const gears = [];
  const makeWallGear = (x, y, z, radius, teeth, material, speed) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    root.add(group);
    const wheel = mesh(group, gearGeometry(radius, teeth, 0.18, 0.22), material);
    wheel.castShadow = true;
    outline(wheel, { opacity: 0.42 });
    cylinder(group, radius * 0.23, radius * 0.23, 0.26, materials.brass, [0, 0, 0.04], [Math.PI / 2, 0, 0], 24);
    gears.push({ group, speed });
    return group;
  };
  makeWallGear(-5.35, 4.25, -3.45, 1.35, 16, materials.tealDeep, 0.09);
  makeWallGear(-3.85, 3.5, -3.42, 0.63, 12, materials.orange, -0.18);
  makeWallGear(8.1, 3.7, -3.5, 1.05, 14, materials.orangeDeep, -0.07);

  // Hanging sign with the approved Composer mark.
  const sign = new THREE.Group();
  sign.position.set(-3.55, 6.05, -3.1);
  sign.scale.setScalar(0.82);
  root.add(sign);
  inkHull(box(sign, 3.35, 1.52, 0.1, materials.orangeDeep, [0, 0, -0.06], [0, 0, 0], 0.04), 0.012);
  plaque(sign, signMap, 3.2, 1.46, [0, 0, 0.015]);
  for (const x of [-1.35, 1.35]) {
    rod(sign, [x, 0.76, 0], [x, 1.6, 0], 0.018, materials.brass, 6);
    sphere(sign, 0.05, materials.brass, [x, 0.79, 0], 10);
  }
  rod(sign, [-1.35, 1.58, 0], [1.35, 1.58, 0], 0.022, materials.brass, 6);

  // Clothesline of pinned sketches.
  const line = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.9, 5.5, -3.1),
    new THREE.Vector3(-1.8, 4.95, -3.2),
    new THREE.Vector3(2.4, 5.18, -3.2),
    new THREE.Vector3(4.9, 5.55, -3.1),
  ]);
  mesh(root, geometry(new THREE.TubeGeometry(line, 38, 0.014, 5, false)), materials.graphite);
  for (const [x, y] of [
    [-4.9, 5.28],
    [-2.7, 5.03],
    [0.1, 5.0],
    [2.8, 5.18],
  ]) {
    rod(root, [x - 1.16, 6.15, -3.16], [x - 1.16, 4.5, -3.16], 0.013, materials.graphite, 5);
    rod(root, [x + 1.16, 6.15, -3.16], [x + 1.16, 4.5, -3.16], 0.013, materials.graphite, 5);
    rod(root, [x - 1.16, 6.15, -3.16], [x + 1.16, 6.15, -3.16], 0.013, materials.graphite, 5);
    const sheet = plaque(root, sketchTexture(300 + Math.round(x * 17)), 1.5, 1.9, [x, y - 0.5, -3.13], [0, 0, Math.sin(x) * 0.025]);
    sheet.userData.phase = x * 1.7;
    ambient.sketches ??= [];
    ambient.sketches.push(sheet);
  }

  // Shelves and paper stock on the left.
  const shelf = new THREE.Group();
  shelf.position.set(-6.65, 0, -2.55);
  root.add(shelf);
  for (const x of [-1.15, 1.15]) {
    box(shelf, 0.16, 4.3, 0.72, materials.orange, [x, 2.15, 0], [0, 0, 0], 0.03);
  }
  for (const y of [0.55, 1.6, 2.65, 3.7]) {
    box(shelf, 2.45, 0.1, 0.8, materials.cream, [0, y, 0], [0, 0, 0], 0.02);
    for (let index = 0; index < 7; index += 1) {
      box(
        shelf,
        0.28 + (index % 2) * 0.06,
        0.32 + ((index * 3) % 4) * 0.08,
        0.5,
        index % 4 === 0 ? materials.orange : materials.cream,
        [-0.9 + (index % 4) * 0.38, y + 0.21, -0.05 + Math.floor(index / 4) * 0.25],
        [0, (index % 2 ? 1 : -1) * 0.04, 0],
        0.02,
      );
    }
  }
  for (let index = 0; index < 3; index += 1) {
    const roll = cylinder(
      shelf,
      0.32,
      0.32,
      1.1,
      materials.paper,
      [-0.55 + index * 0.62, 4.2, 0],
      [0, 0, Math.PI / 2],
      20,
    );
    torus(shelf, 0.33, 0.02, materials.orange, [-0.55 + index * 0.62, 4.2, 0.57], [0, 0, 0], 20);
    torus(shelf, 0.33, 0.02, materials.orange, [-0.55 + index * 0.62, 4.2, -0.57], [0, 0, 0], 20);
  }

  // Loose paper roll on the right rear.
  const rollStand = new THREE.Group();
  rollStand.position.set(7.85, 0, -2.6);
  root.add(rollStand);
  rod(rollStand, [-0.65, 0.3, 0], [-0.65, 3.45, 0], 0.06, materials.orange);
  rod(rollStand, [0.65, 0.3, 0], [0.65, 3.45, 0], 0.06, materials.orange);
  rod(rollStand, [-0.78, 3.45, 0], [0.78, 3.45, 0], 0.055, materials.orange);
  const roll = cylinder(rollStand, 0.42, 0.42, 1.22, materials.paper, [0, 2.95, 0], [0, 0, Math.PI / 2], 28);
  torus(rollStand, 0.43, 0.022, materials.brass, [-0.61, 2.95, 0], [0, 0, 0], 22);
  torus(rollStand, 0.43, 0.022, materials.brass, [0.61, 2.95, 0], [0, 0, 0], 22);
  const hangingSheet = mesh(
    rollStand,
    geometry(new THREE.PlaneGeometry(1.08, 2.0, 8, 12)),
    paperMaterial,
    [0, 1.95, 0.18],
    [0, 0, 0],
  );
  const hangingPositions = hangingSheet.geometry.attributes.position;
  for (let index = 0; index < hangingPositions.count; index += 1) {
    const u = hangingPositions.getX(index) / 1.08 + 0.5;
    const v = hangingPositions.getY(index) / 2 + 0.5;
    hangingPositions.setZ(index, Math.sin(u * 5.2 + v * 3.1) * 0.06 + v * 0.22);
  }
  hangingSheet.geometry.computeVertexNormals();
  ambient.hangingSheet = hangingSheet;

  // ------------------------------------------------------------- hanging lamps

  const lamps = [];
  for (const [x, y, z, size] of [
    [-5.2, 5.65, 1.15, 0.9],
    [2.1, 6.35, -1.9, 0.86],
    [7.2, 5.9, 0.6, 0.74],
  ]) {
    const lamp = new THREE.Group();
    lamp.position.set(x, y, z);
    root.add(lamp);
    rod(lamp, [0, 1.25, 0], [0, 0.32, 0], 0.014, materials.graphite, 5);
    const shade = cylinder(lamp, 0.16 * size, 0.55 * size, 0.52 * size, materials.orange, [0, 0, 0], [0, 0, 0], 24);
    shade.material = remember(
      new THREE.MeshToonMaterial({
        color: COLORS.orange,
        side: THREE.DoubleSide,
        gradientMap: gradients,
      }),
    );
    const inner = cylinder(lamp, 0.14 * size, 0.5 * size, 0.46 * size, materials.cream, [0, -0.035, 0], [0, 0, 0], 24);
    inner.material = remember(
      new THREE.MeshBasicMaterial({ color: 0xffe3b5, side: THREE.BackSide }),
    );
    sphere(lamp, 0.11 * size, remember(new THREE.MeshBasicMaterial({ color: 0xffd9a0 })), [0, -0.24, 0], 12);
    torus(lamp, 0.17 * size, 0.018, materials.brass, [0, 0.28, 0], [Math.PI / 2, 0, 0], 16);
    lamps.push({ group: lamp, phase: x * 0.31, baseX: x, baseZ: z });
  }
  ambient.lamps = lamps;

  // ---------------------------------------------------------------- Paperwork

  const press = new THREE.Group();
  press.position.set(-2.45, 0, 2.35);
  press.rotation.y = 0.17;
  root.add(press);
  ambient.press = press;

  inkHull(box(press, 3.55, 0.44, 2.55, materials.ink, [0, 0.28, 0], [0, 0, 0], 0.08), 0.022);
  inkHull(box(press, 3.22, 0.16, 2.24, materials.orangeDeep, [0, 0.56, 0.02], [0, 0, 0], 0.045), 0.018);
  box(press, 3.0, 0.1, 2.04, materials.cream, [0, 0.65, 0.02], [0, 0, 0], 0.035);
  for (const [x, z] of [
    [-1.52, -1.05],
    [1.52, -1.05],
    [-1.52, 1.05],
    [1.52, 1.05],
  ]) {
    cylinder(press, 0.17, 0.2, 0.18, materials.graphite, [x, 0.11, z], [0, 0, 0], 14);
  }
  for (const x of [-1.38, 1.38]) {
    const column = box(press, 0.34, 2.78, 0.5, materials.orange, [x, 2.0, -0.48], [0, 0, 0], 0.06);
    outline(column, { opacity: 0.5 });
    inkHull(column, 0.018);
    box(press, 0.46, 0.16, 0.62, materials.brass, [x, 0.72, -0.48], [0, 0, 0], 0.03);
    box(press, 0.46, 0.16, 0.62, materials.brass, [x, 3.28, -0.48], [0, 0, 0], 0.03);
    addRivets(press, [x - 0.16, x + 0.16], 2.55, -0.22);
    addRivets(press, [x - 0.16, x + 0.16], 1.25, -0.22);
  }
  inkHull(box(press, 3.12, 0.5, 0.72, materials.orange, [0, 3.5, -0.48], [0, 0, 0], 0.07), 0.016);
  box(press, 2.72, 0.12, 0.78, materials.orangeDeep, [0, 3.79, -0.48], [0, 0, 0], 0.025);
  for (let index = 0; index < 9; index += 1) {
    sphere(press, 0.04, materials.brass, [-1.2 + index * 0.3, 3.8, -0.09], 10);
  }
  plaque(
    press,
    labelTexture("PAPERWORK", "FORM PRESS / 01", {
      width: 1024,
      height: 236,
      background: "#f4e6cd",
      ink: "#172d33",
      accent: "#d84b05",
    }),
    1.85,
    0.43,
    [0, 3.5, -0.09],
  );
  box(press, 2.0, 0.06, 0.05, materials.cream, [0, 3.7, -0.1], [0, 0, 0], 0.015);

  const ram = new THREE.Group();
  ram.position.set(0, 1.4, 0.45);
  press.add(ram);
  cylinder(ram, 0.2, 0.2, 1.9, materials.steel, [0, 0.99, 0], [0, 0, 0], 18);
  torus(ram, 0.25, 0.035, materials.brass, [0, 1.95, 0], [Math.PI / 2, 0, 0], 18);
  inkHull(box(ram, 1.46, 0.32, 1.08, materials.inkSoft, [0, -0.02, 0], [0, 0, 0], 0.055), 0.018);
  box(ram, 1.26, 0.1, 0.88, materials.orange, [0, -0.22, 0], [0, 0, 0], 0.02);
  box(ram, 0.78, 0.24, 0.44, materials.graphite, [0, -0.33, 0], [0, 0, 0], 0.025);
  ambient.ram = ram;

  const lever = new THREE.Group();
  lever.position.set(1.55, 1.36, 1.02);
  press.add(lever);
  inkHull(cylinder(lever, 0.32, 0.32, 0.26, materials.graphite, [0, 0, 0], [Math.PI / 2, 0, 0], 22), 0.02);
  torus(lever, 0.27, 0.035, materials.brass, [0, 0, 0.14], [0, 0, 0], 18);
  rod(lever, [0, 0, 0], [0.16, 1.5, 0.3], 0.085, materials.orange, 10);
  cylinder(lever, 0.13, 0.17, 0.58, materials.navy, [0.18, 1.6, 0.34], [0, 0, 0], 18);
  sphere(lever, 0.19, materials.navy, [0.18, 1.9, 0.34], 16);
  ambient.lever = lever;

  const handwheel = new THREE.Group();
  handwheel.position.set(-1.5, 1.55, 1.12);
  press.add(handwheel);
  inkHull(torus(handwheel, 0.62, 0.07, materials.orange, [0, 0, 0], [0, 0, 0], 28), 0.02);
  torus(handwheel, 0.48, 0.025, materials.brass, [0, 0, 0], [0, 0, 0], 28);
  for (let index = 0; index < 4; index += 1) {
    rod(
      handwheel,
      [0, 0, 0],
      [Math.cos((index / 4) * Math.PI * 2) * 0.58, Math.sin((index / 4) * Math.PI * 2) * 0.58, 0],
      0.025,
      materials.orange,
    );
  }
  sphere(handwheel, 0.16, materials.brass, [0, 0, 0], 14);
  ambient.handwheel = handwheel;

  // Counterweight and chain behind the press.
  const counterweight = new THREE.Group();
  counterweight.position.set(1.95, 2.6, -0.88);
  press.add(counterweight);
  rod(counterweight, [0, 1.15, 0], [0, 3.2, 0], 0.018, materials.graphite, 5);
  for (let index = 0; index < 5; index += 1) {
    torus(counterweight, 0.06, 0.014, materials.brass, [0, 1.15 + index * 0.18, 0], [0, 0, 0], 12);
  }
  cylinder(counterweight, 0.17, 0.22, 0.42, materials.graphite, [0, 1.0, 0], [0, 0, 0], 16);
  ambient.counterweight = counterweight;

  // Form stack, feed tray and rollers.
  for (let index = 0; index < 12; index += 1) {
    box(
      press,
      1.5,
      0.018,
      1.02,
      index % 3 === 0 ? materials.cream : materials.paper,
      [0.02, 0.72 + index * 0.022, 0.2],
      [0, 0.018 * ((index % 4) - 1.5), 0],
      0.008,
    );
  }
  box(press, 0.16, 0.42, 1.12, materials.orange, [-0.85, 0.9, 0.2], [0, 0, 0], 0.03);
  box(press, 0.16, 0.42, 1.12, materials.orange, [0.85, 0.9, 0.2], [0, 0, 0], 0.03);
  box(press, 0.9, 0.1, 1.6, materials.orangeDeep, [-1.62, 1.04, 1.1], [0, 0.08, 0], 0.03);
  for (const z of [0.7, 1.2, 1.7]) {
    cylinder(press, 0.09, 0.09, 0.9, materials.brass, [-1.58, 1.12, z], [0, 0, Math.PI / 2], 12);
  }

  // The page under the press. It is an invented form, never a real document.
  const pageGroup = new THREE.Group();
  press.add(pageGroup);
  const formPage = mesh(
    pageGroup,
    geometry(new THREE.PlaneGeometry(1.48, 1.04)),
    materials.form,
    [0, 0.665, 0.55],
    [-Math.PI / 2, 0, 0],
  );
  box(pageGroup, 1.58, 0.04, 1.14, materials.cream, [0, 0.64, 0.55], [0, 0, 0], 0.02);
  box(press, 1.78, 0.08, 0.82, materials.cream, [0, 0.6, 1.46], [0.08, 0, 0], 0.03);
  box(press, 1.6, 0.06, 0.06, materials.orange, [0, 0.6, 1.86], [0, 0, 0], 0.015);
  const marks = [];
  for (let index = 0; index < 6; index += 1) {
    const mark = mesh(
      pageGroup,
      geometry(new THREE.PlaneGeometry(0.92, 0.92)),
      materials.stamp,
      [0, 0.675 + index * 0.0008, 0.55],
      [-Math.PI / 2, 0, 0],
    );
    mark.visible = false;
    mark.castShadow = false;
    mark.receiveShadow = false;
    marks.push(mark);
  }
  ambient.formPage = formPage;
  ambient.pageGroup = pageGroup;
  ambient.pageOut = false;
  ambient.marks = marks;

  // The curling output sheet.
  const columns = 64;
  const rows = 12;
  const paperPositions = [];
  const paperUvs = [];
  const paperIndices = [];
  for (let i = 0; i <= columns; i += 1) {
    for (let j = 0; j <= rows; j += 1) {
      paperPositions.push(0, 0, 0);
      paperUvs.push(i / columns, j / rows);
      if (i < columns && j < rows) {
        const a = i * (rows + 1) + j;
        const b = a + rows + 1;
        paperIndices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const paperGeometry = geometry(new THREE.BufferGeometry());
  paperGeometry.setAttribute("position", new THREE.Float32BufferAttribute(paperPositions, 3));
  paperGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(paperUvs, 2));
  paperGeometry.setIndex(paperIndices);
  const paperFlow = new THREE.Group();
  paperFlow.position.set(-1.85, 0, 0.35);
  paperFlow.rotation.y = -0.46;
  press.add(paperFlow);
  const sheet = mesh(paperFlow, paperGeometry, sheetMaterial);
  sheet.frustumCulled = false;
  const sheetEdges = [];
  for (const side of [-1, 1]) {
    const edge = new THREE.BufferGeometry();
    edge.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array((rows + 1) * 3).fill(0), 3),
    );
    const line = new THREE.Line(edge, paperEdgeMaterial);
    line.frustumCulled = false;
    paperFlow.add(line);
    sheetEdges.push({ line, side });
  }
  const leadingEdge = new THREE.BufferGeometry();
  leadingEdge.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Array((columns + 1) * 3).fill(0), 3),
  );
  const leadingLine = new THREE.Line(leadingEdge, paperEdgeMaterial);
  leadingLine.frustumCulled = false;
  paperFlow.add(leadingLine);
  sheetEdges.push({ line: leadingLine, side: 2 });
  ambient.sheet = { geometry: paperGeometry, columns, rows, edges: sheetEdges, feed: -1 };

  function applyStamp(index) {
    ambient.pageOut = true;
    if (ambient.pageGroup) ambient.pageGroup.position.z = 0;
    const mark = marks[index % marks.length];
    const jitter = ((index % 3) - 1) * 0.08;
    mark.position.set(jitter, 0.675 + (index % 6) * 0.0009, 0.55 + jitter * 0.55);
    mark.rotation.z = -0.18 + (index % 3) * 0.16;
    mark.visible = true;
  }

  // Small paper offcuts burst from the press and fall. They are intentionally
  // finite: no perpetual confetti.
  const offcuts = [];
  const offcutMaterial = remember(
    new THREE.MeshToonMaterial({
      color: COLORS.paper,
      gradientMap: gradients,
      side: THREE.DoubleSide,
    }),
  );
  for (let index = 0; index < 18; index += 1) {
    const item = mesh(
      press,
      geometry(new THREE.PlaneGeometry(0.16 + Math.random() * 0.16, 0.1 + Math.random() * 0.13)),
      offcutMaterial,
      [0, -5, 0],
      [0, 0, 0],
    );
    item.castShadow = true;
    item.visible = false;
    offcuts.push({
      mesh: item,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      life: 0,
      active: false,
    });
  }
  ambient.offcuts = offcuts;

  function spawnOffcuts(count = 7) {
    let spawned = 0;
    for (const offcut of offcuts) {
      if (offcut.active) continue;
      offcut.active = true;
      offcut.life = 1.3 + Math.random() * 0.9;
      offcut.mesh.visible = true;
      offcut.mesh.position.set(0.55 + Math.random() * 0.8, 1.2, 1.45 + Math.random() * 0.5);
      offcut.velocity.set(
        -0.7 + Math.random() * 1.9,
        1.9 + Math.random() * 1.8,
        -0.4 + Math.random() * 1.5,
      );
      offcut.spin.set(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
      );
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  // A small gauge on the press.
  const gauge = new THREE.Group();
  gauge.position.set(1.2, 1.45, 0.98);
  press.add(gauge);
  cylinder(gauge, 0.27, 0.27, 0.12, materials.graphite, [0, 0, 0], [Math.PI / 2, 0, 0], 24);
  torus(gauge, 0.28, 0.035, materials.brass, [0, 0, 0.07], [0, 0, 0], 24);
  mesh(gauge, geometry(new THREE.CircleGeometry(0.22, 28)), materials.cream, [0, 0, 0.075]);
  const needle = mesh(
    gauge,
    geometry(new THREE.PlaneGeometry(0.015, 0.19)),
    materials.orangeDeep,
    [0, 0.02, 0.085],
  );
  ambient.needle = needle;

  // ---------------------------------------------------------------- LDraw

  const drawing = new THREE.Group();
  drawing.position.set(1.15, 0, 0.95);
  root.add(drawing);
  ambient.drawing = drawing;
  const drawingBase = cylinder(drawing, 2.0, 2.16, 0.66, materials.ink, [0, 0.33, 0], [0, 0, 0], 64);
  inkHull(drawingBase, 0.012);
  outline(drawingBase, { opacity: 0.85 });
  const drawingBand = cylinder(drawing, 2.03, 2.03, 0.14, materials.tealDeep, [0, 0.7, 0], [0, 0, 0], 64);
  inkHull(drawingBand, 0.014);
  outline(drawingBand, { opacity: 0.7 });
  cylinder(drawing, 1.95, 1.95, 0.08, materials.cream, [0, 0.8, 0], [0, 0, 0], 64);
  torus(drawing, 1.99, 0.03, materials.orange, [0, 0.84, 0], [Math.PI / 2, 0, 0], 64);
  torus(drawing, 1.97, 0.025, materials.brass, [0, 0.85, 0], [Math.PI / 2, 0, 0], 64);
  torus(drawing, 1.93, 0.012, materials.graphite, [0, 0.855, 0], [Math.PI / 2, 0, 0], 64);
  addRivets(drawing, [-1.65, -1.15, 1.15, 1.65], 0.74, 1.45, materials.brass, 0.035);

  plaque(
    drawing,
    labelTexture("LDRAW", "DRAWING FLOOR / 02", {
      width: 1024,
      height: 236,
      background: "#f4e6cd",
      ink: "#172d33",
      accent: "#d84b05",
    }),
    1.45,
    0.34,
    [0, 0.36, 2.02],
  );

  const paperTop = mesh(
    drawing,
    geometry(new THREE.CircleGeometry(1.88, 72)),
    paperMaterial,
    [0, 0.875, 0],
    [-Math.PI / 2, 0, 0],
  );
  paperTop.receiveShadow = true;

  // Ink registration drawing on the paper.
  const inkGroup = new THREE.Group();
  drawing.add(inkGroup);
  const drawInk = (points, radius = 0.012, material = materials.ink) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return mesh(inkGroup, geometry(new THREE.TubeGeometry(curve, 64, radius, 5, false)), material);
  };
  const spiral = [];
  for (let index = 0; index <= 120; index += 1) {
    const t = index / 120;
    const angle = t * Math.PI * 3.2;
    const radius = 0.32 + t * 1.28;
    spiral.push([Math.cos(angle) * radius, 0.895, Math.sin(angle) * radius]);
  }
  drawInk(spiral, 0.011);
  drawInk(
    [
      [-1.55, 0.896, -0.75],
      [1.45, 0.896, -0.75],
      [1.45, 0.896, 1.3],
      [-1.55, 0.896, 1.3],
      [-1.55, 0.896, -0.75],
    ],
    0.009,
  );
  for (const [x, z] of [
    [-1.12, -0.35],
    [0.9, -0.85],
    [1.28, 0.65],
    [-0.55, 1.12],
  ]) {
    torus(inkGroup, 0.1, 0.009, materials.ink, [x, 0.897, z], [Math.PI / 2, 0, 0], 18);
  }
  const dimension = [
    [-1.55, 0.9, -1.1],
    [1.45, 0.9, -1.1],
  ];
  drawInk(dimension, 0.006);
  for (const x of [-1.55, 1.45]) {
    drawInk(
      [
        [x, 0.9, -1.18],
        [x, 0.9, -1.02],
      ],
      0.006,
    );
  }

  const steps = [];
  const supports = [];
  const stepMaterial = materials.cream;
  const stepEdgeMaterial = materials.orange;
  const stepCount = 15;
  for (let index = 0; index < stepCount; index += 1) {
    const step = new THREE.Group();
    drawing.add(step);
    const top = box(step, 0.98, 0.075, 0.62, stepMaterial, [0, 0, 0], [0, 0, 0], 0.02);
    outline(top, { opacity: 0.86, threshold: 24 });
    box(step, 1.01, 0.028, 0.65, stepEdgeMaterial, [0, -0.052, 0], [0, 0, 0], 0.01);
    box(step, 0.035, 0.16, 0.56, stepMaterial, [-0.49, -0.08, 0], [0, 0, 0], 0.01);
    const support = cylinder(
      drawing,
      0.018,
      0.024,
      1,
      index % 3 === 0 ? materials.orange : materials.brass,
      [0, 0, 0],
      [0, 0, 0],
      8,
    );
    supports.push(support);
    step.userData.index = index;
    steps.push(step);
  }
  // A paper landing at the top of the stair.
  const landing = new THREE.Group();
  drawing.add(landing);
  box(landing, 1.0, 0.08, 0.68, stepMaterial, [0, 0, 0], [0, 0, 0], 0.02);
  box(landing, 0.06, 0.62, 0.62, stepMaterial, [-0.46, 0.3, 0], [0, 0, 0], 0.01);
  box(landing, 1.0, 0.06, 0.06, stepMaterial, [0, 0.6, -0.29], [0, 0, 0], 0.01);
  box(landing, 0.06, 0.62, 0.62, stepMaterial, [0.46, 0.3, 0], [0, 0, 0], 0.01);
  ambient.landing = landing;

  // The drawing arm and oversized pencil.
  const pencilArm = new THREE.Group();
  pencilArm.position.set(3.0, 0, -1.7);
  root.add(pencilArm);
  cylinder(pencilArm, 0.14, 0.2, 4.9, materials.brass, [0, 2.45, 0], [0, 0, 0], 18);
  cylinder(pencilArm, 0.27, 0.27, 0.15, materials.graphite, [0, 0.2, 0], [0, 0, 0], 18);
  torus(pencilArm, 0.28, 0.04, materials.orange, [0, 0.28, 0], [Math.PI / 2, 0, 0], 20);
  const arm = new THREE.Group();
  arm.position.set(0, 4.75, 0);
  pencilArm.add(arm);
  sphere(arm, 0.22, materials.graphite, [0, 0, 0], 16);
  rod(arm, [0, 0, 0], [-1.8, 0.25, 0.8], 0.075, materials.orange);
  rod(arm, [-1.8, 0.25, 0.8], [-2.45, 0.15, 1.45], 0.06, materials.orange);
  sphere(arm, 0.16, materials.brass, [-1.8, 0.25, 0.8], 12);
  const pencil = new THREE.Group();
  pencil.position.set(-2.55, -0.05, 1.55);
  pencil.rotation.set(-0.08, 0.1, -0.12);
  arm.add(pencil);
  cylinder(pencil, 0.19, 0.19, 2.2, materials.orangeDeep, [0, 0.45, 0], [0, 0, 0], 6);
  cylinder(pencil, 0.2, 0.2, 0.18, materials.cream, [0, 1.5, 0], [0, 0, 0], 6);
  cylinder(pencil, 0.17, 0.17, 0.12, materials.brass, [0, 1.64, 0], [0, 0, 0], 6);
  cylinder(pencil, 0.19, 0.19, 0.2, materials.brass, [0, -0.66, 0], [0, 0, 0], 6);
  cylinder(pencil, 0.0, 0.19, 0.5, materials.graphite, [0, -1.01, 0], [Math.PI, 0, 0], 6);
  torus(pencil, 0.23, 0.035, materials.brass, [0, -0.55, 0], [Math.PI / 2, 0, 0], 18);
  ambient.pencilArm = arm;
  ambient.pencil = pencil;

  // A stool and mug make the drawing station feel occupied.
  const stool = new THREE.Group();
  stool.position.set(2.75, 0, 1.75);
  root.add(stool);
  cylinder(stool, 0.48, 0.52, 0.16, materials.cream, [0, 0.95, 0], [0, 0, 0], 24);
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    rod(stool, [Math.cos(angle) * 0.36, 0.9, Math.sin(angle) * 0.36], [Math.cos(angle) * 0.58, 0.02, Math.sin(angle) * 0.58], 0.035, materials.orange);
  }
  const mug = new THREE.Group();
  mug.position.set(2.62, 1.04, 1.58);
  root.add(mug);
  cylinder(mug, 0.16, 0.14, 0.3, materials.cream, [0, 0.15, 0], [0, 0, 0], 18);
  torus(mug, 0.14, 0.03, materials.orange, [0, 0.16, 0], [Math.PI / 2, 0, 0], 18);
  torus(mug, 0.12, 0.025, materials.cream, [0.17, 0.18, 0], [Math.PI / 2, 0, 0], 16);

  // --------------------------------------------------------------- analytics

  const lens = new THREE.Group();
  lens.position.set(5.35, 0, -1.15);
  lens.rotation.y = -0.22;
  root.add(lens);
  ambient.lens = lens;
  inkHull(cylinder(lens, 1.7, 1.9, 0.32, materials.ink, [0, 0.16, 0], [0, 0, 0], 64), 0.014);
  inkHull(cylinder(lens, 1.55, 1.7, 0.24, materials.orange, [0, 0.43, 0], [0, 0, 0], 64), 0.014);
  cylinder(lens, 1.2, 1.45, 0.22, materials.graphite, [0, 0.64, 0], [0, 0, 0], 64);
  torus(lens, 1.23, 0.035, materials.brass, [0, 0.76, 0], [Math.PI / 2, 0, 0], 52);
  cylinder(lens, 0.34, 0.4, 2.2, materials.brass, [0, 1.8, 0], [0, 0, 0], 28);
  for (const y of [1.25, 1.9, 2.55]) {
    torus(lens, 0.4, 0.035, materials.orange, [0, y, 0], [Math.PI / 2, 0, 0], 24);
  }
  for (const y of [1.55, 2.22]) {
    torus(lens, 0.43, 0.03, materials.graphite, [0, y, 0], [Math.PI / 2, 0, 0], 24);
  }
  box(lens, 0.7, 0.28, 0.38, materials.graphite, [0, 1.05, 0.62], [0, 0, 0], 0.04);
  plaque(
    lens,
    labelTexture("COMPOSER", "EVIDENCE LENS / 03", {
      width: 1024,
      height: 236,
      background: "#f4e6cd",
      ink: "#172d33",
      accent: "#d84b05",
    }),
    1.5,
    0.35,
    [0, 0.72, 1.45],
  );
  const tape = plaque(lens, tapeTexture(), 1.85, 0.3, [0, 0.36, 1.75], [-0.18, 0, 0]);
  tape.receiveShadow = false;

  // Gimbal arms.
  rod(lens, [-1.15, 3.3, 0], [-1.5, 4.6, 0], 0.075, materials.orange);
  rod(lens, [1.15, 3.3, 0], [1.5, 4.6, 0], 0.075, materials.orange);
  sphere(lens, 0.18, materials.brass, [-1.5, 4.65, 0], 14);
  sphere(lens, 0.18, materials.brass, [1.5, 4.65, 0], 14);
  torus(lens, 0.22, 0.06, materials.graphite, [-1.5, 4.8, 0], [0, Math.PI / 2, 0], 20);
  torus(lens, 0.22, 0.06, materials.graphite, [1.5, 4.8, 0], [0, Math.PI / 2, 0], 20);

  const lensHead = new THREE.Group();
  lensHead.position.set(0, 4.95, 0.05);
  lensHead.rotation.set(-0.08, 0, -0.02);
  lens.add(lensHead);
  const outerRing = torus(lensHead, 1.82, 0.13, materials.orange, [0, 0, 0], [0, 0, 0], 72);
  inkHull(outerRing, 0.012);
  outline(outerRing, { opacity: 0.55, threshold: 30 });
  torus(lensHead, 1.86, 0.018, materials.graphite, [0, 0, 0], [0, 0, 0], 72);
  torus(lensHead, 1.66, 0.06, materials.brass, [0, 0, 0.02], [0, 0, 0], 72);
  torus(lensHead, 1.94, 0.035, materials.orangeDeep, [0, 0, -0.03], [0, 0, 0], 72);
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2;
    box(
      lensHead,
      0.14,
      0.28,
      0.18,
      materials.orange,
      [Math.cos(angle) * 1.9, Math.sin(angle) * 1.9, -0.02],
      [0, 0, angle],
      0.03,
    );
  }
  const glass = mesh(
    lensHead,
    geometry(new THREE.CircleGeometry(1.57, 72)),
    materials.glass,
    [0, 0, 0.09],
  );
  glass.castShadow = false;
  glass.receiveShadow = false;
  const frontGlass = mesh(
    lensHead,
    geometry(new THREE.CircleGeometry(1.57, 72)),
    materials.glass,
    [0, 0, 0.43],
  );
  frontGlass.material = remember(
    new THREE.MeshPhysicalMaterial({
      color: 0xb7e2da,
      transparent: true,
      opacity: 0.08,
      roughness: 0.02,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  frontGlass.castShadow = false;
  frontGlass.receiveShadow = false;
  const glassRim = torus(lensHead, 1.58, 0.045, materials.cream, [0, 0, 0.01], [0, 0, 0], 72);
  glassRim.castShadow = false;
  const highlight = new THREE.EllipseCurve(0.25, 0.38, 1.18, 1.05, 0.35, 1.32, false, 0);
  const highlightLine = new THREE.Line(
    geometry(new THREE.BufferGeometry().setFromPoints(highlight.getPoints(28))),
    remember(new THREE.LineBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.72 })),
  );
  highlightLine.position.z = 0.46;
  lensHead.add(highlightLine);
  const gleam = mesh(
    lensHead,
    geometry(new THREE.RingGeometry(1.05, 1.46, 32, 1, -0.2, 0.85)),
    remember(
      new THREE.MeshBasicMaterial({
        color: 0xfff3d8,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
    [0, 0, 0.47],
    [0, 0, 0.35],
  );
  gleam.castShadow = false;
  gleam.receiveShadow = false;

  // Three evidence rings around a small mechanical orrery.
  const orrery = new THREE.Group();
  orrery.position.z = 0.15;
  lensHead.add(orrery);
  const rings = [];
  const ringRadii = [1.25, 0.92, 0.62];
  for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
    const group = new THREE.Group();
    group.rotation.set(0.55 - ringIndex * 0.18, ringIndex * 0.72, ringIndex * 0.5);
    orrery.add(group);
    const ringMaterial = remember(
      new THREE.MeshToonMaterial({
        color: ringIndex === 0 ? COLORS.orange : COLORS.teal,
        gradientMap: gradients,
        transparent: true,
        opacity: ringIndex === 0 ? 1 : 0.42,
      }),
    );
    const tokenMaterial = remember(
      new THREE.MeshToonMaterial({
        color: ringIndex === 0 ? COLORS.orange : COLORS.cream,
        gradientMap: gradients,
        transparent: true,
        opacity: ringIndex === 0 ? 1 : 0.34,
      }),
    );
    const orbit = torus(group, ringRadii[ringIndex], 0.019, ringMaterial, [0, 0, 0], [0, 0, 0], 52);
    const tokens = [];
    for (let tokenIndex = 0; tokenIndex < 5; tokenIndex += 1) {
      const angle = (tokenIndex / 5) * Math.PI * 2 + ringIndex * 0.4;
      const token = box(
        group,
        ringIndex === 0 ? 0.2 : 0.15,
        0.07,
        0.16,
        tokenMaterial,
        [Math.cos(angle) * ringRadii[ringIndex], Math.sin(angle) * ringRadii[ringIndex], 0],
        [0, 0, angle],
        0.02,
      );
      tokens.push(token);
      rod(
        group,
        [0, 0, 0],
        [Math.cos(angle) * ringRadii[ringIndex], Math.sin(angle) * ringRadii[ringIndex], 0],
        0.008,
        ringMaterial,
        6,
      );
    }
    rings.push({ group, orbit, tokens, ringMaterial, tokenMaterial });
  }
  sphere(orrery, 0.28, materials.graphite, [0, 0, 0], 20);
  const core = sphere(orrery, 0.17, materials.orange, [0, 0, 0], 18);
  ambient.core = core;
  ambient.orrery = orrery;
  ambient.rings = rings;

  const ringAngles = [-0.62, 0, 0.62];

  // Focus collar, pointer and aperture ticks.
  const focusCollar = new THREE.Group();
  focusCollar.position.z = 0.38;
  lensHead.add(focusCollar);
  torus(focusCollar, 1.4, 0.035, materials.brass, [0, 0, 0], [0, 0, 0], 60);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    box(
      focusCollar,
      0.03,
      0.14,
      0.03,
      index % 3 === 0 ? materials.orange : materials.cream,
      [Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, 0],
      [0, 0, angle],
      0.005,
    );
  }
  const pointer = new THREE.Group();
  pointer.position.z = 0.56;
  lensHead.add(pointer);
  rod(pointer, [0, 1.72, 0], [0, 2.02, 0], 0.03, materials.orange);
  const pointerHead = mesh(
    pointer,
    geometry(new THREE.ConeGeometry(0.13, 0.3, 3)),
    materials.orange,
    [0, 2.03, 0],
    [0, 0, Math.PI],
  );
  pointerHead.castShadow = true;
  sphere(pointer, 0.065, materials.brass, [0, 1.7, 0], 10);
  for (let index = 0; index < 3; index += 1) {
    const angle = ringAngles[index];
    plaque(
      lensHead,
      labelTexture(`0${index + 1}`, "", {
        width: 256,
        height: 200,
        background: "#f3e4c8",
        ink: "#172d33",
        accent: "#d84b05",
        align: "center",
      }),
      0.34,
      0.26,
      [Math.sin(angle) * 2.18, Math.cos(angle) * 2.18, 0.3],
      [0, 0, -angle * 0.8],
    );
  }
  ambient.pointer = pointer;
  ambient.focusCollar = focusCollar;
  ambient.ringIndicator = [0, 1, 2].map((index) => {
    const angle = -0.9 + index * 0.32;
    return sphere(
      lensHead,
      0.055,
      index === 0 ? materials.orange : materials.graphite,
      [Math.cos(angle + Math.PI / 2) * 2.02, Math.sin(angle + Math.PI / 2) * 2.02, 0.06],
      10,
    );
  });

  const gaugeNeedle = mesh(
    lens,
    geometry(new THREE.PlaneGeometry(0.02, 0.38)),
    materials.orange,
    [0.7, 1.06, 0.86],
  );
  ambient.gaugeNeedle = gaugeNeedle;

  // A floor cable separate from the press: the lens is its own instrument.
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(6.2, 0.02, -0.4),
    new THREE.Vector3(7.2, 0.02, 1.2),
    new THREE.Vector3(7.5, 0.02, 3.0),
    new THREE.Vector3(8.2, 0.02, 4.3),
    new THREE.Vector3(9.2, 0.02, 4.7),
  ]);
  mesh(root, geometry(new THREE.TubeGeometry(cable, 40, 0.035, 7, false)), materials.graphite);

  // Wall clock with a live hand. A workshop should feel occupied.
  const clock = new THREE.Group();
  clock.position.set(1.7, 4.95, -3.78);
  root.add(clock);
  cylinder(clock, 0.62, 0.62, 0.09, materials.ink, [0, 0, 0], [Math.PI / 2, 0, 0], 40);
  torus(clock, 0.62, 0.055, materials.brass, [0, 0, 0.06], [0, 0, 0], 40);
  mesh(clock, geometry(new THREE.CircleGeometry(0.54, 40)), materials.cream, [0, 0, 0.09]);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    box(
      clock,
      index % 3 === 0 ? 0.035 : 0.018,
      index % 3 === 0 ? 0.1 : 0.055,
      0.012,
      index % 3 === 0 ? materials.orange : materials.graphite,
      [Math.cos(angle) * 0.43, Math.sin(angle) * 0.43, 0.105],
      [0, 0, angle],
      0.004,
    );
  }
  const minuteHand = mesh(
    clock,
    geometry(new THREE.PlaneGeometry(0.025, 0.36)),
    materials.graphite,
    [0, 0, 0.12],
  );
  minuteHand.geometry.translate(0, 0.18, 0);
  const hourHand = mesh(
    clock,
    geometry(new THREE.PlaneGeometry(0.04, 0.24)),
    materials.orange,
    [0, 0, 0.13],
  );
  hourHand.geometry.translate(0, 0.12, 0);
  sphere(clock, 0.05, materials.orange, [0, 0, 0.15], 10);
  ambient.clockHands = [minuteHand, hourHand];

  // A block-and-tackle above the drawing floor.
  const hoist = new THREE.Group();
  hoist.position.set(2.55, 7.0, -2.45);
  root.add(hoist);
  torus(hoist, 0.3, 0.06, materials.orange, [0, -0.2, 0], [0, 0, 0], 24);
  sphere(hoist, 0.12, materials.brass, [0, -0.2, 0], 12);
  rod(hoist, [0, 0, 0], [0, -4.7, 0], 0.024, materials.graphite, 6);
  for (let index = 0; index < 9; index += 1) {
    torus(hoist, 0.055, 0.014, materials.brass, [0, -0.55 - index * 0.26, 0], [0, 0, 0], 10);
  }
  cylinder(hoist, 0.25, 0.31, 0.32, materials.graphite, [0, -4.6, 0.18], [0, 0, 0], 16);
  const hook = torus(hoist, 0.13, 0.035, materials.steel, [0, -4.85, 0.18], [Math.PI / 2, 0, 0], 14);
  hook.rotation.z = 0.4;

  // Pegboard with the tools that made the mess.
  const board = new THREE.Group();
  board.position.set(-6.45, 4.55, -3.82);
  root.add(board);
  box(board, 2.3, 1.45, 0.08, materials.inkSoft, [0, 0, 0], [0, 0, 0], 0.03);
  box(board, 2.42, 1.56, 0.05, materials.orangeDeep, [0, 0, -0.05], [0, 0, 0], 0.03);
  for (let x = -0.95; x <= 0.95; x += 0.19) {
    for (let y = -0.56; y <= 0.56; y += 0.19) {
      sphere(board, 0.018, materials.graphite, [x, y, 0.05], 6);
    }
  }
  rod(board, [-0.65, 0.2, 0.08], [-0.2, 0.2, 0.08], 0.025, materials.cream);
  torus(board, 0.14, 0.03, materials.cream, [-0.72, 0.2, 0.08], [0, 0, 0], 18);
  rod(board, [0.05, 0.2, 0.08], [0.42, 0.2, 0.08], 0.025, materials.orange);
  box(board, 0.26, 0.18, 0.1, materials.graphite, [0.53, 0.2, 0.08], [0, 0, 0.2], 0.02);
  rod(board, [-0.5, -0.35, 0.08], [0.2, -0.35, 0.08], 0.02, materials.cream);

  // A work lamp and a fresh stack of stock keep the right-hand floor inhabited.
  const floorLamp = new THREE.Group();
  floorLamp.position.set(8.55, 0, 1.7);
  root.add(floorLamp);
  cylinder(floorLamp, 0.44, 0.52, 0.16, materials.ink, [0, 0.08, 0], [0, 0, 0], 24);
  torus(floorLamp, 0.34, 0.035, materials.orange, [0, 0.18, 0], [Math.PI / 2, 0, 0], 24);
  rod(floorLamp, [0, 0.18, 0], [0.25, 4.2, 0], 0.065, materials.brass, 10);
  rod(floorLamp, [0.25, 4.2, 0], [0.95, 4.45, 0.1], 0.055, materials.brass, 8);
  sphere(floorLamp, 0.1, materials.brass, [0.95, 4.45, 0.1], 10);
  cylinder(floorLamp, 0.12, 0.42, 0.36, materials.orange, [0.95, 4.22, 0.1], [0, 0, 0.1], 22).material = materials.orange;
  sphere(floorLamp, 0.1, remember(new THREE.MeshBasicMaterial({ color: 0xffd9a0 })), [0.95, 4.02, 0.1], 10);

  const stock = new THREE.Group();
  stock.position.set(7.35, 0, 2.35);
  root.add(stock);
  box(stock, 1.5, 0.7, 1.0, materials.ink, [0, 0.35, 0], [0, 0, 0], 0.04);
  for (let index = 0; index < 8; index += 1) {
    box(
      stock,
      1.34,
      0.045,
      0.86,
      index === 2 ? materials.orange : materials.paper,
      [0, 0.75 + index * 0.045, 0],
      [0, 0.015 * ((index % 3) - 1), 0],
      0.012,
    );
  }
  box(stock, 1.12, 0.2, 0.06, materials.cream, [0, 1.05, 0.47], [0, 0, 0], 0.01);

  // --------------------------------------------------------------- atmosphere

  const dustGeometry = geometry(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(90 * 3);
  const dustSeeds = [];
  for (let index = 0; index < 90; index += 1) {
    const position = [
      -8 + Math.random() * 17,
      0.7 + Math.random() * 6.3,
      -4 + Math.random() * 8,
    ];
    dustPositions[index * 3] = position[0];
    dustPositions[index * 3 + 1] = position[1];
    dustPositions[index * 3 + 2] = position[2];
    dustSeeds.push({ base: position, phase: Math.random() * Math.PI * 2, speed: 0.1 + Math.random() * 0.25 });
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    remember(
      new THREE.PointsMaterial({
        color: 0xffe6ba,
        size: 0.035,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    ),
  );
  dust.frustumCulled = false;
  root.add(dust);
  ambient.dust = { points: dust, seeds: dustSeeds };

  const flecks = [];
  for (let index = 0; index < 4; index += 1) {
    const fleck = mesh(
      root,
      geometry(new THREE.PlaneGeometry(0.34, 0.22)),
      paperMaterial,
      [-3 + index * 2.5, 2.2 + index * 0.7, -2.5 + index * 0.8],
      [0.2, index, 0.1],
    );
    fleck.castShadow = false;
    flecks.push({ mesh: fleck, phase: index * 1.4 });
  }
  ambient.flecks = flecks;

  // ------------------------------------------------------------ scene updates

  function setTheme(next) {
    const light = next === "light";
    hemi.color.set(light ? 0xfff4d9 : 0xffe7c0);
    hemi.groundColor.set(light ? 0xc6b294 : 0x183b44);
    hemi.intensity = light ? 2.05 : 1.55;
    key.color.set(light ? 0xfff6e5 : 0xfff0d2);
    key.intensity = light ? 3.1 : 2.65;
    rim.color.set(light ? 0x8ac4bb : 0x93d9d2);
    rim.intensity = light ? 0.7 : 1.25;
    fill.color.set(light ? 0xffb27d : 0xff9b62);
    fill.intensity = light ? 0.25 : 0.42;
    lampGlow.intensity = light ? 3.9 : 6.2;
    fog.color.set(light ? 0xeadcc2 : 0x0b1b21);
    fog.near = light ? 26 : 24;
    fog.far = light ? 48 : 46;
    materials.ink.color.set(light ? 0x12272d : COLORS.ink);
    floorMaterial.map = light ? floorLightMap : floorMap;
    floorMaterial.color.set(0xffffff);
    floorMaterial.needsUpdate = true;
    boundary.color.set(light ? 0x31464a : 0x1b2f34);
    towerMaterials(light);
  }

  function towerMaterials(light) {
    for (const child of towers.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      if (child.material === materials.inkSoft || child.material === materials.tealDeep) {
        child.material.color.set(light ? 0x264349 : 0x152e35);
      }
    }
  }

  function updatePaper(feed) {
    const sheetState = ambient.sheet;
    if (Math.abs(sheetState.feed - feed) < 0.0005) return;
    sheetState.feed = feed;
    const attribute = sheetState.geometry.attributes.position;
    for (let i = 0; i <= columns; i += 1) {
      for (let j = 0; j <= rows; j += 1) {
        const [x, y, z] = paperPoint(i / columns, j / rows, feed);
        attribute.setXYZ(i * (rows + 1) + j, x, y, z);
      }
    }
    attribute.needsUpdate = true;
    sheetState.geometry.computeVertexNormals();
    sheetState.geometry.computeBoundingSphere();
    for (const { line, side } of sheetState.edges) {
      const edge = line.geometry.attributes.position;
      if (side === 2) {
        for (let i = 0; i <= columns; i += 1) {
          const [x, y, z] = paperPoint(i / columns, 1, feed);
          edge.setXYZ(i, x, y, z);
        }
      } else {
        for (let j = 0; j <= rows; j += 1) {
          const [x, y, z] = paperPoint(side < 0 ? 0 : 1, j / rows, feed);
          edge.setXYZ(j, x, y, z);
        }
      }
      edge.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    }
  }

  function updateDrawing(lift) {
    const deck = 0.895;
    for (let index = 0; index < steps.length; index += 1) {
      const pose = drawingPose(index, steps.length, lift);
      const step = steps[index];
      step.position.set(pose.x, deck + pose.y, pose.z);
      step.rotation.set(pose.rotX, pose.rotY, 0);
      step.scale.y = pose.scaleY;
      const support = supports[index];
      support.position.set(pose.x, deck + pose.y / 2, pose.z);
      support.scale.y = Math.max(0.015, pose.y);
      support.visible = pose.rise > 0.02;
    }
    const lastPose = drawingPose(steps.length - 1, steps.length, lift);
    landing.position.set(lastPose.x, deck + lastPose.y + 0.04, lastPose.z);
    landing.rotation.set(0.02, lastPose.rotY, 0);
    landing.scale.setScalar(0.66 + lastPose.rise * 0.2);
    const armLift = clamp(lift);
    arm.rotation.z = -armLift * 0.075;
    arm.rotation.x = armLift * 0.035;
    pencil.position.y = -0.05 + armLift * 0.55;
    pencil.rotation.z = -0.12 - armLift * 0.16;
  }

  let activeRing = -1;
  function updateLens({ progress, ringIndex, time, motion, dt = 1 / 60 }) {
    if (ringIndex !== activeRing) {
      activeRing = ringIndex;
      ambient.rings.forEach((ring, index) => {
        const active = index === ringIndex;
        ring.ringMaterial.color.set(active ? COLORS.orange : COLORS.teal);
        ring.tokenMaterial.color.set(active ? COLORS.orange : COLORS.cream);
        ring.orbit.scale.setScalar(active ? 1.1 : 0.96);
        ring.group.scale.setScalar(active ? 1.08 : 0.92);
        ring.group.position.z = active ? 0.12 : -0.08;
        ring.ringMaterial.transparent = true;
        ring.tokenMaterial.transparent = true;
        ring.ringMaterial.opacity = active ? 1 : 0.42;
        ring.tokenMaterial.opacity = active ? 1 : 0.34;
      });
      ambient.ringIndicator.forEach((indicator, index) => {
        indicator.material = index === ringIndex ? materials.orange : materials.graphite;
      });
    }
    const targetTilt = [-0.16, 0, 0.16][ringIndex];
    lensHead.rotation.z = THREE.MathUtils.damp(
      lensHead.rotation.z,
      targetTilt * 0.35,
      4,
      motion ? dt : 1,
    );
    focusCollar.rotation.z = progress * 1.7;
    ambient.orrery.scale.setScalar(0.84 + progress * 0.3);
    ambient.orrery.position.z = 0.12 + progress * 0.12;
    pointer.rotation.z = -ringAngles[ringIndex] * 0.92;
    gaugeNeedle.rotation.z = -1.2 + progress * 2.5;
    if (motion) {
      ambient.orrery.rotation.z = time * 0.055;
      ambient.orrery.rotation.x = Math.sin(time * 0.12) * 0.08;
      ambient.core.scale.setScalar(0.94 + Math.sin(time * 1.6) * 0.04);
    }
  }

  function updatePress({ impactAge, motion, feed, time, dt = 1 / 60 }) {
    const age = impactAge;
    let down = 0;
    let shake = 0;
    if (age >= 0 && age < 1.0) {
      if (age < 0.13) {
        down = easeInOut(age / 0.13);
        shake = down * 0.018;
      } else if (age < 0.22) {
        down = 1;
        shake = 0.02;
      } else {
        const recovery = (age - 0.22) / 0.72;
        down = 1 - easeInOut(clamp(recovery));
        shake = Math.sin(recovery * Math.PI * 1.5) * (1 - recovery) * 0.012;
      }
    }
    if (!motion) {
      down = 0;
      shake = 0;
    }
    ambient.ram.position.y = 1.4 - down * 0.44;
    ambient.ram.position.x = shake;
    ambient.lever.rotation.z = 0.05 + down * 0.62;
    ambient.handwheel.rotation.x = (ambient.handwheel.rotation.x + (motion ? 0.05 : 0)) % (Math.PI * 2);
    ambient.needle.rotation.z = -1.1 + down * 2.0;
    if (ambient.pageGroup) {
      let slide = 0;
      if (age >= 0.18 && age < 1.0) slide = smoothstep(0.18, 0.78, age) * 0.7;
      else if (ambient.pageOut) slide = 0.7;
      if (!motion) slide = ambient.pageOut ? 0.7 : 0;
      ambient.pageGroup.position.z = slide;
    }
    if (motion) {
      ambient.lever.rotation.x = Math.sin(time * 0.7) * 0.006;
    }
    updatePaper(feed);
    updateOffcuts(dt, motion);
  }

  function updateOffcuts(dt, motion) {
    if (!motion) return;
    for (const offcut of ambient.offcuts) {
      if (!offcut.active) continue;
      offcut.life -= dt;
      if (offcut.life <= 0) {
        offcut.active = false;
        offcut.mesh.visible = false;
        continue;
      }
      offcut.velocity.y -= 4.2 * dt;
      offcut.mesh.position.addScaledVector(offcut.velocity, dt);
      offcut.mesh.rotation.x += offcut.spin.x * dt;
      offcut.mesh.rotation.y += offcut.spin.y * dt;
      offcut.mesh.rotation.z += offcut.spin.z * dt;
      if (offcut.mesh.position.y < 0.04) {
        offcut.mesh.position.y = 0.04;
        offcut.velocity.multiplyScalar(0.2);
        offcut.spin.multiplyScalar(0.2);
      }
    }
  }

  function updateAmbient(time, motion) {
    if (!motion) return;
    for (const gear of gears) gear.group.rotation.z = time * gear.speed;
    ambient.lamps.forEach((lamp, index) => {
      lamp.group.rotation.z = Math.sin(time * 0.33 + lamp.phase) * 0.018;
      lamp.group.rotation.x = Math.sin(time * 0.22 + index) * 0.012;
    });
    ambient.sketches.forEach((sheet) => {
      sheet.rotation.z = Math.sin(time * 0.4 + (sheet.userData.phase ?? 0)) * 0.018;
    });
    ambient.hangingSheet.rotation.z = Math.sin(time * 0.35) * 0.012;
    ambient.flecks.forEach(({ mesh: fleck, phase }) => {
      fleck.position.y += Math.sin(time * 0.5 + phase) * 0.0007;
      fleck.rotation.z = 0.1 + Math.sin(time * 0.3 + phase) * 0.14;
      fleck.rotation.y = 0.2 + time * 0.03 + phase;
    });
    const dustAttribute = ambient.dust.points.geometry.attributes.position;
    ambient.dust.seeds.forEach((seed, index) => {
      dustAttribute.setXYZ(
        index,
        seed.base[0] + Math.sin(time * seed.speed + seed.phase) * 0.22,
        seed.base[1] + Math.sin(time * seed.speed * 0.7 + seed.phase) * 0.12,
        seed.base[2] + Math.cos(time * seed.speed + seed.phase) * 0.18,
      );
    });
    dustAttribute.needsUpdate = true;
    sign.rotation.z = Math.sin(time * 0.22) * 0.006;
    if (ambient.clockHands) {
      ambient.clockHands[0].rotation.z = -time * 0.08;
      ambient.clockHands[1].rotation.z = -time * 0.012;
    }
  }

  setTheme(theme);
  updatePaper(0.34);
  updateDrawing(0.58);
  updateLens({ progress: 0.5, ringIndex: 0, time: 0, motion: false });

  function dispose() {
    for (const resource of resources) {
      if (resource && typeof resource.dispose === "function") resource.dispose();
    }
    gradients.dispose();
    resources.clear();
  }

  return {
    scene,
    root,
    materials,
    updatePaper,
    updateDrawing,
    updateLens,
    updatePress,
    updateAmbient,
    setTheme,
    applyStamp,
    spawnOffcuts,
    dispose,
    ambient,
  };
}
