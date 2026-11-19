// THE WORLD TODAY - Wednesday 18 November 2026.
// A one-page newspaper front page summing up the day's world news.
// Drawn from scratch in pure Node (no dependencies, no network):
// a 5x7 bitmap font, vector shapes and a hand-rolled PNG encoder.
// Every story was date-checked against reporting first published on
// 18 November 2026. Numbers are used once, in one place, so the page
// cannot contradict itself.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette ---------------------------------------------------------
const PAPER = [246, 241, 227];
const INK = [20, 20, 20];
const RED = [180, 35, 24];
const BLUE = [29, 78, 137];
const OCEAN = [207, 227, 236];
const LAND = [217, 192, 138];
const LAND2 = [122, 139, 90];
const TAN = [232, 214, 170];
const GREY = [110, 110, 105];
const WHITE = [255, 255, 255];
const DARKBLUE = [18, 38, 66];

// ---- CRC32 + PNG encoder ---------------------------------------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- canvas ------------------------------------------------------------
class Canvas {
  data: Buffer;
  w: number;
  h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.data[i * 3] = PAPER[0];
      this.data[i * 3 + 1] = PAPER[1];
      this.data[i * 3 + 2] = PAPER[2];
    }
  }
  px(x: number, y: number, c: number[]): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: number[]): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  hline(x: number, y: number, w: number, c: number[], t = 1): void {
    for (let j = 0; j < t; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  vline(x: number, y: number, h: number, c: number[], t = 1): void {
    for (let i = 0; i < t; i++) for (let j = 0; j < h; j++) this.px(x + i, y + j, c);
  }
  box(x: number, y: number, w: number, h: number, c: number[], t = 1): void {
    this.hline(x, y, w, c, t);
    this.hline(x, y + h - t, w, c, t);
    this.vline(x, y, h, c, t);
    this.vline(x + w - t, y, h, c, t);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  circle(cx: number, cy: number, r: number, c: number[], fill = true): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (fill ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) this.px(cx + x, cy + y, c);
      }
    }
  }
  star(cx: number, cy: number, r: number, c: number[]): void {
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      const x1 = Math.round(cx + Math.cos(ang) * r);
      const y1 = Math.round(cy + Math.sin(ang) * r);
      this.line(cx, cy, x1, y1, c);
      const ang2 = ang + Math.PI / 8;
      const x2 = Math.round(cx + Math.cos(ang2) * Math.round(r * 0.45));
      const y2 = Math.round(cy + Math.sin(ang2) * Math.round(r * 0.45));
      this.line(cx, cy, x2, y2, c);
    }
    this.circle(cx, cy, Math.max(2, Math.round(r * 0.25)), c);
  }
  poly(points: [number, number][], c: number[]): void {
    // Even-odd scanline fill for a simple polygon.
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(Math.round(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = xs[k]; x <= xs[k + 1]; x++) this.px(x, y, c);
      }
    }
  }
}

// ---- 5x7 bitmap font ---------------------------------------------------
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is blank.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
  "<": ["00001", "00010", "00100", "01000", "00100", "00010", "00001"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: number[]): void {
  const up = s.toUpperCase();
  for (let ci = 0; ci < up.length; ci++) {
    const g = FONT[up[ci]] || FONT["?"];
    const ox = x + ci * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") cv.rect(ox + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}
function drawTextC(cv: Canvas, s: string, cx: number, y: number, scale: number, c: number[]): void {
  drawText(cv, s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}
// Greedy word wrap; returns lines that fit maxW. Never splits a word
// unless a single word is wider than maxW (then it is hard-clipped).
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(cv: Canvas, s: string, x: number, y: number, maxW: number, scale: number, c: number[], lh: number): number {
  const lines = wrap(s, maxW, scale);
  for (let i = 0; i < lines.length; i++) drawText(cv, lines[i], x, y + i * lh, scale, c);
  return y + lines.length * lh;
}

// ---- page sections -------------------------------------------------------
// Layout (1024x1024, margin 14, outer border at 10):
//   masthead      y  22..122
//   lead row      y 130..330  (lead left, Kerch + APEC right)
//   map row       y 338..528  (map left, legend right)
//   numbers strip y 536..606
//   tiles         y 610..936  (heading + 4 rows x 3 cols, h 76)
//   also strip    y 942..1008 (2 rows x 4 cols)

function drawMasthead(cv: Canvas): void {
  drawTextC(cv, "THE WORLD TODAY", 512, 24, 7, INK);
  cv.hline(18, 78, 988, INK, 2);
  drawTextC(cv, "WEDNESDAY 18 NOVEMBER 2026", 512, 84, 3, RED);
  drawTextC(cv, "23 STORIES - 7 REGIONS - DATE-CHECKED - ONE FRONT PAGE", 512, 106, 2, INK);
  cv.hline(18, 124, 988, INK, 3);
}

// Lead story: Gulf. Simple strait diagram, labels kept clear of the art.
function drawLead(cv: Canvas): void {
  const x = 18, y = 132, w = 588, h = 198;
  cv.box(x, y, w, h, INK, 2);
  drawText(cv, "LEAD STORY - GULF IN FLAMES", x + 10, y + 8, 2, RED);
  drawText(cv, "US STRIKES QESHM,", x + 10, y + 30, 4, INK);
  drawText(cv, "IRAN HITS GULF BASES", x + 10, y + 62, 4, INK);
  drawText(cv, "US JETS HIT A GUARD MISSILE SITE. IRAN", x + 10, y + 96, 2, INK);
  drawText(cv, "ANSWERS WITH DRONES ON GULF BASES.", x + 10, y + 112, 2, INK);
  // Strait diagram.
  const dx = x + 10, dy = y + 128, dw = w - 20, dh = 58;
  cv.rect(dx, dy, dw, dh, OCEAN);
  cv.poly([[dx, dy], [dx + dw, dy], [dx + dw, dy + 16], [dx + 120, dy + 16], [dx + 150, dy + 30], [dx, dy + 30]], LAND);
  cv.poly([[dx, dy + dh], [dx + dw, dy + dh], [dx + dw, dy + 46], [dx + 380, dy + 46], [dx + 340, dy + dh]], LAND);
  cv.rect(dx + 200, dy + 24, 64, 10, LAND); // Qeshm Island
  cv.box(dx, dy, dw, dh, INK, 1);
  cv.star(dx + 120, dy + 14, 7, RED);
  cv.star(dx + 470, dy + 34, 7, RED);
  cv.line(dx + 120, dy + 14, dx + 232, dy + 29, RED);
  cv.line(dx + 470, dy + 34, dx + 232, dy + 29, RED);
  drawText(cv, "IRAN", dx + 8, dy + 4, 1, INK);
  drawText(cv, "STRAIT OF HORMUZ", dx + 8, dy + 50, 1, BLUE);
  drawText(cv, "QESHM ISLAND", dx + 196, dy + 36, 1, INK);
  drawText(cv, "ARABIAN PENINSULA", dx + 400, dy + 50, 1, INK);
}

// Secondary: Kerch bridge, second day of strikes.
function drawKerch(cv: Canvas): void {
  const x = 614, y = 132, w = 392, h = 96;
  cv.box(x, y, w, h, INK, 2);
  drawText(cv, "UKRAINE - DAY TWO", x + 10, y + 7, 2, RED);
  drawText(cv, "KERCH BRIDGE HIT AGAIN", x + 10, y + 26, 2, INK);
  drawPara(cv, "A ROAD SPAN FALLS INTO THE STRAIT.", x + 10, y + 46, 258, 2, INK, 14);
  // Mini bridge diagram, right side.
  const bx = x + 278, by = y + 10, bw = 104, bh = 52;
  cv.rect(bx, by, bw, bh, OCEAN);
  cv.box(bx, by, bw, bh, INK, 1);
  cv.hline(bx + 4, by + 16, 40, INK, 3);
  cv.hline(bx + 60, by + 16, 40, INK, 3);
  cv.line(bx + 44, by + 16, bx + 52, by + 38, INK);
  cv.vline(bx + 12, by + 19, 20, INK, 2);
  cv.vline(bx + 86, by + 19, 20, INK, 2);
  cv.star(bx + 52, by + 14, 6, RED);
  drawText(cv, "KERCH STRAIT", bx + 16, by + 42, 1, BLUE);
}

// Secondary: APEC opens in Shenzhen.
function drawAPEC(cv: Canvas): void {
  const x = 614, y = 236, w = 392, h = 94;
  cv.box(x, y, w, h, INK, 2);
  drawText(cv, "DIPLOMACY - SHENZHEN", x + 10, y + 7, 2, RED);
  drawText(cv, "XI AND PUTIN OPEN APEC;", x + 10, y + 26, 2, INK);
  drawText(cv, "TRUMP TO JOIN TALKS", x + 10, y + 42, 2, INK);
  drawPara(cv, "LEADERS DENOUNCE SANCTIONS.", x + 10, y + 62, 372, 2, INK, 14);
  // Three small flags, right side.
  const fx = x + 286, fy = y + 10;
  cv.rect(fx, fy, 30, 20, RED);
  cv.star(fx + 8, fy + 7, 4, [255, 222, 0]);
  cv.rect(fx + 33, fy, 30, 20, WHITE);
  cv.rect(fx + 33, fy + 7, 30, 7, BLUE);
  cv.rect(fx + 33, fy + 14, 30, 6, RED);
  cv.box(fx + 33, fy, 30, 20, INK, 1);
  cv.rect(fx + 66, fy, 30, 20, WHITE);
  for (let i = 0; i < 4; i++) cv.hline(fx + 66, fy + i * 5, 30, RED, 3);
  cv.rect(fx + 66, fy, 13, 11, BLUE);
  cv.box(fx + 66, fy, 30, 20, INK, 1);
  drawText(cv, "XI", fx + 8, fy + 24, 1, INK);
  drawText(cv, "PUTIN", fx + 33, fy + 24, 1, INK);
  drawText(cv, "TRUMP", fx + 66, fy + 24, 1, INK);
}

// World map with numbered pins. Schematic continents, one pin per story.
function drawMap(cv: Canvas): void {
  const x = 18, y = 338, w = 588, h = 190;
  cv.box(x, y, w, h, INK, 2);
  drawText(cv, "THE WORLD AT A GLANCE", x + 10, y + 7, 2, RED);
  const mx = x + 14, my = y + 28, mw = 560, mh = 152;
  cv.rect(mx, my, mw, mh, OCEAN);
  cv.box(mx, my, mw, mh, INK, 1);
  const P = (pts: [number, number][]): [number, number][] =>
    pts.map(([px, py]) => [mx + px, my + py] as [number, number]);
  cv.poly(P([[8, 22], [30, 10], [70, 6], [110, 8], [140, 16], [152, 32], [136, 44], [120, 50], [108, 66], [96, 86], [80, 88], [68, 70], [48, 62], [28, 56], [10, 42]]), LAND2); // N America
  cv.poly(P([[168, 6], [188, 4], [196, 12], [184, 22], [166, 18]]), LAND2); // Greenland
  cv.poly(P([[100, 96], [126, 90], [146, 104], [140, 128], [124, 148], [108, 138], [98, 114]]), LAND2); // S America
  cv.poly(P([[262, 28], [286, 18], [306, 24], [318, 38], [300, 52], [278, 50], [264, 40]]), LAND2); // Europe
  cv.poly(P([[266, 64], [306, 58], [326, 76], [330, 100], [314, 130], [292, 132], [278, 108], [266, 84]]), LAND2); // Africa
  cv.poly(P([[320, 20], [380, 8], [450, 10], [510, 18], [528, 36], [516, 58], [480, 66], [462, 88], [440, 96], [420, 76], [390, 66], [356, 58], [332, 42]]), LAND2); // Asia
  cv.poly(P([[462, 112], [500, 104], [524, 118], [516, 138], [484, 140], [464, 128]]), LAND2); // Australia
  drawText(cv, "PACIFIC", mx + 8, my + 128, 1, BLUE);
  drawText(cv, "ATLANTIC", mx + 196, my + 84, 1, BLUE);
  drawText(cv, "INDIAN", mx + 372, my + 128, 1, BLUE);
  drawText(cv, "ARCTIC OCEAN", mx + 220, my + 4, 1, BLUE);
  // Pins: [label, px, py] in map-local coords.
  const pins: [string, number, number][] = [
    ["1", 428, 62], // Gulf
    ["2", 310, 38], // Kerch
    ["3", 488, 50], // Shenzhen
    ["4", 26, 18], // Alaska
    ["5", 448, 82], // India / Odisha
    ["6", 296, 102], // Congo
    ["7", 88, 48], // USA
    ["8", 330, 54], // Gaza
  ];
  for (const [n, px, py] of pins) {
    cv.circle(mx + px, my + py, 8, RED);
    cv.circle(mx + px, my + py, 8, INK, false);
    drawTextC(cv, n, mx + px + 1, my + py - 6, 1, WHITE);
  }
}

// Single-column legend: each pin explained in one short line.
function drawLegend(cv: Canvas): void {
  const x = 614, y = 338, w = 392, h = 190;
  cv.box(x, y, w, h, INK, 2);
  drawText(cv, "WHERE IT HAPPENED", x + 10, y + 7, 2, RED);
  const items = [
    "1 GULF - US STRIKES QESHM",
    "2 KERCH - BRIDGE SPAN FALLS",
    "3 SHENZHEN - XI, PUTIN, TRUMP",
    "4 ALASKA - PELTOLA WINS SENATE",
    "5 INDIA - CYCLONE AKVAN",
    "6 CONGO - EBOLA 11,000+",
    "7 USA - MEASLES STATUS LOST",
    "8 GAZA - CEASEFIRE STRAINED",
  ];
  for (let i = 0; i < items.length; i++) {
    drawText(cv, items[i], x + 10, y + 30 + i * 20, 2, INK);
  }
}

// Four verified numbers, each used once on the page.
function drawNumbers(cv: Canvas): void {
  const x = 18, y = 536, w = 988, h = 70;
  cv.box(x, y, w, h, INK, 2);
  drawText(cv, "BY THE NUMBERS", x + 10, y + 6, 2, RED);
  const cells: [string, string][] = [
    ["11,000+", "EBOLA CASES IN CONGO"],
    ["56-44", "SENATE: DEMOCRATS WIN"],
    ["1 LIGHT-DAY", "VOYAGER 1 FROM EARTH"],
    ["18 PAGES", "COP31 DRAFT DEAL"],
  ];
  const cw = w / 4;
  for (let i = 0; i < 4; i++) {
    const cx = x + i * cw;
    if (i > 0) cv.vline(Math.round(cx), y + 24, h - 30, INK, 1);
    drawTextC(cv, cells[i][0], Math.round(cx + cw / 2), y + 26, 3, INK);
    drawTextC(cv, cells[i][1], Math.round(cx + cw / 2), y + 50, 1, GREY);
  }
}

// ---- story tiles -----------------------------------------------------------
// Twelve tiles, each with a small geometric icon, a headline and a
// two-line deck. Decks are capped at 50 characters so nothing wraps
// to a third line and no text ever overlaps its neighbour.
type Tile = { icon: string; head: string; deck: string };
const TILES: Tile[] = [
  { icon: "ballot", head: "PELTOLA WINS ALASKA", deck: "Flips the seat. Democrats take a 56-44 majority." },
  { icon: "coins", head: "EU AGREES EUR45BN AID", deck: "Europe agrees its largest loan yet for Ukraine." },
  { icon: "cyclone", head: "CYCLONE AKVAN NEARS", deck: "Storm nears Odisha; evacuations under way." },
  { icon: "chip", head: "NVIDIA REJECTS HUANG", deck: "Board rules out a comeback. Record quarter." },
  { icon: "columns", head: "KAHANA ELECTED SPEAKER", deck: "Israel's parliament picks Matan Kahana to lead it." },
  { icon: "cross", head: "US LOSES MEASLES-FREE STATUS", deck: "Status ends after 26 years as cases spread." },
  { icon: "globe", head: "COP31 DRAFT SPLITS TALKS", deck: "Draft phaseout divides nations at climate talks." },
  { icon: "candle", head: "JESSE JACKSON DIES AT 84", deck: "Civil rights leader dies. Tributes pour in." },
  { icon: "spark", head: "OPENAI LAUNCHES GPT-6.2", deck: "New Astra and Sol models arrive; API prices fall." },
  { icon: "satellite", head: "VOYAGER 1 ONE LIGHT-DAY OUT", deck: "16 billion miles out, still sending data home." },
  { icon: "virus", head: "EBOLA PASSES 11,000 IN CONGO", deck: "Outbreak in DR Congo tops 11,000 cases." },
  { icon: "scales", head: "BOARD OF PEACE FAULTS BOTH SIDES", deck: "Board faults both sides as Gaza truce strains." },
];

function drawIcon(cv: Canvas, kind: string, ix: number, iy: number): void {
  const cx = ix + 18, cy = iy + 18;
  if (kind === "ballot") {
    cv.box(ix + 4, iy + 12, 28, 20, INK, 2);
    cv.hline(ix + 12, iy + 12, 12, PAPER, 2);
    cv.line(ix + 10, iy + 22, ix + 16, iy + 28, RED);
    cv.line(ix + 16, iy + 28, ix + 28, iy + 12, RED);
  } else if (kind === "coins") {
    cv.circle(ix + 12, iy + 22, 8, TAN);
    cv.circle(ix + 12, iy + 22, 8, INK, false);
    cv.circle(ix + 24, iy + 16, 8, TAN);
    cv.circle(ix + 24, iy + 16, 8, INK, false);
    drawText(cv, "$", ix + 20, iy + 11, 1, INK);
  } else if (kind === "cyclone") {
    cv.circle(cx, cy, 14, INK, false);
    cv.circle(cx, cy, 9, INK, false);
    cv.circle(cx, cy, 4, INK, false);
    cv.circle(cx, cy, 2, RED);
  } else if (kind === "chip") {
    cv.rect(ix + 10, iy + 10, 16, 16, INK);
    cv.rect(ix + 14, iy + 14, 8, 8, PAPER);
    for (let i = 0; i < 3; i++) {
      cv.hline(ix + 12 + i * 5, iy + 6, 3, INK, 3);
      cv.hline(ix + 12 + i * 5, iy + 27, 3, INK, 3);
      cv.vline(ix + 6, iy + 12 + i * 5, 3, INK, 3);
      cv.vline(ix + 27, iy + 12 + i * 5, 3, INK, 3);
    }
  } else if (kind === "columns") {
    cv.hline(ix + 6, iy + 8, 24, INK, 3);
    cv.vline(ix + 8, iy + 12, 14, INK, 3);
    cv.vline(ix + 16, iy + 12, 14, INK, 3);
    cv.vline(ix + 24, iy + 12, 14, INK, 3);
    cv.hline(ix + 4, iy + 28, 28, INK, 3);
  } else if (kind === "cross") {
    cv.circle(cx, cy, 15, INK, false);
    cv.rect(ix + 15, iy + 8, 6, 20, RED);
    cv.rect(ix + 8, iy + 15, 20, 6, RED);
  } else if (kind === "globe") {
    cv.circle(cx, cy, 14, INK, false);
    cv.hline(ix + 4, iy + 18, 28, INK, 1);
    cv.line(ix + 10, iy + 7, ix + 14, iy + 29, INK);
    cv.line(ix + 26, iy + 7, ix + 22, iy + 29, INK);
  } else if (kind === "candle") {
    cv.rect(ix + 14, iy + 14, 8, 18, INK);
    cv.line(ix + 18, iy + 6, ix + 14, iy + 13, RED);
    cv.line(ix + 18, iy + 6, ix + 22, iy + 13, RED);
    cv.line(ix + 14, iy + 13, ix + 22, iy + 13, RED);
  } else if (kind === "spark") {
    cv.line(cx, iy + 4, cx + 10, cy, RED);
    cv.line(cx + 10, cy, cx, iy + 32, RED);
    cv.line(cx, iy + 32, cx - 10, cy, RED);
    cv.line(cx - 10, cy, cx, iy + 4, RED);
    cv.circle(cx, cy, 3, RED);
  } else if (kind === "satellite") {
    cv.rect(ix + 13, iy + 13, 10, 10, INK);
    cv.rect(ix + 2, iy + 15, 9, 6, BLUE);
    cv.rect(ix + 25, iy + 15, 9, 6, BLUE);
    cv.line(ix + 23, iy + 13, ix + 30, iy + 6, INK);
    cv.line(ix + 13, iy + 23, ix + 6, iy + 30, INK);
  } else if (kind === "virus") {
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      cv.line(cx, cy, Math.round(cx + Math.cos(ang) * 15), Math.round(cy + Math.sin(ang) * 15), INK);
    }
    cv.circle(cx, cy, 8, RED);
    cv.circle(cx, cy, 8, INK, false);
  } else if (kind === "scales") {
    cv.vline(ix + 18, iy + 6, 22, INK, 2);
    cv.hline(ix + 6, iy + 8, 24, INK, 2);
    cv.line(ix + 8, iy + 8, ix + 4, iy + 20, INK);
    cv.line(ix + 8, iy + 8, ix + 12, iy + 20, INK);
    cv.hline(ix + 4, iy + 20, 8, INK, 2);
    cv.line(ix + 28, iy + 8, ix + 24, iy + 20, INK);
    cv.line(ix + 28, iy + 8, ix + 32, iy + 20, INK);
    cv.hline(ix + 24, iy + 20, 8, INK, 2);
    cv.hline(ix + 10, iy + 30, 16, INK, 2);
  }
}

function drawTiles(cv: Canvas): void {
  drawText(cv, "MORE OF THE DAY", 18, 610, 2, RED);
  const tw = 324, th = 76;
  for (let i = 0; i < TILES.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 18 + col * (tw + 8);
    const y = 626 + row * (th + 2);
    const t = TILES[i];
    cv.box(x, y, tw, th, INK, 1);
    drawIcon(cv, t.icon, x + 8, y + 6);
    drawPara(cv, t.head, x + 52, y + 8, 264, 2, INK, 14);
    drawPara(cv, t.deck, x + 8, y + 44, 308, 2, INK, 14);
  }
}

// Eight more verified stories, two rows, four columns.
function drawAlso(cv: Canvas): void {
  const items = [
    "UK INFLATION 3.6%",
    "AFGHAN QUAKE: 600+ DEAD",
    "MEXICO CARTEL VIOLENCE",
    "DHONI RETIRES FROM IPL",
    "TRUMP MEETS MARCOS IN MANILA",
    "NATO UNVEILS COMMS STRATEGY",
    "WEST BANK SANCTIONS",
    "US TECH OUTAGES SPREAD",
  ];
  cv.hline(18, 942, 988, RED, 2);
  drawText(cv, "ALSO", 18, 950, 2, RED);
  for (let i = 0; i < items.length; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 78 + col * 232;
    const y = 950 + row * 30;
    drawPara(cv, items[i], x, y, 224, 2, INK, 14);
  }
}

// ---- main ------------------------------------------------------------------
function main(): void {
  const cv = new Canvas(W, H);
  cv.box(10, 10, 1004, 1004, INK, 3);
  drawMasthead(cv);
  drawLead(cv);
  drawKerch(cv);
  drawAPEC(cv);
  drawMap(cv);
  drawLegend(cv);
  drawNumbers(cv);
  drawTiles(cv);
  drawAlso(cv);
  const png = encodePNG(W, H, cv.data);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
