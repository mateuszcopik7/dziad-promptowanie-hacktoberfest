// wyglad ZSTI dopasowany do zdjec (.map-photos): dwukolorowe sciany ze skosnym cokolem, szare drzwi z tabliczka,
// male okna naswietla nad drzwiami, tablice korkowe, lastryko na podlodze, biale sufity z panelami LED, laweczki, pufy.
// Nadpisuje tekstury 1, 2, 4, 7 z assets.js. Zero plikow, wszystko proceduralnie.

// --- sciana korytarza: biala gorna czesc, jasnoszara dolna, linia podzialu, niebieskoszary cokol ---------
const WALL_UP = [233, 232, 227], WALL_LOW = [197, 199, 197];

function wallBase(x, y) {
  const j = jitter(x >> 1, y >> 1, 5) + jitter(x, y, 3);
  if (y >= 58) return y === 58 ? rgb(176, 184, 194) : rgb(clamp(118 + j), clamp(133 + j), clamp(154 + j));        // cokol
  if (y === 29) return rgb(clamp(172 + j), clamp(174 + j), clamp(172 + j));                                         // linia podzialu
  const c = y < 29 ? WALL_UP : WALL_LOW;
  return rgb(clamp(c[0] + j), clamp(c[1] + j), clamp(c[2] + j));
}

const inBox = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

TEX[1] = makeTex(wallBase);

// male okno naswietla w gornej czesci sciany (jak nad drzwiami na zdjeciach), z parapetem
TEX[7] = makeTex((x, y) => {
  if (inBox(x, y, 9, 4, 54, 27)) {
    if (inBox(x, y, 9, 4, 54, 27) && !inBox(x, y, 12, 7, 51, 24)) return rgb(238, 238, 234);                        // rama
    if (x >= 31 && x <= 32) return rgb(238, 238, 234);                                                              // szprosa
    const t = (y - 7) / 17;
    if (y > 17) return rgb(clamp(150 + 20 * x / 64), clamp(165 + 15 * x / 64), clamp(182));                         // dalekie budynki
    return rgb(clamp(198 + 40 * t), clamp(219 + 25 * t), clamp(238 + 8 * t));                                       // niebo
  }
  if (inBox(x, y, 7, 28, 56, 31)) return y === 31 ? rgb(150, 152, 150) : rgb(224, 224, 220);                        // parapet
  return wallBase(x, y);
});

// tablica korkowa z plakatami
const POSTER_COLORS = [[240, 240, 235], [235, 200, 60], [90, 160, 220], [220, 90, 90], [120, 190, 120], [245, 245, 245]];
TEX[2] = makeTex((x, y) => {
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
  return wallBase(x, y);
});

// szare metalowe drzwi z biala tabliczka numeru (jak sala 313 na zdjeciu)
TEX[4] = makeTex((x, y) => {
  if (inBox(x, y, 7, 2, 56, 63)) {
    if (x <= 8 || x >= 55 || y <= 3) return rgb(228, 228, 224);                                                    // biala futryna
    if (inBox(x, y, 36, 12, 52, 22)) return (x === 36 || x === 52 || y === 12 || y === 22) ? rgb(170, 170, 170) : (y >= 14 && y <= 15 && x >= 38 && x <= 42) ? rgb(235, 150, 40) : (y >= 18 && y % 2 === 0 && x >= 38 && x <= 50) ? rgb(120, 120, 120) : rgb(248, 248, 246);
    if (inBox(x, y, 46, 33, 51, 36)) return rgb(210, 212, 214);                                                    // klamka
    if (inBox(x, y, 46, 38, 48, 40)) return rgb(90, 92, 96);                                                       // zamek
    const sheen = 12 * Math.sin(x / 9), j = jitter(x, y, 5);
    return rgb(clamp(158 + sheen + j), clamp(163 + sheen + j), clamp(170 + sheen + j));
  }
  return wallBase(x, y);
});

// --- podloga: lastryko z ciemnymi pasami, sufit z panelami ----------------------------------------------
function terrazzo(x, y) {
  const j = jitter(x, y, 7), blot = jitter(x >> 3, y >> 3, 10), speck = hash(x * 3 + 1, y * 5 + 2);
  if (speck > 0.988) return rgb(clamp(118 + j), clamp(113 + j), clamp(105 + j));                                       // ciemne drobinki
  if (speck < 0.012) return rgb(clamp(214 + j), clamp(208 + j), clamp(194 + j));                                     // jasne drobinki
  return rgb(clamp(176 + blot + j), clamp(170 + blot + j), clamp(154 + blot + j));
}
const FLOOR_TEX = makeTex(terrazzo);
const CEIL_TEX = makeTex((x, y) => { const j = jitter(x >> 2, y >> 2, 4); return rgb(clamp(224 + j), clamp(224 + j), clamp(220 + j)); });

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
const FLOOR_STRIPE = rgb(66, 64, 62), STAIR_EDGE = rgb(70, 68, 66), LED_COLOR = rgb(255, 251, 246);
function floorColor(mask, stair, u, v) {
  if (stair) {
    const s = (u * 4) % 1;
    return s < 0.14 ? STAIR_EDGE : FLOOR_TEX[((v * 64) & 63) * 64 + ((u * 64) & 63)];
  }
  if (((mask & 1) && v < 0.16) || ((mask & 4) && v > 0.84) || ((mask & 2) && u > 0.84) || ((mask & 8) && u < 0.16)) return FLOOR_STRIPE;
  if ((mask & 16) && u > 0.35 && u < 0.65) return FLOOR_STRIPE;
  return FLOOR_TEX[((v * 64) & 63) * 64 + ((u * 64) & 63)];
}

// kolor piksela sufitu i czy to panel LED (swieci, nie ciemnieje z odlegloscia)
function ceilingColor(cx, cy, u, v) {
  if (cx % 4 === 1 && cy % 3 === 1 && u > 0.12 && u < 0.88 && v > 0.3 && v < 0.7) return LED_COLOR;
  return CEIL_TEX[((v * 64) & 63) * 64 + ((u * 64) & 63)];
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
