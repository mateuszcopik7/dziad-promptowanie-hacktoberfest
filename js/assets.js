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
  7: makeTex((x, y) => {                      // jasny korytarz z oknami i szarym pasem
    const j = jitter(x >> 2, y >> 2, 7) + jitter(x, y, 3);
    if (y >= 47) return rgb(clamp(86 + j), clamp(91 + j), clamp(94 + j));
    if (y >= 33) return rgb(clamp(205 + j), clamp(208 + j), clamp(205 + j));
    const window = x >= 5 && x <= 27 && y >= 5 && y <= 28;
    if (window && (x <= 7 || x >= 25 || y <= 7 || y >= 26)) return rgb(225, 228, 224);
    if (window) return rgb(clamp(157 + j), clamp(194 + j), clamp(211 + j));
    return rgb(clamp(235 + j), clamp(235 + j), clamp(229 + j));
  }),
  8: makeTex((x, y) => {                      // stalowoszare drzwi sal
    const j = jitter(x, y, 8);
    if (x < 5 || x > 58 || y < 3) return rgb(205, 208, 205);
    if (x < 8 || x > 55 || y < 6 || y > 61) return rgb(105, 110, 112);
    if (x >= 21 && x <= 42 && y >= 9 && y <= 20) {
      if (x === 21 || x === 42 || y === 9 || y === 20) return rgb(75, 80, 82);
      if (y >= 14 && y <= 16 && x % 5 < 3) return rgb(55, 60, 62);
      return rgb(224, 224, 215);
    }
    if (x >= 48 && x <= 51 && y >= 33 && y <= 37) return rgb(85, 63, 38);
    if (y > 52 && (x - 12) % 13 < 3) return rgb(188, 190, 186);
    return rgb(clamp(151 + j), clamp(156 + j), clamp(155 + j));
  }),
  9: makeTex((x, y) => {                      // betonowe schody i biala balustrada
    const step = Math.floor((63 - y) / 9), edge = (63 - y) % 9;
    const j = jitter(x, y, 12);
    if (edge < 2) return rgb(36, 40, 42);
    if (y > 18 + step * 2) return rgb(clamp(116 + j), clamp(118 + j), clamp(114 + j));
    const rail = Math.abs(y - (49 - x * 0.55)) < 2 || (x % 13 < 2 && y < 48);
    if (rail) return rgb(225, 226, 220);
    return rgb(clamp(226 + j), clamp(227 + j), clamp(222 + j));
  }),
  7: makeTex((x, y) => {                      // sciana korytarza z oknem
    const j = jitter(x, y, 8), wx = x >= 10 && x <= 54, wy = y >= 8 && y <= 42;
    if (wx && wy) {
      if (x === 10 || x === 54 || y === 8 || y === 42 || x === 32 || y === 25) return rgb(210, 214, 220);        // rama i szprosy
      const t = (y - 8) / 34;
      return rgb(clamp(120 + 60 * t + j), clamp(170 + 40 * t + j), clamp(235 - 10 * t + j));                       // niebo
    }
    if (y >= 44 && y <= 47 && wx) return rgb(190, 192, 198);                                                       // parapet
    if (y >= 52) return rgb(clamp(60 + j), clamp(80 + j), clamp(120 + j));
    return rgb(clamp(222 + j), clamp(220 + j), clamp(208 + j));
  }),
  8: makeTex((x, y) => {                      // lawka przy scianie
    const j = jitter(x, y, 10);
    if (y < 8 || y > 58) return rgb(clamp(222 + j), clamp(220 + j), clamp(208 + j));
    if (x < 4 || x > 59 || (y >= 40 && y <= 44)) return rgb(50, 90, 170);                                         // niebieski stelaz
    const slat = Math.floor((y - 8) / 6) % 2;
    return rgb(clamp(slat ? 170 : 150 + j), clamp(slat ? 118 : 100 + j), clamp(slat ? 70 : 60 + j));
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
  breaker: makeSprite([
    '..ssssss..',
    '.swwwwwws.',
    '.swrrrrws.',
    '.swrgggws.',
    '.swrgggws.',
    '.swrrrrws.',
    '.swwwwwws.',
    '..ssssss..',
    '...bbbb...',
    '...bbbb...',
  ], { s: rgb(75, 82, 92), w: rgb(205, 210, 215), r: rgb(155, 45, 40), g: rgb(55, 180, 80), b: rgb(40, 45, 52) }),
  breakerOn: makeSprite([
    '..ssssss..',
    '.swwwwwws.',
    '.swggggws.',
    '.swgyygws.',
    '.swgyygws.',
    '.swggggws.',
    '.swwwwwws.',
    '..ssssss..',
    '...bbbb...',
    '...bbbb...',
  ], { s: rgb(75, 82, 92), w: rgb(225, 230, 235), g: rgb(55, 205, 90), y: rgb(255, 235, 80), b: rgb(40, 45, 52) }),
};

// postac NPC sklada sie z glowy i ciala. Znaki: h wlosy, s skora, e oczy, c gora ubrania, d dol, k czapka/buty, l oprawki okularow
const NPC_HEADS = {
  short: ['....hhhh....', '...hhhhhh...', '...ssssss...', '...sessse...', '...ssssss...', '....ssss....'],
  long: ['...hhhhhh...', '..hhhhhhhh..', '..hssssssh..', '..hsessseh..', '..hhssssshh.', '..hh.ss.hh..'],
  bun: ['.....hh.....', '...hhhhhh...', '...ssssss...', '...sessse...', '...ssssss...', '....ssss....'],
  cap: ['...kkkkkk...', '..kkkkkkkk..', '..ssssssss..', '...sessse...', '...ssssss...', '....ssss....'],
  hat: ['....kkkk....', '..kkkkkkkk..', '...ssssss...', '...sessse...', '...ssssss...', '....ssss....'],
  bald: ['............', '....ssss....', '...ssssss...', '...sessse...', '...ssssss...', '....ssss....'],
};
const NPC_BODIES = {
  pants: ['..cccccccc..', '.cccccccccc.', '.cccccccccc.', 'sscccccccccs', 'ss.cccccc.ss', '...cccccc...', '...cccccc...', '...dd..dd...', '...dd..dd...', '...dd..dd...', '..kkk..kkk..'],
  skirt: ['..cccccccc..', '.cccccccccc.', '.cccccccccc.', 'sscccccccccs', 'ss.cccccc.ss', '...dddddd...', '..dddddddd..', '..dddddddd..', '...ss..ss...', '...ss..ss...', '..kk....kk..'],
  coat: ['..cccccccc..', '.cccccccccc.', '.cccccccccc.', 'sscccccccccs', 'ss.cccccc.ss', '..cccccccc..', '..cccccccc..', '..cccccccc..', '...dd..dd...', '...dd..dd...', '..kkk..kkk..'],
};
const hexRgb = hex => { const v = parseInt(hex.slice(1), 16); return rgb(v >> 16, (v >> 8) & 255, v & 255); };
const npcSpriteCache = {};
// look: { head, body, hair, skin, bottom, acc, glasses }, top: kolor gory ubrania (#rrggbb)
function npcSprite(look, top) {
  const l = typeof look === 'string' ? { top: look } : { ...look, top: top || (look && look.top) };
  const key = JSON.stringify(l);
  if (!npcSpriteCache[key]) {
    const head = [...(NPC_HEADS[l.head] || NPC_HEADS.short)];
    if (l.glasses) head[3] = '..lelsslel..'.padEnd(12, '.');
    const rows = [...head, ...(NPC_BODIES[l.body] || NPC_BODIES.pants)];
    npcSpriteCache[key] = makeSprite(rows, {
      h: hexRgb(l.hair || '#3c281e'), s: hexRgb(l.skin || '#e6bea0'), e: rgb(20, 20, 30), c: hexRgb(l.top || '#6a6a80'),
      d: hexRgb(l.bottom || '#282c3c'), k: hexRgb(l.acc || '#2a2a30'), l: rgb(30, 30, 40),
    });
  }
  return npcSpriteCache[key];
}

SPRITES.pieczatka = makeSprite([
  '........',
  '..wwww..',
  '..wwww..',
  '...ww...',
  '..rrrr..',
  '.rrrrrr.',
  '.rrrrrr.',
  '........',
], { w: rgb(150, 100, 60), r: rgb(200, 50, 50) });

SPRITES.stairs = makeSprite([
  '....gg....',
  '...gggg...',
  '..gggggg..',
  '.gggggggg.',
  '....gg....',
  '....gg....',
  '....gg....',
  '....gg....',
], { g: rgb(74, 214, 109) });
