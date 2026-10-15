// node tests/game.test.js - testy swiata i logiki gry bez przegladarki
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({});
const load = f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
const src = ['world-data.js', 'world.js', 'content.js', 'quests.js', 'game.js'].map(load).join('\n');
vm.runInContext(src + `\nthis.api = { WORLD, NPC_DEFS, QUEST_DEFS, FOOD_PLACE, ITEM_PLACE, FINAL_ROOM, createGame, step, setFloor, useStairs, respawn,
  doorStatus, applyEffects, gainXp, xpNeeded, castDist, hasLOS, roomEncounter, chooseDialog, dialogFor, isUnlocked, questStatus, stairsNear,
  createQuestState, onQuestKill, wallAt };`, ctx);
const api = ctx.api;
const idle = { move: 0, strafe: 0, turn: 0, fire: false, interact: false, flashlight: false, heal: false };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const W = api.WORLD;

test('swiat: 4 pietra 84x56, wejscie na parterze na wolnej komorce', () => {
  assert.strictEqual(W.floors.length, 4);
  W.floors.forEach(f => { assert.strictEqual(f.grid.length, 56); assert(f.grid.every(r => r.length === 84)); });
  const e = W.entrance;
  assert.strictEqual(e.floor, 0);
  assert.strictEqual(W.floors[0].grid[e.y][e.x], 0);
});

test('drzwi: kazde jest sciana-drzwiami i wskazuje istniejaca sale', () => {
  W.floors.forEach(f => {
    for (const [key, d] of Object.entries(f.doors)) {
      const [x, y] = key.split(',').map(Number);
      assert.strictEqual(f.grid[y][x], 4, 'komorka drzwi ' + key);
      assert(f.rooms[d.zone], 'brak sali ' + d.zone);
    }
  });
});

test('schody: kazde ma pare na drugim pietrze, ladowanie na przechodniej komorce', () => {
  for (const s of W.stairs) {
    const [tf, tx, ty] = s.to;
    assert.strictEqual(W.floors[tf].grid[ty][tx], 0, 'ladowanie ' + s.id);
    assert(W.floors[tf].stairCells[ty][tx], 'ladowanie poza klatka ' + s.id);
    assert(W.stairs.some(r => r.floor === tf && r.to[0] === s.floor && r.x === tx && r.y === ty), 'brak pary dla ' + s.id);
  }
});

// przejscie po wszystkich pietrach z wejscia (schody lacza ta sama komorke miedzy pietrami)
function reachable() {
  const seen = W.floors.map(f => f.grid.map(r => r.map(() => false)));
  const queue = [[W.entrance.floor, W.entrance.x, W.entrance.y]];
  while (queue.length) {
    const [fl, x, y] = queue.pop(), f = W.floors[fl];
    if (y < 0 || x < 0 || y >= f.grid.length || x >= f.grid[0].length || f.grid[y][x] !== 0 || seen[fl][y][x]) continue;
    seen[fl][y][x] = true;
    queue.push([fl, x + 1, y], [fl, x - 1, y], [fl, x, y + 1], [fl, x, y - 1]);
    for (const s of W.stairs) if (s.floor === fl && s.x === x && s.y === y) queue.push([s.to[0], s.to[1], s.to[2]]);
  }
  return seen;
}

test('osiagalnosc: wszystkie drzwi, NPC, jedzenie i przedmioty da sie dotknac z wejscia', () => {
  const seen = reachable(), g = api.createGame();
  const near = (fl, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[fl][Math.floor(y) + dy] && seen[fl][Math.floor(y) + dy][Math.floor(x) + dx]);
  W.floors.forEach((f, fl) => Object.keys(f.doors).forEach(k => { const [x, y] = k.split(',').map(Number); assert(near(fl, x, y), `drzwi ${k} na pietrze ${fl}`); }));
  g.npcs.forEach(n => assert(seen[n.floor][Math.floor(n.y)][Math.floor(n.x)], 'NPC ' + n.id));
  api.FOOD_PLACE.forEach(([fl, x, y]) => assert(seen[fl][Math.floor(y)][Math.floor(x)], `jedzenie ${fl} ${x},${y}`));
  api.ITEM_PLACE.forEach(i => assert(seen[i.floor][Math.floor(i.y)][Math.floor(i.x)], 'przedmiot ' + i.item));
});

test('NPC z questami stoja na swoich slotach, nikt nie dzieli komorki', () => {
  const g = api.createGame(), cells = new Set();
  for (const [id, d] of Object.entries(api.NPC_DEFS)) {
    const n = g.npcs.find(x => x.id === id), slot = W.floors[n.floor].npcSlots.find(s => s.id === d.slot);
    assert(slot, 'slot ' + d.slot);
    assert(Math.floor(n.x) === slot.x && Math.floor(n.y) === slot.y);
  }
  g.npcs.forEach(n => { const k = n.floor + ',' + Math.floor(n.x) + ',' + Math.floor(n.y); assert(!cells.has(k)); cells.add(k); });
});

test('sale z bossami maja kompletna definicje spotkania', () => {
  let rooms = 0;
  W.floors.forEach((f, fl) => Object.values(f.rooms).filter(z => z.boss_ready).forEach(z => {
    const r = api.roomEncounter(z, fl);
    assert(r.boss.hp > 0 && r.boss.acts.some(a => a.mercy > 0) && r.boss.patterns.length, z.id);
    assert(r.teacher.intro.length && r.teacher.outro.killed && r.teacher.outro.spared);
    rooms++;
  }));
  assert(rooms >= 20);
  assert(W.floors[1].rooms[api.FINAL_ROOM] && W.floors[1].rooms[api.FINAL_ROOM].boss_ready);
});

test('start: bez broni, strzal nic nie robi, latarka pod F', () => {
  const g = api.createGame();
  assert.strictEqual(g.player.weapon, false);
  api.step(g, { ...idle, fire: true });
  assert.strictEqual(g.player.ammo, 0);
  assert(!g.events.includes('shoot'));
  assert.strictEqual(g.player.flashlight, false);
  api.step(g, { ...idle, flashlight: true });
  assert.strictEqual(g.player.flashlight, true);
});

test('gracz nie wchodzi w sciane ani w NPC', () => {
  const g = api.createGame();
  Object.assign(g.player, { x: 41.5, y: 54.5, angle: Math.PI / 2 });          // w dol, w sciane budynku
  for (let i = 0; i < 120; i++) api.step(g, { ...idle, move: 1 });
  assert(g.player.y < 56 && g.grid[Math.floor(g.player.y)][Math.floor(g.player.x)] === 0);
  const npc = g.npcs.find(n => n.floor === 0);
  Object.assign(g.player, { x: npc.x - 2, y: npc.y, angle: 0 });
  for (let i = 0; i < 120; i++) api.step(g, { ...idle, move: 1 });
  assert(Math.hypot(npc.x - g.player.x, npc.y - g.player.y) >= 0.5);
});

test('NPC w zasiegu: podpowiedz i prosba o rozmowe po E', () => {
  const g = api.createGame(), n = g.npcs.find(x => x.id === 'woznik');
  Object.assign(g.player, { x: n.x - 1.5, y: n.y, angle: 0 });
  api.step(g, idle);
  assert(g.prompt.includes('Heniek'));
  api.step(g, { ...idle, interact: true });
  assert.strictEqual(g.request.type, 'npc');
  assert.strictEqual(g.request.id, 'woznik');
});

test('uderzenie w drzwi zglasza spotkanie, w drzwi zamkniete - komunikat', () => {
  const g = api.createGame();
  api.setFloor(g, 1);
  const door = Object.values(W.floors[1].doors).find(d => d.zone === 'f1-library');
  const [cx, cy] = door.cells[0];
  Object.assign(g.player, { x: cx + 0.5, y: cy + 1.6, angle: -Math.PI / 2 });    // przed drzwiami od strony korytarza
  let req = null;
  for (let i = 0; i < 60 && !req; i++) { api.step(g, { ...idle, move: 1 }); req = g.request; }
  assert(req && req.type === 'door' && req.door.zone === 'f1-library');
  assert.strictEqual(api.doorStatus(g, req.door).kind, 'encounter');
  const toilets = Object.values(W.floors[1].doors).find(d => d.zone === 'f1-wc');
  assert.strictEqual(api.doorStatus(g, toilets).kind, 'msg');
  const aula = Object.values(W.floors[1].doors).find(d => d.zone === api.FINAL_ROOM);
  assert.strictEqual(api.doorStatus(g, aula).kind, 'msg');
  g.qs.unlocked.push('drzwi-auli');
  assert.strictEqual(api.doorStatus(g, aula).kind, 'encounter');
  g.cleared.push('f1-library');
  assert.strictEqual(api.doorStatus(g, req.door).kind, 'msg');
});

test('klatka schodowa: wejscie zglasza opcje pieter, useStairs zmienia pietro i blokuje ponowny wyzwalacz', () => {
  const g = api.createGame();
  Object.assign(g.player, { x: 4.5, y: 27.5, angle: 0 });
  api.step(g, idle);
  assert.strictEqual(g.request.type, 'stairs');
  assert(g.request.options.length >= 1 && g.request.options.every(s => s.floor === 0));
  api.useStairs(g, g.request.options[0]);
  assert.strictEqual(g.floor, 1);
  api.step(g, idle);
  assert.strictEqual(g.request, null);
  Object.assign(g.player, { x: 20.5, y: 27.5 });
  api.step(g, idle);
  Object.assign(g.player, { x: 77.5, y: 27.5 });
  api.step(g, idle);
  assert.strictEqual(g.request.type, 'stairs');
  assert(g.request.options.length === 2, 'na srodkowym pietrze sa schody w gore i w dol');
});

// pomocnicze: przyjmij quest u NPC
const talk = (g, npc, option) => api.applyEffects(g, api.chooseDialog(g.qs, api.QUEST_DEFS, g.npcDefs, npc, option));

test('quest ze strzelaniem: bron dopiero po przyjeciu, mobki pojawiaja sie w korytarzu, bron znika po oddaniu', () => {
  const g = api.createGame();
  assert.strictEqual(g.floors[0].enemies.length, 0);
  talk(g, 'woznik', 'accept');
  assert.strictEqual(g.player.weapon, true);
  assert.strictEqual(g.player.ammo, 40);
  assert.strictEqual(g.floors[0].enemies.length, 5);
  assert(g.floors[0].enemies.every(e => e.zone === 'f0-corridor' && api.wallAt(g.grid, Math.floor(e.x), Math.floor(e.y)) === 0));
  // zabij wszystkich: ustaw przed kazdym w linii strzalu
  for (const e of g.floors[0].enemies) {
    Object.assign(g.player, { x: e.x - 3, y: e.y, angle: 0, hp: 60 });
    if (api.wallAt(g.grid, Math.floor(g.player.x), Math.floor(g.player.y))) Object.assign(g.player, { x: e.x + 3, angle: Math.PI });
    for (let i = 0; i < 120 && e.alive; i++) api.step(g, { ...idle, fire: true });
    assert(!e.alive);
  }
  assert.strictEqual(api.questStatus(g.qs, api.QUEST_DEFS, 'bugi'), 'ready');
  const xpBefore = g.player.xp + g.player.level * 1000;
  talk(g, 'woznik', 'turnin');
  assert.strictEqual(g.player.weapon, false);
  assert(g.player.xp + g.player.level * 1000 > xpBefore);
  assert.strictEqual(api.questStatus(g.qs, api.QUEST_DEFS, 'bugi'), 'done');
});

test('lancuch: pieczatka, liscik i klucz odblokowuja aule', () => {
  const g = api.createGame();
  g.qs.quests.bugi = { status: 'done', progress: 5 };
  talk(g, 'sekretarka', 'accept');
  api.setFloor(g, 2);
  const it = api.ITEM_PLACE[0];
  Object.assign(g.player, { x: it.x, y: it.y });
  api.step(g, idle);
  assert.strictEqual(api.questStatus(g.qs, api.QUEST_DEFS, 'pieczatka'), 'ready');
  talk(g, 'sekretarka', 'turnin');
  talk(g, 'uczen', 'accept');
  talk(g, 'bibliotekarka', 'deliver');
  talk(g, 'uczen', 'turnin');
  assert.strictEqual(api.questStatus(g.qs, api.QUEST_DEFS, 'klucz'), 'available');
  talk(g, 'dyrektor', 'accept');
  talk(g, 'woznik', 'deliver');
  assert(!api.isUnlocked(g.qs, 'drzwi-auli'));
  talk(g, 'dyrektor', 'turnin');
  assert(api.isUnlocked(g.qs, 'drzwi-auli'));
});

test('zdrowie: kanapka leczy po H, respawn wraca do ostatnich schodow z polowa HP', () => {
  const g = api.createGame();
  g.player.hp = 20;
  api.step(g, { ...idle, heal: true });
  assert.strictEqual(g.player.hp, 45);
  assert.strictEqual(g.food, 1);
  Object.assign(g.player, { x: 4.5, y: 27.5 });
  api.step(g, idle);
  api.useStairs(g, g.request.options[0]);
  Object.assign(g.player, { x: 40.5, y: 27.5, hp: 0 });
  api.step(g, idle);
  assert.strictEqual(g.state, 'dead');
  api.respawn(g);
  assert.strictEqual(g.state, 'play');
  assert.strictEqual(g.floor, 1);
  assert.strictEqual(g.player.hp, 30);
});

test('XP daje poziomy, wiecej HP i leczenie', () => {
  const g = api.createGame();
  g.player.hp = 10;
  api.gainXp(g, api.xpNeeded(1));
  assert.strictEqual(g.player.level, 2);
  assert.strictEqual(g.player.maxHp, 70);
  assert.strictEqual(g.player.hp, 40);
});

console.log(`\n${passed} testow przeszlo`);
