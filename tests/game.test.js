// node tests/game.test.js - testy logiki gry bez przegladarki
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({});
const src = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');
vm.runInContext(src + '\nthis.api = { LEVELS, ENEMY_TYPES, createGame, step, castDist, hasLOS, gainXp, xpNeeded, carryOf };', ctx);
const api = ctx.api;
const idle = { move: 0, strafe: 0, turn: 0, fire: false };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

const floorAt = (g, x, y) => g.grid[Math.floor(y)] && g.grid[Math.floor(y)][Math.floor(x)] === 0;

api.LEVELS.forEach((L, i) => {
  test(`poziom ${i + 1} (${L.name}): ksztalt i obramowanie`, () => {
    assert(L.map.every(r => r.length === L.map[0].length), 'wiersze roznej dlugosci');
    assert(L.map.every(r => /^[.1-6]+$/.test(r)), 'zly znak w mapie');
    assert([...L.map[0], ...L.map[L.map.length - 1]].every(c => c !== '.'), 'dziura w gornej/dolnej scianie');
    assert(L.map.every(r => r[0] !== '.' && r[r.length - 1] !== '.'), 'dziura w bocznej scianie');
  });

  test(`poziom ${i + 1}: start, wrogowie i pickupy na podlodze i osiagalne`, () => {
    const g = api.createGame(i);
    const h = g.grid.length, w = g.grid[0].length, seen = new Set();
    const queue = [[Math.floor(L.start.x), Math.floor(L.start.y)]];
    assert(floorAt(g, L.start.x, L.start.y), 'start w scianie');
    while (queue.length) {
      const [x, y] = queue.pop(), key = x + ',' + y;
      if (seen.has(key) || x < 0 || y < 0 || x >= w || y >= h || g.grid[y][x] !== 0) continue;
      seen.add(key);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const e of g.enemies) {
      assert(api.ENEMY_TYPES[e.type], 'nieznany typ ' + e.type);
      assert(seen.has(Math.floor(e.x) + ',' + Math.floor(e.y)), `wrog ${e.type} ${e.x},${e.y} nieosiagalny`);
    }
    for (const k of g.pickups) assert(seen.has(Math.floor(k.x) + ',' + Math.floor(k.y)), `pickup ${k.kind} ${k.x},${k.y} nieosiagalny`);
  });
});

test('strzal zabija buga po 3 trafieniach i daje XP', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 2.5, y: 6.5, angle: 0 });
  g.enemies = [{ type: 'bug', x: 5.5, y: 6.5, hp: 3, alive: true, awake: false, hit: 0, atk: 0 }];
  g.total = 1;
  for (let i = 0; i < 60; i++) api.step(g, { ...idle, fire: true });
  assert.strictEqual(g.kills, 1);
  assert.strictEqual(g.state, 'win');
  assert.strictEqual(g.player.xp, 10);
});

test('sciana blokuje strzal', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 1.5, y: 4.5, angle: Math.PI / 2 });
  g.enemies = [{ type: 'bug', x: 1.5, y: 6.5, hp: 3, alive: true, awake: false, hit: 0, atk: 0 }];
  g.total = 2;
  for (let i = 0; i < 30; i++) api.step(g, { ...idle, fire: true });
  assert.strictEqual(g.enemies[0].hp, 3);
});

test('brak amunicji: strzal nie zabiera ani nie trafia', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 2.5, y: 6.5, angle: 0, ammo: 0 });
  g.enemies = [{ type: 'bug', x: 5.5, y: 6.5, hp: 3, alive: true, awake: false, hit: 0, atk: 0 }];
  g.total = 2;
  api.step(g, { ...idle, fire: true });
  assert.strictEqual(g.enemies[0].hp, 3);
  assert(g.events.includes('empty'));
});

test('zabity bug zwraca amunicje', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 2.5, y: 6.5, angle: 0, ammo: 3 });
  g.enemies = [{ type: 'glitch', x: 5.5, y: 6.5, hp: 1, alive: true, awake: false, hit: 0, atk: 0 }];
  g.total = 2;
  api.step(g, { ...idle, fire: true });
  assert.strictEqual(g.kills, 1);
  assert.strictEqual(g.player.ammo, 2 + 3);
});

test('zero amunicji i brak pendrive: awaryjny zapas, zadnego zakleszczenia', () => {
  const g = api.createGame(0);
  g.pickups = g.pickups.filter(k => k.kind !== 'usb');
  g.player.ammo = 0;
  api.step(g, idle);
  assert.strictEqual(g.player.ammo, 5);
});

test('awans: XP daje poziom, wiecej HP i leczenie', () => {
  const g = api.createGame(0);
  g.player.hp = 50;
  api.gainXp(g, api.xpNeeded(1));
  assert.strictEqual(g.player.level, 2);
  assert.strictEqual(g.player.maxHp, 110);
  assert.strictEqual(g.player.hp, 80);
});

test('wrog budzi sie w zasiegu wzroku i gryzie', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 2.5, y: 6.5, angle: 0 });
  g.enemies = [{ type: 'bug', x: 3.3, y: 6.5, hp: 3, alive: true, awake: false, hit: 0, atk: 0 }];
  g.total = 2;
  api.step(g, idle);
  assert.strictEqual(g.player.hp, 92);
});

test('wrog za sciana spi', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 1.5, y: 4.5 });
  g.enemies = [{ type: 'bug', x: 1.5, y: 6.5, hp: 3, alive: true, awake: false, hit: 0, atk: 0 }];
  g.total = 2;
  for (let i = 0; i < 10; i++) api.step(g, idle);
  assert.strictEqual(g.enemies[0].awake, false);
});

test('gracz nie wchodzi w sciane', () => {
  const g = api.createGame(0);
  Object.assign(g.player, { x: 1.5, y: 4.5, angle: -Math.PI / 2 });
  for (let i = 0; i < 120; i++) api.step(g, { ...idle, move: 1 });
  assert(g.player.y > 1);
  assert(floorAt(g, g.player.x, g.player.y));
});

test('pickup: jedzenie leczy do maxHp, pendrive daje amunicje', () => {
  const g = api.createGame(0);
  g.player.hp = 60;
  g.pickups = [{ kind: 'food', x: g.player.x, y: g.player.y }, { kind: 'usb', x: g.player.x, y: g.player.y }];
  const ammo = g.player.ammo;
  api.step(g, idle);
  assert.strictEqual(g.player.hp, 85);
  assert.strictEqual(g.player.ammo, ammo + 10);
  assert.strictEqual(g.pickups.length, 0);
});

console.log(`\n${passed} testow przeszlo`);
