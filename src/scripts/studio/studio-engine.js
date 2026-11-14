import * as THREE from "three";
import { createStudioWorld } from "./studio-model.js";
import { createStudioFrameLoop } from "./studio-motion.js";
import {
  clamp,
  defaultStationId,
  damp,
  lensRing,
  stationById,
  studioStations,
} from "./studio-data.js";

const CAMERAS = {
  desktop: {
    press: {
      position: [0.0, 8.0, 21.2],
      target: [-2.65, 2.35, 0.95],
      fov: 38,
    },
    draw: {
      position: [0.2, 6.4, 14.6],
      target: [1.0, 2.3, 0.8],
      fov: 37,
    },
    lens: {
      position: [1.4, 7.5, 21.6],
      target: [3.9, 3.05, -0.7],
      fov: 38,
    },
  },
  tablet: {
    press: {
      position: [1.2, 6.5, 15.7],
      target: [-0.2, 3.0, 0.8],
      fov: 40,
    },
    draw: {
      position: [1.1, 6.6, 16.0],
      target: [0.9, 2.4, 0.6],
      fov: 39,
    },
    lens: {
      position: [3.4, 6.4, 14.4],
      target: [3.0, 3.9, -0.5],
      fov: 40,
    },
  },
  phone: {
    press: {
      position: [-1.3, 5.6, 13.0],
      target: [-2.3, 2.2, 2.0],
      fov: 46,
    },
    draw: {
      position: [1.0, 5.7, 10.8],
      target: [0.95, 2.1, 0.7],
      fov: 46,
    },
    lens: {
      position: [4.2, 5.7, 12.0],
      target: [5.15, 3.7, -0.8],
      fov: 46,
    },
  },
};

function readTheme() {
  if (typeof document === "undefined") return "dark";
  const declared = document.documentElement.getAttribute("data-theme");
  if (declared === "light" || declared === "dark") return declared;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function createStudioEngine({
  canvas,
  stage,
  onState = () => {},
  onReady = () => {},
  onLost = () => {},
  onError = () => {},
}) {
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    station: defaultStationId,
    progress: {
      press: stationById("press").initialProgress / 100,
      draw: stationById("draw").initialProgress / 100,
      lens: stationById("lens").initialProgress / 100,
    },
    target: {
      press: stationById("press").initialProgress / 100,
      draw: stationById("draw").initialProgress / 100,
      lens: stationById("lens").initialProgress / 100,
    },
    ringIndex: 0,
    paused: false,
    reduced: reducedQuery.matches,
    layout: layoutForWidth(stage.clientWidth),
    theme: readTheme(),
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
    });
  } catch (error) {
    onError(error);
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));

  // A small contour pass is what turns the shaded meshes into a printed
  // illustration: depth discontinuities become ink, and a fine screen grain
  // sits over the whole workshop. It is a single full-screen draw, not a
  // chain of bloom, blur and colour effects.
  const post = {
    target: null,
    scene: new THREE.Scene(),
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    material: null,
    width: 1,
    height: 1,
  };
  post.material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      near: { value: 0.1 },
      far: { value: 80 },
      ink: { value: new THREE.Color(0x061116) },
      strength: { value: 0.92 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float near;
      uniform float far;
      uniform vec3 ink;
      uniform float strength;
      varying vec2 vUv;

      float linearDepth(float depth) {
        float z = depth * 2.0 - 1.0;
        return (2.0 * near * far) / (far + near - z * (far - near));
      }

      void main() {
        vec2 px = 1.0 / max(resolution, vec2(1.0));
        vec4 color = texture2D(tDiffuse, vUv);
        float centre = linearDepth(texture2D(tDepth, vUv).x);
        float left = linearDepth(texture2D(tDepth, vUv - vec2(px.x, 0.0)).x);
        float right = linearDepth(texture2D(tDepth, vUv + vec2(px.x, 0.0)).x);
        float up = linearDepth(texture2D(tDepth, vUv + vec2(0.0, px.y)).x);
        float down = linearDepth(texture2D(tDepth, vUv - vec2(0.0, px.y)).x);
        float edge = smoothstep(0.055, 0.46, max(abs(centre - left), abs(centre - right)) + max(abs(centre - up), abs(centre - down)));
        float grain = fract(sin(dot(vUv * resolution, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 printed = mix(color.rgb, ink, edge * strength);
        printed = (printed - 0.5) * 1.035 + 0.5;
        printed += (grain - 0.5) * 0.022;
        printed = mix(1.055 * pow(max(printed, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, printed * 12.92, step(printed, vec3(0.0031308)));
        float alpha = clamp(color.a + edge * 0.94, 0.0, 1.0);
        gl_FragColor = vec4(printed, alpha);
      }
    `,
  });
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.material);
  postQuad.frustumCulled = false;
  post.scene.add(postQuad);

  function resizePost() {
    const width = Math.max(1, Math.round(stage.clientWidth * renderer.getPixelRatio()));
    const height = Math.max(1, Math.round(stage.clientHeight * renderer.getPixelRatio()));
    if (post.width === width && post.height === height && post.target) return;
    post.width = width;
    post.height = height;
    if (post.target) {
      post.target.dispose();
      post.target.depthTexture?.dispose();
    }
    const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    const target = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture,
    });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.generateMipmaps = false;
    post.target = target;
    post.material.uniforms.tDiffuse.value = target.texture;
    post.material.uniforms.tDepth.value = depthTexture;
    post.material.uniforms.resolution.value.set(width, height);
  }

  const world = createStudioWorld({ mobile: stage.clientWidth < 760, theme: state.theme });
  const scene = world.scene;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  let alive = true;
  let visible = true;
  let elapsed = 0;
  let stampAt = -Infinity;
  let stampCount = 0;
  let stampPending = false;
  let cameraSettled = false;
  let qualitySamples = 0;
  let qualityTime = 0;
  let qualityReduced = false;
  const size = { width: 0, height: 0, pixelRatio: 0 };

  const look = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const finalPosition = new THREE.Vector3();
  const verticalAxis = new THREE.Vector3(0, 1, 0);
  const horizontalAxis = new THREE.Vector3(1, 0, 0);
  const orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, hoverYaw: 0, hoverPitch: 0 };
  let dragging = false;
  let dragPointer = null;
  let lastPointer = { x: 0, y: 0 };

  const motionEnabled = () =>
    !state.paused && !state.reduced && visible && !document.hidden;

  const frameLoop = createStudioFrameLoop({
    render: frame,
    canRender: () => alive && visible && !document.hidden,
    onReady,
    onError: (error) => {
      alive = false;
      onLost(error);
    },
  });

  const snapshot = () => ({
    station: state.station,
    progress: Math.round(state.progress[state.station] * 100),
    target: Math.round(state.target[state.station] * 100),
    ringIndex: state.ringIndex,
    ring: lensRing("lens", state.ringIndex),
    paused: state.paused,
    reduced: state.reduced,
    theme: state.theme,
    layout: state.layout,
    live: true,
  });

  function emit(reason, extra = {}) {
    onState(snapshot(), { reason, ...extra });
  }

  function layoutForWidth(width) {
    if (width < 760) return "phone";
    if (width < 1180) return "tablet";
    return "desktop";
  }

  function presetFor() {
    const group = CAMERAS[state.layout] ?? CAMERAS.desktop;
    return group[state.station] ?? group.press;
  }

  function setCameraTargets() {
    const preset = presetFor();
    desiredPosition.set(...preset.position);
    desiredTarget.set(...preset.target);
    camera.fov = preset.fov;
    const compact = stage.clientWidth < 760;
    if (compact) {
      desiredPosition.multiplyScalar(1.06);
      desiredPosition.y += 0.35;
    }
    if (state.layout === "desktop" && stage.clientWidth < 1320) {
      desiredPosition.z += 0.7;
    }
    orbit.targetYaw = clamp(orbit.targetYaw, -0.28, 0.28);
    orbit.targetPitch = clamp(orbit.targetPitch, -0.14, 0.14);
    camera.aspect = Math.max(0.25, stage.clientWidth / Math.max(1, stage.clientHeight));
    camera.updateProjectionMatrix();
    cameraSettled = false;
  }

  function resize() {
    if (!alive) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const nextLayout = layoutForWidth(width);
    const pixelRatio = qualityReduced
      ? 1
      : Math.min(devicePixelRatio || 1, nextLayout === "phone" ? 1.5 : 1.75);
    if (
      width === size.width &&
      height === size.height &&
      pixelRatio === size.pixelRatio
    ) return;
    const framingChanged = width !== size.width || nextLayout !== state.layout;
    state.layout = nextLayout;
    if (pixelRatio !== size.pixelRatio) renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    size.width = width;
    size.height = height;
    size.pixelRatio = pixelRatio;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resizePost();
    if (framingChanged) setCameraTargets();
    requestRender();
  }

  function requestRender() {
    frameLoop.request();
  }

  function updateCamera(dt, motion) {
    const preset = presetFor();
    if (camera.fov !== preset.fov) {
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
    }
    desiredTarget.set(...preset.target);
    desiredPosition.set(...preset.position);
    if (state.layout === "desktop" && stage.clientWidth < 1320) desiredPosition.z += 0.7;
    if (state.layout === "phone") {
      desiredPosition.multiplyScalar(1.06);
      desiredPosition.y += 0.35;
    }

    orbit.yaw = motion ? damp(orbit.yaw, orbit.targetYaw, 8, dt) : orbit.targetYaw;
    orbit.pitch = motion ? damp(orbit.pitch, orbit.targetPitch, 8, dt) : orbit.targetPitch;
    cameraOffset.copy(desiredPosition).sub(desiredTarget);
    cameraOffset.applyAxisAngle(verticalAxis, orbit.yaw + orbit.hoverYaw);
    cameraOffset.applyAxisAngle(horizontalAxis, orbit.pitch + orbit.hoverPitch);
    finalPosition.copy(desiredTarget).add(cameraOffset);
    const blend = motion ? 1 - Math.exp(-8 * dt) : 1;
    camera.position.lerp(finalPosition, blend);
    look.lerp(desiredTarget, blend);
    camera.lookAt(look);
    const distance =
      camera.position.distanceTo(finalPosition) + look.distanceTo(desiredTarget);
    cameraSettled = distance < 0.003;
    if (cameraSettled) {
      camera.position.copy(finalPosition);
      look.copy(desiredTarget);
      camera.lookAt(look);
    }
  }

  function syncProgress(motion, dt) {
    for (const station of studioStations) {
      const id = station.id;
      state.progress[id] =
        motion && Math.abs(state.target[id] - state.progress[id]) > 0.0004
          ? damp(state.progress[id], state.target[id], 5.2, dt)
          : state.target[id];
    }
  }

  function applyPendingStamp(motion) {
    if (!stampPending) return;
    const age = motion ? elapsed - stampAt : 999;
    if (age < 0.11) return;
    stampPending = false;
    stampCount += 1;
    world.applyStamp(stampCount - 1);
    if (motion) world.spawnOffcuts(7);
  }

  function frame(dt) {
    const motion = motionEnabled();
    if (motion) elapsed += dt;

    // Measure real frames rather than promising a frame rate. A single step
    // down in resolution protects battery and interaction on slower phones.
    if (motion && dt > 0) {
      qualitySamples += 1;
      qualityTime += dt;
    }
    if (!qualityReduced && qualitySamples >= 90) {
      const average = qualityTime / qualitySamples;
      if (average > 1 / 42 && renderer.getPixelRatio() > 1.02) {
        qualityReduced = true;
        resize();
      }
      qualitySamples = 0;
      qualityTime = 0;
    }

    syncProgress(motion, dt);
    const pressProgress = state.progress.press;
    const drawProgress = state.progress.draw;
    const lensProgress = state.progress.lens;

    applyPendingStamp(motion);
    world.updatePress({
      impactAge: motion ? elapsed - stampAt : -1,
      motion,
      feed: pressProgress,
      time: elapsed,
      dt,
    });
    world.updateDrawing(drawProgress);
    world.updateLens({
      progress: lensProgress,
      ringIndex: state.ringIndex,
      time: elapsed,
      motion,
      dt,
    });
    world.updateAmbient(elapsed, motion);
    updateCamera(dt, motion);

    renderer.setRenderTarget(post.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(post.scene, post.camera);

    // Paused/reduced controls apply their complete static state in this frame.
    // Only an active scene needs another frame; readiness follows this render.
    return motion;
  }

  function setStation(id, { snap = false, announce = true } = {}) {
    if (!studioStations.some((station) => station.id === id)) return;
    if (id === state.station) {
      if (announce) emit("station");
      requestRender();
      return;
    }
    state.station = id;
    setCameraTargets();
    if (snap || state.reduced || state.paused) {
      state.progress[id] = state.target[id];
      camera.position.copy(desiredPosition);
      look.copy(desiredTarget);
    }
    orbit.targetYaw = 0;
    orbit.targetPitch = 0;
    cameraSettled = false;
    emit("station");
    requestRender();
  }

  function setProgress(percent, { snap = false, announce = false } = {}) {
    const next = clamp(Number(percent) / 100);
    state.target[state.station] = next;
    if (snap || state.reduced || state.paused) state.progress[state.station] = next;
    cameraSettled = false;
    emit("progress");
    requestRender();
  }

  function action() {
    const id = state.station;
    if (id === "press") {
      stampAt = elapsed;
      stampPending = true;
      if (state.reduced || state.paused) {
        stampPending = false;
        stampAt = -Infinity;
        stampCount += 1;
        world.applyStamp(stampCount - 1);
      }
      emit("action", { action: "press", stamp: stampCount });
    } else if (id === "draw") {
      const target = state.target.draw > 0.8 ? 0.04 : 1;
      state.target.draw = target;
      if (state.reduced || state.paused) state.progress.draw = target;
      cameraSettled = false;
      emit("action", { action: "draw" });
    } else {
      state.ringIndex = (state.ringIndex + 1) % 3;
      emit("action", { action: "lens" });
    }
    requestRender();
  }

  function setPaused(paused) {
    state.paused = Boolean(paused);
    if (state.paused) stampAt = -Infinity;
    frameLoop.suspend();
    emit("pause");
    requestRender();
  }

  function setReduced(reduced) {
    state.reduced = Boolean(reduced);
    if (state.reduced) stampAt = -Infinity;
    frameLoop.suspend();
    emit("motion");
    requestRender();
  }

  function setTheme(theme) {
    state.theme = theme;
    world.setTheme(theme);
    emit("theme");
    requestRender();
  }

  function onPointerMove(event) {
    if (event.pointerType === "touch") return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    if (dragging && dragPointer === event.pointerId) {
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      lastPointer = { x: event.clientX, y: event.clientY };
      orbit.targetYaw = clamp(orbit.targetYaw + dx * 0.0022, -0.28, 0.28);
      orbit.targetPitch = clamp(orbit.targetPitch + dy * 0.0016, -0.14, 0.14);
    } else if (!state.reduced && !state.paused) {
      orbit.hoverYaw = clamp(x * 0.1, -0.08, 0.08);
      orbit.hoverPitch = clamp(y * 0.05, -0.04, 0.04);
    } else {
      return;
    }
    cameraSettled = false;
    requestRender();
  }

  function onPointerDown(event) {
    if (event.pointerType === "touch") return;
    dragging = true;
    dragPointer = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    stage.setPointerCapture?.(event.pointerId);
  }

  function onPointerUp(event) {
    if (dragPointer !== event.pointerId) return;
    dragging = false;
    dragPointer = null;
    stage.releasePointerCapture?.(event.pointerId);
  }

  function resetOrbit() {
    orbit.targetYaw = 0;
    orbit.targetPitch = 0;
    orbit.hoverYaw = 0;
    orbit.hoverPitch = 0;
    cameraSettled = false;
    requestRender();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!visible) {
        frameLoop.suspend();
        qualitySamples = 0;
        qualityTime = 0;
      } else {
        requestRender();
      }
    },
    { threshold: 0 },
  );
  observer.observe(stage);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);

  const onVisibility = () => {
    if (document.hidden) {
      frameLoop.suspend();
      qualitySamples = 0;
      qualityTime = 0;
    } else {
      requestRender();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("pointerleave", resetOrbit);
  stage.addEventListener("dblclick", resetOrbit);

  const onContextLost = (event) => {
    event.preventDefault();
    frameLoop.suspend();
    alive = false;
    onLost(new Error("The GPU context was lost."));
  };
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  const onReducedChange = (event) => {
    setReduced(event.matches);
    if (event.matches) resetOrbit();
  };
  reducedQuery.addEventListener("change", onReducedChange);

  const themeObserver = new MutationObserver(() => {
    const theme = readTheme();
    if (theme !== state.theme) setTheme(theme);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  setCameraTargets();
  camera.position.copy(desiredPosition);
  look.copy(desiredTarget);
  camera.lookAt(look);
  world.updatePaper(state.progress.press);
  world.updateDrawing(state.progress.draw);
  world.updateLens({
    progress: state.progress.lens,
    ringIndex: 0,
    time: 0,
    motion: false,
  });
  resize();
  emit("init");
  requestRender();

  function dispose({ preserveContext = false } = {}) {
    alive = false;
    frameLoop.dispose();
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointerup", onPointerUp);
    stage.removeEventListener("pointercancel", onPointerUp);
    stage.removeEventListener("pointerleave", resetOrbit);
    stage.removeEventListener("dblclick", resetOrbit);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    reducedQuery.removeEventListener("change", onReducedChange);
    themeObserver.disconnect();
    world.dispose();
    post.target?.dispose();
    post.target?.depthTexture?.dispose();
    post.material.dispose();
    postQuad.geometry.dispose();
    renderer.dispose();
    if (!preserveContext) renderer.forceContextLoss?.();
  }

  window.addEventListener(
    "pagehide",
    (event) => {
      frameLoop.suspend();
      if (event.persisted) return;
      dispose();
    },
  );

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !alive) return;
    frameLoop.suspend();
    cameraSettled = false;
    requestRender();
  });

  return {
    setStation,
    setProgress,
    action,
    setPaused,
    setReduced,
    setTheme,
    resetOrbit,
    resize,
    dispose,
    snapshot,
    state,
  };
}
