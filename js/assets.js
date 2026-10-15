// grafika proceduralna: tekstury scian i sprite'y, zero plikow
const rgb = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
const clamp = v => Math.max(0, Math.min(255, v | 0));
const jitter = (x, y, amt) => (hash(x, y) - 0.5) * amt;

function makeTex(fn) {
  const t = new Uint32Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) t[y * 64 + x] = fn(x, y);
  return t;
}

const brick = (x, y) => {                      // sciana z cegiel
  if (y >= 52) { const j = jitter(x, y, 14); return rgb(clamp(50 + j), clamp(70 + j), clamp(110 + j)); }
  const row = y >> 3, bx = (x + (row & 1) * 8) % 16;
  if (y % 8 === 0 || bx === 0) return rgb(150, 140, 125);
  const j = jitter(x >> 2, y >> 2, 40) + jitter(x, y, 14);
  return rgb(clamp(196 + j), clamp(150 + j), clamp(105 + j));
};

const BOOK_COLORS = [[170, 50, 50], [50, 100, 170], [60, 150, 80], [200, 170, 60], [120, 70, 150]];

const TEX = {
  1: makeTex(brick),
  2: makeTex((x, y) => {                      // szafki
    const lx = x % 16, j = jitter(x, y, 10);
    if (lx === 0 || lx === 15) return rgb(40, 55, 80);
    if (y < 3 || y > 60) return rgb(40, 55, 80);
    if (lx >= 3 && lx <= 12 && y >= 8 && y <= 16 && y % 2 === 0) return rgb(150, 175, 205);
    if (lx >= 11 && lx <= 12 && y >= 30 && y <= 36) return rgb(230, 200, 60);
    return rgb(clamp(80 + j), clamp(105 + j), clamp(140 + j));
  }),
  3: makeTex((x, y) => {                      // pracownia komputerowa
    const j = jitter(x, y, 8);
    const inScreen = (x >= 4 && x <= 28 || x >= 36 && x <= 60) && y >= 6 && y <= 30;
    if (inScreen) {
      const line = (y % 4 === 0) && ((x * 7 + y) % 9 < 6);
      return line ? rgb(150, 255, 170) : rgb(20, 90, 50);
    }
    if (y >= 40 && y <= 52 && (x % 8) !== 0) return rgb(clamp(110 + j), clamp(110 + j), clamp(120 + j));
    return rgb(clamp(32 + j), clamp(34 + j), clamp(44 + j));
  }),
  4: makeTex((x, y) => {                      // drzwi do klasy
    if (x >= 12 && x <= 52 && y >= 4) {
      if (x >= 22 && x <= 42 && y >= 10 && y <= 26) return rgb(150, 200, 235);
      if (x >= 46 && x <= 49 && y >= 34 && y <= 38) return rgb(235, 205, 60);
      const panel = (x === 12 || x === 52 || y === 40) ? 0.8 : 1;
      const j = jitter(x, y, 10);
      return rgb(clamp((125 + j) * panel), clamp((72 + j) * panel), clamp(32 * panel));
    }
    return brick(x, y);
  }),
  5: makeTex((x, y) => {                      // regal z ksiazkami
    const ry = y & 15, j = jitter(x, y, 10);
    if (ry < 2 || ry === 15) return rgb(clamp(96 + j), clamp(62 + j), 36);
    const i = (x >> 2) + (y >> 4) * 16;
    if (ry < 2 + Math.floor(hash(i, 3) * 5)) return rgb(40, 28, 20);
    const c = BOOK_COLORS[Math.floor(hash(i, 7) * BOOK_COLORS.length)], k = x % 4 === 0 ? 0.65 : 1;
    return rgb(clamp(c[0] * k + j), clamp(c[1] * k + j), clamp(c[2] * k + j));
  }),
  6: makeTex((x, y) => {                      // kafelki ze stolowki
    const j = jitter(x >> 4, y >> 4, 18) + jitter(x, y, 6);
    if (x % 16 === 0 || y % 16 === 0) return rgb(150, 155, 160);
    if (y >= 28 && y <= 35) return rgb(clamp(50 + j), clamp(110 + j), clamp(170 + j));
    return rgb(clamp(222 + j), clamp(224 + j), clamp(218 + j));
  }),
};

// sprite z tekstu: znak -> kolor, '.' = przezroczysty
function makeSprite(rows, pal) {
  const h = rows.length, w = rows[0].length, data = new Uint32Array(w * h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') data[y * w + x] = pal[ch]; }));
  return { w, h, data };
}

const BUG_ROWS = [
  '...a........a...',
  '....a......a....',
  '.....gggggg.....',
  '....gggggggg....',
  '...gggggggggg...',
  '..ggwrggggwrgg..',
  '..gggggggggggg..',
  '..gggmmmmmmggg..',
  '..gggmwmwmwggg..',
  '..gggggggggggg..',
  '...gggggggggg...',
  '....gggggggg....',
  '..l.gggggggg.l..',
  '.l..gg....gg..l.',
  'l...gg....gg...l',
  '................',
];

const bugPal = (body, dark, eye) => ({ g: body, a: dark, l: dark, w: rgb(240, 240, 240), r: eye, m: rgb(20, 40, 20) });

const SPRITES = {
  bug: makeSprite(BUG_ROWS, bugPal(rgb(60, 200, 80), rgb(40, 140, 60), rgb(220, 30, 30))),
  glitch: makeSprite(BUG_ROWS, bugPal(rgb(170, 70, 220), rgb(110, 40, 160), rgb(255, 230, 60))),
  boss: makeSprite(BUG_ROWS, bugPal(rgb(220, 70, 50), rgb(130, 30, 30), rgb(255, 230, 60))),
  food: makeSprite([
    '........',
    '..yyyy..',
    '.yyrryy.',
    'yyyggyyy',
    'yyrrrryy',
    '.yyyyyy.',
    '..yyyy..',
    '........',
  ], { y: rgb(230, 190, 90), r: rgb(210, 50, 40), g: rgb(80, 180, 70) }),
  usb: makeSprite([
    '........',
    '..gggg..',
    '..gbbg..',
    '..gbbg..',
    '..gbbg..',
    '..gggg..',
    '...yy...',
    '...yy...',
  ], { g: rgb(150, 150, 160), b: rgb(40, 90, 200), y: rgb(230, 200, 60) }),
};
