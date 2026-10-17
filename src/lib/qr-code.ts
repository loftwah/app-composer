// A small, dependency-free QR encoder (byte mode, ECC level M, versions 1-10).
// It exists so a creator can download a QR code that decodes to the exact
// published address without a third-party service seeing the URL. The output is
// a boolean module matrix; the card and the download both render from it.
//
// MIT. Verified by decoding the rendered PNG/SVG with an independent decoder
// (see tests/qr-code.test.mjs and the recorded local verification).

// Total data codewords, Reed-Solomon block structure and alignment centres for
// versions 1-10 at error-correction level M (format bits 00).
interface VersionSpec { data: number; ec: number; groups: [number, number][]; align: number[] }
type Grid = (boolean | number | null)[][];
export interface QrMatrix { version: number; mask: number; size: number; modules: boolean[][] }

const SPEC: Record<number, VersionSpec> = {
  1: { data: 16, ec: 10, groups: [[1, 16]], align: [] },
  2: { data: 28, ec: 16, groups: [[1, 28]], align: [6, 18] },
  3: { data: 44, ec: 26, groups: [[1, 44]], align: [6, 22] },
  4: { data: 64, ec: 18, groups: [[2, 32]], align: [6, 26] },
  5: { data: 86, ec: 24, groups: [[2, 43]], align: [6, 30] },
  6: { data: 108, ec: 16, groups: [[4, 27]], align: [6, 34] },
  7: { data: 124, ec: 18, groups: [[4, 31]], align: [6, 22, 38] },
  8: { data: 154, ec: 22, groups: [[2, 38], [2, 39]], align: [6, 24, 42] },
  9: { data: 182, ec: 22, groups: [[3, 36], [2, 37]], align: [6, 26, 46] },
  10: { data: 216, ec: 26, groups: [[4, 43], [1, 44]], align: [6, 28, 50] },
};
const REMAINDER: Record<number, number> = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

// GF(256), primitive polynomial 0x11d.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i += 1) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
const multiply = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generatorPoly(degree: number) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= multiply(poly[j], 1);
      next[j + 1] ^= multiply(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data: Uint8Array, ecCount: number) {
  const generator = generatorPoly(ecCount);
  const message = new Uint8Array(data.length + ecCount);
  message.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const factor = message[i];
    if (!factor) continue;
    for (let j = 0; j < generator.length; j += 1) message[i + j] ^= multiply(generator[j], factor);
  }
  return Array.from(message.slice(data.length));
}

function capacity(version: number) {
  return SPEC[version].data;
}
function chooseVersion(byteLength: number) {
  for (let version = 1; version <= 10; version += 1) {
    const bits = 4 + (version <= 9 ? 8 : 16) + byteLength * 8;
    if (bits <= capacity(version) * 8) return version;
  }
  throw Error('This address is too long for the offline QR encoder.');
}

function bitStream(bytes: Uint8Array, version: number) {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const total = capacity(version) * 8;
  push(0, Math.min(4, total - bits.length));
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    codewords.push(value);
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (codewords.length < capacity(version)) codewords.push(pads[pad++ % 2]);
  return codewords;
}

function interleave(codewords: number[], version: number) {
  const { ec, groups } = SPEC[version];
  const blocks = [];
  const dataBlocks = [];
  let offset = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i += 1) {
      const data = codewords.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(data);
      blocks.push({ data, ec: errorCorrection(Uint8Array.from(data), ec) });
    }
  }
  const result = [];
  const maxData = Math.max(...dataBlocks.map(block => block.length));
  for (let i = 0; i < maxData; i += 1) for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
  for (let i = 0; i < ec; i += 1) for (const block of blocks) result.push(block.ec[i]);
  return result;
}

function maskAt(mask: number, row: number, column: number) {
  switch (mask) {
    case 0: return (row + column) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return column % 3 === 0;
    case 3: return (row + column) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5: return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6: return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    case 7: return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
    default: return false;
  }
}

function formatBits(mask: number) {
  // Error-correction level M is 00; the three mask bits follow.
  const data = (0b00 << 3) | mask;
  let value = data << 10;
  for (let i = 14; i >= 10; i -= 1) if ((value >> i) & 1) value ^= 0b10100110111 << (i - 10);
  return ((data << 10) | value) ^ 0b101010000010010;
}

function versionBits(version: number) {
  let value = version << 12;
  for (let i = 17; i >= 12; i -= 1) if ((value >> i) & 1) value ^= 0b1111100100101 << (i - 12);
  return (version << 12) | value;
}

function matrix(version: number) {
  const size = version * 4 + 17;
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFunctionPatterns(grid: Grid, version: number) {
  const size = grid.length;
  const set = (row: number, column: number, value: boolean) => {
    if (row >= 0 && row < size && column >= 0 && column < size) grid[row][column] = value;
  };
  const finder = (row: number, column: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(row + r, column + c, dark);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const centres = SPEC[version].align;
  for (const row of centres) {
    for (const column of centres) {
      if ((row === 6 && column === 6) || (row === 6 && column === size - 7) || (row === size - 7 && column === 6)) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          set(row + r, column + c, dark);
        }
      }
    }
  }
  set(size - 8, 8, true);
  return grid;
}

function functionMask(version: number) {
  const empty = matrix(version);
  const grid = placeFunctionPatterns(empty, version);
  const reserved = grid.map(row => row.map(value => value !== null));
  if (version >= 7) {
    const size = grid.length;
    for (let i = 0; i < 18; i += 1) {
      reserved[size - 11 + (i % 3)][Math.floor(i / 3)] = true;
      reserved[Math.floor(i / 3)][size - 11 + (i % 3)] = true;
    }
  }
  // Format information areas are reserved before data placement.
  for (let i = 0; i < 9; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][grid.length - 1 - i] = true;
    reserved[grid.length - 1 - i][8] = true;
  }
  return reserved;
}

function placeData(grid: Grid, reserved: boolean[][], codewords: number[], version: number) {
  const size = grid.length;
  let bitIndex = 0;
  const bits: number[] = [];
  for (const codeword of codewords) for (let i = 7; i >= 0; i -= 1) bits.push((codeword >> i) & 1);
  for (let i = 0; i < REMAINDER[version]; i += 1) bits.push(0);
  let upward = true;
  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const c of [column, column - 1]) {
        if (reserved[row][c]) continue;
        grid[row][c] = bits[bitIndex] ?? 0;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function penalty(grid: Grid) {
  const size = grid.length;
  let score = 0;
  const runs = (line: boolean[]) => {
    let total = 0;
    let count = 1;
    for (let i = 1; i < line.length; i += 1) {
      if (line[i] === line[i - 1]) count += 1;
      else {
        if (count >= 5) total += 3 + (count - 5);
        count = 1;
      }
    }
    if (count >= 5) total += 3 + (count - 5);
    return total;
  };
  for (let i = 0; i < size; i += 1) {
    score += runs(grid[i].map(Boolean));
    score += runs(grid.map(row => Boolean(row[i])));
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const value = grid[row][column];
      if (value === grid[row][column + 1] && value === grid[row + 1][column] && value === grid[row + 1][column + 1]) score += 3;
    }
  }
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const matches = (line: boolean[]) => {
    let total = 0;
    for (let i = 0; i + pattern.length <= line.length; i += 1) {
      let found = true;
      for (let j = 0; j < pattern.length; j += 1) {
        if (Boolean(line[i + j]) !== pattern[j]) { found = false; break; }
      }
      if (found) total += 40;
    }
    return total;
  };
  for (let i = 0; i < size; i += 1) {
    score += matches(grid[i].map(Boolean));
    score += matches(grid.map(row => Boolean(row[i])));
  }
  const dark = grid.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

function applyFormat(grid: Grid, mask: number, version: number) {
  const size = grid.length;
  const format = formatBits(mask);
  const bit = (index: number) => ((format >> index) & 1) === 1;
  // Coordinates are (row, column); the two copies of the format information are
  // placed exactly as the specification describes.
  for (let i = 0; i <= 5; i += 1) grid[i][8] = bit(i);
  grid[7][8] = bit(6);
  grid[8][8] = bit(7);
  grid[8][7] = bit(8);
  for (let i = 9; i <= 14; i += 1) grid[8][14 - i] = bit(i);
  for (let i = 0; i <= 7; i += 1) grid[8][size - 1 - i] = bit(i);
  for (let i = 8; i <= 14; i += 1) grid[size - 15 + i][8] = bit(i);
  grid[size - 8][8] = true;
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const value = ((bits >> i) & 1) === 1;
      grid[Math.floor(i / 3)][size - 11 + (i % 3)] = value;
      grid[size - 11 + (i % 3)][Math.floor(i / 3)] = value;
    }
  }
}

// Build the module matrix for a UTF-8 text. Returns an array of rows of
// booleans, with no quiet zone.
export function qrMatrix(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(String(text));
  const version = chooseVersion(bytes.length);
  const codewords = interleave(bitStream(bytes, version), version);
  let best: {score: number; grid: Grid; mask: number} | null = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const grid = matrix(version);
    placeFunctionPatterns(grid, version);
    const reserved = functionMask(version);
    placeData(grid, reserved, codewords, version);
    for (let row = 0; row < grid.length; row += 1) {
      for (let column = 0; column < grid.length; column += 1) {
        if (reserved[row][column]) continue;
        if (maskAt(mask, row, column)) grid[row][column] = !grid[row][column];
      }
    }
    applyFormat(grid, mask, version);
    const score = penalty(grid);
    if (!best || score < best.score) best = { score, grid, mask };
  }
  if (!best) throw Error('The QR encoder could not select a mask.');
  return { version, mask: best.mask, size: best.grid.length, modules: best.grid.map(row => row.map(Boolean)) };
}

export const QR_MASK_COUNT = 8;
