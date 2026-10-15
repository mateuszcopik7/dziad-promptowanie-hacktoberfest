// swiat gry z mapa ZSTI (js/world-data.js generowane z mapa/mapa.json): siatki pieter, sale, drzwi, schody.
// Wnetrza sal nie sa dostepne: drzwi (komorki 'D') sa scianami, a uderzenie w nie uruchamia spotkanie w sali.

// kod komorki z mapy -> numer tekstury sciany (0 = przechodnia)
const CELL_TEX = { '#': 1, L: 2, W: 7, B: 8, D: 4, '.': 0, S: 0, E: 0 };

function buildWorld(data) {
  const floors = data.floors.map(f => {
    const doors = {};
    f.doors.forEach(d => d.cells.forEach(([x, y]) => { doors[x + ',' + y] = d; }));
    return {
      level: f.level, name: f.name, zones: f.zones, npcSlots: f.npcSlots, decor: f.decor || [], doors,
      grid: f.grid.map(row => [...row].map(ch => (CELL_TEX[ch] === undefined ? 1 : CELL_TEX[ch]))),
      stairCells: f.grid.map(row => [...row].map(ch => ch === 'S')),
      rooms: Object.fromEntries(f.zones.filter(z => z.type === 'room').map(z => [z.id, z])),
    };
  });
  return { floors, stairs: data.stairs, entrance: data.entrance };
}

const WORLD = buildWorld(WORLD_DATA);

const inRect = (z, x, y) => x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h;

// strefa nie-salowa (korytarz, hol, klatka) w danym punkcie albo null
function zoneAt(floor, x, y) {
  return floor.zones.find(z => z.type !== 'room' && inRect(z, Math.floor(x), Math.floor(y))) || null;
}

// wejscia na schody dostepne z danej klatki (A lub B) na pietrze
function stairsNear(world, floorIdx, x) {
  const letter = x < 42 ? 'A' : 'B';
  return world.stairs.filter(s => s.floor === floorIdx && s.id.includes('-' + letter + '-'));
}
