// wyglad ZSTI dopasowany do zdjec (.map-photos): dwukolorowe sciany ze skosnym cokolem, szare drzwi z tabliczka,
// male okna naswietla nad drzwiami, tablice korkowe, lastryko na podlodze, biale sufity z panelami LED, laweczki, pufy.
// Nadpisuje tekstury 1, 2, 4, 7 z assets.js. Zero plikow, wszystko proceduralnie.

// --- motywy pieter: kazde pietro ma wlasne kolory scian, cokolu, podlogi i sufitu -------------------------------
// up/low: gorna i dolna czesc sciany, skirt: cokol, floor: przesuniecie lastryko (r,g,b), stripe: pasy na podlodze, ceil: sufit
const THEMES = [
  { name: 'Parter', up: [238, 230, 214], low: [208, 192, 166], skirt: [140, 108, 80], floor: [6, 0, -14], stripe: [92, 66, 48], ceil: [236, 230, 218] },
  { name: 'Pietro 1', up: [233, 232, 227], low: [197, 199, 197], skirt: [118, 133, 154], floor: [0, 0, 0], stripe: [66, 64, 62], ceil: [224, 224, 220] },
  { name: 'Pietro 2', up: [228, 238, 232], low: [166, 204, 186], skirt: [58, 110, 88], floor: [-14, 4, -2], stripe: [40, 82, 66], ceil: [222, 232, 228] },
  { name: 'Pietro 3', up: [226, 232, 244], low: [160, 178, 214], skirt: [48, 66, 128], floor: [-22, -20, 2], stripe: [38, 44, 84], ceil: [218, 222, 236] },
];

const inBox = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

function makeWallBase(th) {
  return (x, y) => {
    const j = jitter(x >> 1, y >> 1, 5) + jitter(x, y, 3);
    if (y >= 58) return y === 58 ? rgb(clamp(th.skirt[0] + 50), clamp(th.skirt[1] + 50), clamp(th.skirt[2] + 40)) : rgb(clamp(th.skirt[0] + j), clamp(th.skirt[1] + j), clamp(th.skirt[2] + j));
    if (y === 29) return rgb(clamp(th.low[0] - 26 + j), clamp(th.low[1] - 26 + j), clamp(th.low[2] - 26 + j));
    const c = y < 29 ? th.up : th.low;
    return rgb(clamp(c[0] + j), clamp(c[1] + j), clamp(c[2] + j));
  };
}

// male okno naswietla w gornej czesci sciany (jak nad drzwiami na zdjeciach), z parapetem
const makeWindowTex = wall => makeTex((x, y) => {
  if (inBox(x, y, 9, 4, 54, 27)) {
    if (!inBox(x, y, 12, 7, 51, 24)) return rgb(238, 238, 234);                                                     // rama
    if (x >= 31 && x <= 32) return rgb(238, 238, 234);                                                              // szprosa
    const t = (y - 7) / 17;
    if (y > 17) return rgb(clamp(150 + 20 * x / 64), clamp(165 + 15 * x / 64), clamp(182));                         // dalekie budynki
    return rgb(clamp(198 + 40 * t), clamp(219 + 25 * t), clamp(238 + 8 * t));                                       // niebo
  }
  if (inBox(x, y, 7, 28, 56, 31)) return y === 31 ? rgb(150, 152, 150) : rgb(224, 224, 220);                        // parapet
  return wall(x, y);
});

// tablica korkowa z plakatami
const POSTER_COLORS = [[240, 240, 235], [235, 200, 60], [90, 160, 220], [220, 90, 90], [120, 190, 120], [245, 245, 245]];
const makeCorkTex = wall => makeTex((x, y) => {
  if (inBox(x, y, 5, 7, 58, 50)) {
    if (!inBox(x, y, 7, 9, 56, 48)) return rgb(150, 105, 60);                                                       // rama
    const cx = Math.floor((x - 7) / 12), cy = Math.floor((y - 9) / 14), h = hash(cx * 7 + 1, cy * 13 + 5);
    const inPaper = (x - 7) % 12 > 1 && (x - 7) % 12 < 11 && (y - 9) % 14 > 1 && (y - 9) % 14 < 12 && h > 0.18;
    if (inPaper) {
      const c = POSTER_COLORS[Math.floor(h * 97) % POSTER_COLORS.length], line = (y % 3 === 0) && ((x * 5 + y) % 7 < 5);
      return line ? rgb(90, 90, 90) : rgb(c[0], c[1], c[2]);
    }
    const j = jitter(x, y, 30);
    return rgb(clamp(190 + j), clamp(142 + j), clamp(88 + j));                                                      // korek
  }
  return wall(x, y);
});

// szare metalowe drzwi z biala tabliczka numeru (jak sala 313 na zdjeciu)
const makeDoorTex = wall => makeTex((x, y) => {
  if (inBox(x, y, 7, 2, 56, 63)) {
    if (x <= 8 || x >= 55 || y <= 3) return rgb(228, 228, 224);                                                    // biala futryna
    if (inBox(x, y, 36, 12, 52, 22)) return (x === 36 || x === 52 || y === 12 || y === 22) ? rgb(170, 170, 170) : (y >= 14 && y <= 15 && x >= 38 && x <= 42) ? rgb(235, 150, 40) : (y >= 18 && y % 2 === 0 && x >= 38 && x <= 50) ? rgb(120, 120, 120) : rgb(248, 248, 246);
    if (inBox(x, y, 46, 33, 51, 36)) return rgb(210, 212, 214);                                                    // klamka
    if (inBox(x, y, 46, 38, 48, 40)) return rgb(90, 92, 96);                                                       // zamek
    const sheen = 12 * Math.sin(x / 9), j = jitter(x, y, 5);
    return rgb(clamp(158 + sheen + j), clamp(163 + sheen + j), clamp(170 + sheen + j));
  }
  return wall(x, y);
});

// zestaw tekstur sciany dla pietra: indeks = numer tekstury z mapy (1 sciana, 2 tablica, 4 drzwi, 7 okno)
function makeThemeTex(th) {
  const wall = makeWallBase(th);
  return { ...TEX, 1: makeTex(wall), 2: makeCorkTex(wall), 4: makeDoorTex(wall), 7: makeWindowTex(wall) };
}

// --- podloga: lastryko z ciemnymi pasami, sufit z panelami ----------------------------------------------
const terrazzo = th => (x, y) => {
  const j = jitter(x, y, 7), blot = jitter(x >> 3, y >> 3, 10), speck = hash(x * 3 + 1, y * 5 + 2), o = th.floor;
  if (speck > 0.988) return rgb(clamp(118 + o[0] + j), clamp(113 + o[1] + j), clamp(105 + o[2] + j));              // ciemne drobinki
  if (speck < 0.012) return rgb(clamp(214 + o[0] + j), clamp(208 + o[1] + j), clamp(194 + o[2] + j));             // jasne drobinki
  return rgb(clamp(176 + o[0] + blot + j), clamp(170 + o[1] + blot + j), clamp(154 + o[2] + blot + j));
};
const ceilTex = th => makeTex((x, y) => { const j = jitter(x >> 2, y >> 2, 4); return rgb(clamp(th.ceil[0] + j), clamp(th.ceil[1] + j), clamp(th.ceil[2] + j)); });
// gotowe zestawy dla czterech pieter: sciany, podloga, sufit, pasy
const THEME_SETS = THEMES.map(th => ({ tex: makeThemeTex(th), floor: makeTex(terrazzo(th)), ceil: ceilTex(th), stripe: rgb(th.stripe[0], th.stripe[1], th.stripe[2]) }));

// bity sasiedztwa sciany dla kazdej komorki: 1 N, 2 E, 4 S, 8 W (ciemny pas wzdluz scian na podlodze), 16 poprzeczny pas
const edgeMaskCache = new Map();
function edgeMask(world, floorIdx) {
  if (edgeMaskCache.has(floorIdx)) return edgeMaskCache.get(floorIdx);
  const f = world.floors[floorIdx], h = f.grid.length, w = f.grid[0].length, m = new Uint8Array(w * h);
  const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || f.grid[y][x] !== 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (f.grid[y][x] !== 0) continue;
      m[y * w + x] = (solid(x, y - 1) ? 1 : 0) | (solid(x + 1, y) ? 2 : 0) | (solid(x, y + 1) ? 4 : 0) | (solid(x - 1, y) ? 8 : 0)
        | (x % 14 === 7 && !f.stairCells[y][x] ? 16 : 0);
    }
  }
  edgeMaskCache.set(floorIdx, m);
  return m;
}

// kolor piksela podlogi: lastryko, pasy przy scianach, poprzeczne pasy, stopnie na schodach
const STAIR_EDGE = rgb(70, 68, 66), LED_COLOR = rgb(255, 251, 246);
function floorColor(set, mask, stair, u, v) {
  if (stair) {
    const s = (u * 4) % 1;
    return s < 0.14 ? STAIR_EDGE : set.floor[((v * 64) & 63) * 64 + ((u * 64) & 63)];
  }
  if (((mask & 1) && v < 0.16) || ((mask & 4) && v > 0.84) || ((mask & 2) && u > 0.84) || ((mask & 8) && u < 0.16)) return set.stripe;
  if ((mask & 16) && u > 0.35 && u < 0.65) return set.stripe;
  return set.floor[((v * 64) & 63) * 64 + ((u * 64) & 63)];
}

// kolor piksela sufitu i czy to panel LED (swieci, nie ciemnieje z odlegloscia)
function ceilingColor(set, cx, cy, u, v) {
  if (cx % 4 === 1 && cy % 3 === 1 && u > 0.12 && u < 0.88 && v > 0.3 && v < 0.7) return LED_COLOR;
  return set.ceil[((v * 64) & 63) * 64 + ((u * 64) & 63)];
}

// --- sprite'y dekoracji ---------------------------------------------------------------------------------
SPRITES.bench = makeSprite([
  '.oooooooooooooo.',
  '.oooooooooooooo.',
  '.b............b.',
  '.oooooooooooooo.',
  '.oooooooooooooo.',
  '.b............b.',
  '.b............b.',
  '.b............b.',
], { o: rgb(206, 140, 74), b: rgb(40, 84, 168) });

const pufaCache = {};
function pufaSprite(hex) {
  if (!pufaCache[hex]) {
    const v = parseInt(hex.slice(1), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    const light = rgb(Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40)), dark = rgb(r * 0.7, g * 0.7, b * 0.7);
    pufaCache[hex] = makeSprite([
      '..tttttttt..',
      '.tttttttttt.',
      'ffffffffffff',
      'ffffffffffff',
      'ffffffffffff',
      'ffffffffffdd',
      'ffffffffffdd',
      '.dddddddddd.',
    ], { t: light, f: rgb(r, g, b), d: dark });
  }
  return pufaCache[hex];
}

SPRITES.plant = makeSprite([
  '...g..g.....',
  '..ggg.gg.g..',
  '.ggggggggg..',
  '..ggggggg...',
  '.gggggggggg.',
  '..gggggggg..',
  '....gggg....',
  '....pppp....',
  '...pppppp...',
  '...pppppp...',
  '...pppppp...',
  '....pppp....',
], { g: rgb(52, 138, 62), p: rgb(158, 92, 56) });
