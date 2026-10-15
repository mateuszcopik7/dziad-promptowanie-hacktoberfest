// node tests/battle.test.js - testy walki turowej bez przegladarki
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({});
const src = fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8');
vm.runInContext(src + '\nthis.api = { BOX, createBattle, stepBattle, battleResult };', ctx);
const api = ctx.api;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

const BOSS = {
  name: 'Woźny', hp: 30, xp: 80, intro: 'Woźny blokuje drogę.', check: 'Woźny. Lubi ciszę.',
  killText: 'Woźny pada.', spareText: 'Woźny odpuszcza.', flavor: ['Mopem w dłoń.'],
  acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'help', label: 'Pomóż', mercy: 60, text: 'Pomagasz zamiatać.' }],
  patterns: [{ type: 'rain', rate: 6, speed: 1.6, dmg: 5 }, { type: 'wall', rate: 60, speed: 1.2, dmg: 8 }, { type: 'side', rate: 20, speed: 2, dmg: 4 }],
};
const PLAYER = { hp: 40, maxHp: 40, level: 1 };
const NONE = {}, OK = { confirm: true };

const tap = (b, pressed, n = 1) => { for (let i = 0; i < n; i++) api.stepBattle(b, NONE, pressed); };
const toMenu = b => { tap(b, OK); assert.strictEqual(b.phase, 'menu'); };
const idle = (b, n) => { for (let i = 0; i < n; i++) api.stepBattle(b, NONE, NONE); };

test('walka zaczyna sie tekstem, potem menu glowne', () => {
  const b = api.createBattle(BOSS, PLAYER, [], 1);
  assert.strictEqual(b.phase, 'text');
  toMenu(b);
  assert.strictEqual(b.menu, 'main');
});

test('FIGHT: trafienie w srodek paska daje maksimum, brzeg daje pudlo', () => {
  const mid = api.createBattle(BOSS, PLAYER, [], 1); toMenu(mid);
  tap(mid, OK);                                       // FIGHT
  assert.strictEqual(mid.phase, 'bar');
  while (mid.bar.pos < 0.5) idle(mid, 1);
  tap(mid, OK);
  assert(mid.bar.hit >= 11 && mid.enemyHp < 30);
  const edge = api.createBattle(BOSS, PLAYER, [], 1); toMenu(edge);
  tap(edge, OK); tap(edge, OK);                       // stop od razu: pozycja ~0
  assert.strictEqual(edge.bar.hit, 0);
  assert.strictEqual(edge.enemyHp, 30);
});

test('pasek bez klikniecia konczy sie sam pudlem', () => {
  const b = api.createBattle(BOSS, PLAYER, [], 1); toMenu(b);
  tap(b, OK);
  idle(b, 200);
  assert.strictEqual(b.phase, 'text');
  assert.strictEqual(b.bar.hit, 0);
});

test('zabicie bossa konczy walke wynikiem killed i XP', () => {
  const b = api.createBattle({ ...BOSS, hp: 1 }, PLAYER, [], 1); toMenu(b);
  tap(b, OK);
  while (b.bar.pos < 0.5) idle(b, 1);
  tap(b, OK);                                         // killText
  tap(b, OK);
  assert.strictEqual(b.phase, 'end');
  const r = api.battleResult(b);
  assert.strictEqual(r.outcome, 'killed');
  assert.strictEqual(r.xp, 80);
});

test('MERCY przed pelnym nastrojem nie konczy walki', () => {
  const b = api.createBattle(BOSS, PLAYER, [], 1); toMenu(b);
  tap(b, { right: true }, 3); tap(b, OK);             // MERCY
  assert.strictEqual(b.phase, 'text');
  assert.strictEqual(b.next, 'dodge');
});

test('ACT podnosi nastroj, pelny nastroj pozwala oszczedzic', () => {
  const b = api.createBattle(BOSS, PLAYER, [], 1);
  toMenu(b);
  for (let round = 0; round < 2; round++) {
    tap(b, { right: true }); tap(b, OK);              // ACT
    tap(b, { down: true }); tap(b, OK);               // Pomoz (+60)
    assert.strictEqual(b.next, 'dodge');
    tap(b, OK);                                       // do tury bossa
    idle(b, 400);                                     // unik (serce stoi, moze oberwac)
    if (b.phase === 'end') break;
    tap(b, OK);                                       // flavor -> menu
  }
  assert.strictEqual(b.mercy, 100);
  tap(b, { right: true }, 3); tap(b, OK);             // MERCY
  tap(b, OK);
  assert.strictEqual(api.battleResult(b).outcome, 'spared');
  assert.strictEqual(api.battleResult(b).xp, 80);
});

test('ITEM leczy i zuzywa przedmiot', () => {
  const b = api.createBattle(BOSS, { hp: 10, maxHp: 40, level: 1 }, [{ id: 'food', name: 'Kanapka', heal: 25, count: 1 }], 1);
  toMenu(b);
  tap(b, { right: true }, 2); tap(b, OK);             // ITEM
  tap(b, OK);
  assert.strictEqual(b.hp, 35);
  assert.strictEqual(b.items[0].count, 0);
});

test('ITEM bez przedmiotow wraca do menu z komunikatem', () => {
  const b = api.createBattle(BOSS, PLAYER, [], 1); toMenu(b);
  tap(b, { right: true }, 2); tap(b, OK);
  assert.strictEqual(b.phase, 'text');
  assert.strictEqual(b.next, 'menu');
});

test('tura bossa: pociski trafiaja, daja nietykalnosc, serce zostaje w pudelku', () => {
  const b = api.createBattle({ ...BOSS, patterns: [{ type: 'rain', rate: 1, speed: 3, dmg: 5 }] }, PLAYER, [], 3);
  toMenu(b);
  tap(b, OK); tap(b, OK);                             // FIGHT, pudlo
  tap(b, OK);                                         // do uniku
  assert.strictEqual(b.phase, 'dodge');
  for (let i = 0; i < 200; i++) api.stepBattle(b, { left: true, up: true }, NONE);
  assert(b.heart.x >= 5 && b.heart.y >= 5);
  assert(b.hp < 40, 'serce w rogu pod deszczem powinno oberwac');
  assert(b.hp % 5 === 0);
});

test('smierc w turze bossa daje wynik lost bez XP', () => {
  const b = api.createBattle({ ...BOSS, patterns: [{ type: 'rain', rate: 1, speed: 4, dmg: 50 }] }, PLAYER, [], 2);
  toMenu(b);
  tap(b, OK); tap(b, OK); tap(b, OK);
  for (let i = 0; i < 400 && b.phase !== 'end'; i++) api.stepBattle(b, NONE, NONE);
  assert.strictEqual(b.phase, 'end');
  const r = api.battleResult(b);
  assert.strictEqual(r.outcome, 'lost');
  assert.strictEqual(r.xp, 0);
});

test('ten sam seed daje ten sam przebieg', () => {
  const run = () => {
    const b = api.createBattle(BOSS, PLAYER, [], 42);
    toMenu(b); tap(b, OK); tap(b, OK); tap(b, OK);
    for (let i = 0; i < 300; i++) api.stepBattle(b, NONE, NONE);
    return JSON.stringify([b.hp, b.bullets.map(k => [Math.round(k.x), Math.round(k.y)])]);
  };
  assert.strictEqual(run(), run());
});

test('wzor wall zostawia przerwe', () => {
  const b = api.createBattle({ ...BOSS, patterns: [{ type: 'wall', rate: 1, speed: 1, dmg: 8 }] }, PLAYER, [], 5);
  toMenu(b); tap(b, OK); tap(b, OK); tap(b, OK);
  api.stepBattle(b, NONE, NONE);
  assert.strictEqual(b.bullets.length, 10);
});

console.log(`\n${passed} testow przeszlo`);
