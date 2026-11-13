import * as THREE from "three";

// Every texture here is drawn in the browser from simple vector and noise
// operations. No screenshots, third-party imagery or runtime services are used.

const FONT = "Space, ui-sans-serif, system-ui, sans-serif";

function canvas(width, height) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return [element, element.getContext("2d")];
}

function textureFrom(element, { srgb = true, repeat = null, anisotropy = 4 } = {}) {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paperTexture() {
  const [element, ctx] = canvas(256, 256);
  const random = mulberry32(42);
  ctx.fillStyle = "#fbf3e1";
  ctx.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 5200; index += 1) {
    const x = random() * 256;
    const y = random() * 256;
    const alpha = 0.025 + random() * 0.07;
    ctx.fillStyle = random() > 0.55 ? `rgba(115,94,66,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 0.8 + random() * 1.5, 0.7 + random() * 1.4);
  }
  ctx.strokeStyle = "rgba(126,103,72,0.09)";
  ctx.lineWidth = 0.6;
  for (let index = 0; index < 110; index += 1) {
    const x = random() * 256;
    const y = random() * 256;
    const length = 8 + random() * 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + length * 0.5, y + (random() - 0.5) * 6, x + length, y + (random() - 0.5) * 3);
    ctx.stroke();
  }
  return textureFrom(element, { repeat: [2, 2] });
}

export function enamelTexture() {
  const [element, ctx] = canvas(128, 128);
  const random = mulberry32(7);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  for (let index = 0; index < 900; index += 1) {
    const shade = 226 + Math.floor(random() * 26);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(random() * 128, random() * 128, 1, 1);
  }
  return textureFrom(element, { repeat: [2, 2] });
}

export function floorTexture(mode = "dark") {
  const light = mode === "light";
  const [element, ctx] = canvas(512, 512);
  const random = mulberry32(19);
  ctx.fillStyle = light ? "#d8c6a7" : "#102127";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = light ? "rgba(46,63,66,0.18)" : "rgba(238,222,192,0.15)";
  ctx.lineWidth = 1.4;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  ctx.strokeStyle = light ? "rgba(46,63,66,0.07)" : "rgba(238,222,192,0.055)";
  ctx.lineWidth = 8;
  for (let index = 0; index < 22; index += 1) {
    ctx.beginPath();
    const x = random() * 512;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (random() - 0.5) * 30, 512);
    ctx.stroke();
  }
  for (let index = 0; index < 360; index += 1) {
    const shade = random();
    ctx.fillStyle =
      shade > 0.72
        ? `rgba(252,91,5,${0.06 + random() * 0.08})`
        : light
          ? `rgba(255,249,235,${0.05 + random() * 0.08})`
          : `rgba(232,216,184,${0.02 + random() * 0.05})`;
    ctx.beginPath();
    ctx.arc(random() * 512, random() * 512, 0.7 + random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return textureFrom(element, { repeat: [5, 4] });
}

export function formTexture() {
  const [element, ctx] = canvas(1024, 720);
  const random = mulberry32(88);
  ctx.fillStyle = "#f7edd8";
  ctx.fillRect(0, 0, 1024, 720);
  ctx.fillStyle = "#fc5b05";
  ctx.fillRect(0, 0, 1024, 18);
  ctx.fillStyle = "#263a3e";
  ctx.lineWidth = 3;
  ctx.strokeRect(38, 38, 948, 644);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(54, 54, 916, 612);

  ctx.fillStyle = "#263a3e";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("APP COMPOSER / PAPERWORK", 78, 100);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText("FICTIONAL STUDIO FORM / DO NOT SEND", 640, 99);

  ctx.fillStyle = "#fc5b05";
  ctx.fillRect(78, 122, 86, 9);
  ctx.fillStyle = "#263a3e";
  ctx.font = `600 58px ${FONT}`;
  ctx.fillText("FIELD NOTE  042", 78, 200);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("A small record of a thing worth making.", 80, 232);

  const field = (label, x, y, width) => {
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = "#253f43";
    ctx.fillText(label, x, y);
    ctx.strokeStyle = "rgba(38,58,62,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 12, width, 38);
  };
  field("PROJECT", 78, 286, 402);
  field("OWNER", 512, 286, 396);
  field("BUILD", 78, 366, 248);
  field("RELEASE", 358, 366, 236);
  field("DRAWING", 626, 366, 282);

  ctx.strokeStyle = "rgba(38,58,62,0.5)";
  ctx.lineWidth = 1.2;
  for (let index = 0; index < 5; index += 1) {
    const y = 476 + index * 36;
    ctx.beginPath();
    ctx.moveTo(78, y);
    ctx.lineTo(index % 2 ? 690 : 940, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(38,58,62,0.42)";
  ctx.setLineDash([6, 7]);
  ctx.strokeRect(758, 440, 186, 166);
  ctx.setLineDash([]);
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = "#6b7778";
  ctx.fillText("STAMP HERE", 802, 430);

  ctx.save();
  ctx.translate(925, 588);
  ctx.rotate(-0.04);
  ctx.strokeStyle = "rgba(38,58,62,0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-19, 2);
  ctx.lineTo(-5, 17);
  ctx.lineTo(22, -18);
  ctx.stroke();
  ctx.restore();

  for (let index = 0; index < 85; index += 1) {
    ctx.fillStyle = `rgba(104,86,58,${0.02 + random() * 0.04})`;
    ctx.fillRect(random() * 1024, random() * 720, 1 + random() * 2, 1 + random() * 2);
  }
  return textureFrom(element, { anisotropy: 8 });
}

export function stampTexture() {
  const [element, ctx] = canvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(-0.1);
  ctx.fillStyle = "rgba(199,68,0,0.94)";
  ctx.beginPath();
  ctx.roundRect(-190, -112, 380, 224, 18);
  ctx.fill();
  ctx.strokeStyle = "#f7e8cc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-178, -100, 356, 200, 12);
  ctx.stroke();
  ctx.fillStyle = "#f7e8cc";
  ctx.font = `600 92px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("FILED", 0, 4);
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText("FICTIONAL / 042", 0, 42);
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#f7e8cc";
  ctx.beginPath();
  ctx.moveTo(-132, 56);
  ctx.lineTo(-92, 84);
  ctx.lineTo(-16, 32);
  ctx.stroke();
  ctx.restore();
  return textureFrom(element, { anisotropy: 8 });
}

export function labelTexture(title, subtitle, options = {}) {
  const {
    width = 1024,
    height = 256,
    background = "#f4e7ce",
    ink = "#22363b",
    accent = "#d84b05",
    align = "left",
  } = options;
  const [element, ctx] = canvas(width, height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, height * 0.055);
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  if (align === "center") ctx.textAlign = "center";
  const x = align === "center" ? width / 2 : width * 0.055;
  ctx.font = `600 ${Math.round(height * 0.3)}px ${FONT}`;
  ctx.fillText(title, x, height * 0.45);
  ctx.fillStyle = accent;
  ctx.font = `600 ${Math.round(height * 0.105)}px ${FONT}`;
  ctx.fillText(subtitle, x, height * 0.75);
  return textureFrom(element, { anisotropy: 8 });
}

export function composerSignTexture() {
  const [element, ctx] = canvas(1400, 640);
  ctx.fillStyle = "#fc5b05";
  ctx.fillRect(0, 0, 1400, 640);
  ctx.strokeStyle = "#ffe8ce";
  ctx.lineWidth = 10;
  ctx.strokeRect(26, 26, 1348, 588);
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, 1308, 548);

  // The approved App Composer mark, drawn from its published geometry.
  ctx.save();
  ctx.translate(96, 192);
  ctx.scale(0.2, 0.2);
  ctx.fillStyle = "#f7edd8";
  const blocks = [
    [124, 288, 302, 299, 65],
    [124, 667, 302, 299, 65],
    [630, 385, 501, 487, 94],
  ];
  for (const [x, y, width, height, radius] of blocks) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }
  ctx.fillStyle = "#fc5b05";
  const join = new Path2D(
    "M 426 407 L 498 408 L 526 416 L 553 432 L 569 447 L 585 469 L 607 527 L 621 552 L 641 573 L 662 586 L 701 596 L 796 596 L 798 548 L 810 532 L 829 528 L 845 535 L 942 607 L 950 621 L 950 635 L 939 650 L 841 721 L 829 726 L 815 725 L 800 712 L 797 702 L 796 662 L 694 662 L 661 671 L 640 684 L 618 708 L 606 730 L 596 762 L 582 790 L 568 808 L 550 824 L 532 835 L 502 845 L 426 846 L 426 780 L 484 780 L 512 769 L 530 749 L 548 701 L 566 668 L 605 628 L 577 602 L 563 583 L 548 554 L 531 507 L 512 485 L 486 474 L 426 473 L 426 407 Z",
  );
  ctx.fill(join);
  ctx.restore();

  ctx.fillStyle = "#f7edd8";
  ctx.font = `600 92px ${FONT}`;
  ctx.fillText("APP COMPOSER", 430, 250);
  ctx.fillStyle = "#2a1710";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("THE STUDIO THAT PRINTS ITSELF", 434, 328);
  ctx.fillStyle = "#f7edd8";
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("BUILD APPS / KEEP THE SOURCE / KEEP THE DATA", 434, 430);
  ctx.fillStyle = "rgba(247,237,216,0.72)";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText("AN INTERACTIVE WORKSHOP / 2026", 434, 480);
  return textureFrom(element, { anisotropy: 8 });
}

export function floorMarkTexture(number, title) {
  const [element, ctx] = canvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(240,224,194,0.65)";
  ctx.fillStyle = "rgba(240,224,194,0.82)";
  ctx.lineWidth = 5;
  ctx.font = `600 188px ${FONT}`;
  ctx.textAlign = "center";
  ctx.strokeText(number, 256, 250);
  ctx.font = `600 25px ${FONT}`;
  ctx.fillText(title, 256, 318);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(256, 360);
  ctx.lineTo(256, 422);
  ctx.lineTo(234, 398);
  ctx.moveTo(256, 422);
  ctx.lineTo(278, 398);
  ctx.stroke();
  return textureFrom(element, { anisotropy: 8 });
}

export function sketchTexture(seed) {
  const [element, ctx] = canvas(512, 660);
  const random = mulberry32(seed);
  ctx.fillStyle = "#f4e9d4";
  ctx.fillRect(0, 0, 512, 660);
  ctx.strokeStyle = "rgba(40,58,61,0.72)";
  ctx.lineWidth = 2;
  for (let index = 0; index < 9; index += 1) {
    ctx.beginPath();
    const x = 50 + random() * 120;
    const y = 80 + random() * 400;
    ctx.moveTo(x, y);
    for (let step = 0; step < 4; step += 1) {
      ctx.lineTo(x + (random() - 0.2) * 300, y + (random() - 0.5) * 160);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(216,75,5,0.8)";
  ctx.lineWidth = 3;
  ctx.strokeRect(58, 70, 396, 500);
  ctx.beginPath();
  ctx.arc(256, 330, 94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(40,58,61,0.72)";
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("DRAWING / FIELD STUDY", 58, 610);
  ctx.fillStyle = "rgba(216,75,5,0.86)";
  ctx.fillRect(58, 624, 118, 6);
  return textureFrom(element, { anisotropy: 8 });
}

export function tapeTexture() {
  const [element, ctx] = canvas(800, 128);
  ctx.fillStyle = "#efe1c4";
  ctx.fillRect(0, 0, 800, 128);
  ctx.fillStyle = "#263a3e";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("RECORDED ACTIVITY", 40, 54);
  ctx.font = `500 24px ${FONT}`;
  ctx.fillStyle = "#5b696b";
  ctx.fillText("REQUESTS / ACTIONS / COVERAGE · NOT PEOPLE", 40, 94);
  for (let x = 0; x < 800; x += 26) {
    ctx.fillStyle = x % 52 === 0 ? "#fc5b05" : "rgba(38,58,62,0.35)";
    ctx.fillRect(x, 108, 12, 7);
  }
  return textureFrom(element, { anisotropy: 6 });
}


export function contactShadowTexture() {
  const [element, ctx] = canvas(256, 256);
  const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  gradient.addColorStop(0, "rgba(0,0,0,0.62)");
  gradient.addColorStop(0.52, "rgba(0,0,0,0.3)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return textureFrom(element);
}

export function outputSheetTexture() {
  const [element, ctx] = canvas(1024, 512);
  const random = mulberry32(304);
  ctx.fillStyle = "#f8eed9";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "#fc5b05";
  ctx.fillRect(0, 0, 18, 512);
  ctx.fillRect(1006, 0, 18, 512);
  ctx.strokeStyle = "rgba(44,62,64,0.62)";
  ctx.lineWidth = 3;
  for (let index = 0; index < 7; index += 1) {
    const y = 110 + index * 46;
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(index % 3 === 0 ? 620 : 910, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(216,75,5,0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(836, 396, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(818, 396);
  ctx.lineTo(836, 414);
  ctx.lineTo(862, 382);
  ctx.stroke();
  ctx.fillStyle = "rgba(44,62,64,0.7)";
  ctx.font = `600 21px ${FONT}`;
  ctx.fillText("OUTPUT / FIELD NOTE 042", 90, 66);
  ctx.fillStyle = "#d84b05";
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText("FICTIONAL / BROWSER-LOCAL", 90, 454);
  for (let index = 0; index < 700; index += 1) {
    ctx.fillStyle = `rgba(126,103,72,${0.018 + random() * 0.05})`;
    ctx.fillRect(random() * 1024, random() * 512, 1 + random() * 2, 1 + random() * 1.5);
  }
  return textureFrom(element, { anisotropy: 8 });
}
