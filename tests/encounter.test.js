// node tests/encounter.test.js - testy spotkania w sali (drzwi, scenka, walka, wynik)
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({});
const load = f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
vm.runInContext(load('dialogue.js') + '\n' + load('battle.js') + '\n' + load('encounter.js')
  + '\nthis.api = { createEncounter, stepEncounter, encounterDone, encounterResult, FADE_TICKS };', ctx);
const api = ctx.api;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

const ROOM = {
  id: 'pracownia', name: 'Pracownia 111',
  teacher: { name: 'Pan od informatyki', voice: { pitch: 180 }, intro: ['* Dobrze, że jesteś.', '* Szalona Powtórka zalęgła się w sali.'],
    outro: { killed: ['* Spokój wrócił.'], spared: ['* Uspokoiłeś ją. Dziękuję.'], lost: [] } },
  boss: { name: 'Szalona Powtórka', hp: 8, xp: 60, intro: '* Powtórka wraca.', check: '* Powtarza w kółko.', killText: '* Powtórka znika.', spareText: '* Powtórka milknie.',
    flavor: ['* Echo.'], acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'calm', label: 'Uspokój', mercy: 100, text: '* Uspokajasz.' }],
    patterns: [{ type: 'rain', rate: 6, speed: 1.6, dmg: 5 }] },
  reward: { xp: 40, unlock: ['drzwi-biblioteki'] },
};
const PLAYER = { hp: 40, maxHp: 40, level: 1 };
const NONE = {}, OK = { confirm: true };

const step = (e, pressed = NONE, held = NONE) => api.stepEncounter(e, held, pressed);
const until = (e, phase, pressed = NONE, max = 3000) => { for (let i = 0; i < max && e.phase !== phase; i++) step(e, pressed); assert.strictEqual(e.phase, phase); };
// przeklikaj dialog do konca
const finishDialogue = e => { const ph = e.phase; for (let i = 0; i < 4000 && e.phase === ph; i++) step(e, i % 3 === 0 ? OK : { cancel: i % 3 === 1 }); };

test('sekwencja: zaciemnienie, scenka, walka', () => {
  const e = api.createEncounter(ROOM, PLAYER, [], 1);
  assert.strictEqual(e.phase, 'fadeOut');
  for (let i = 0; i < api.FADE_TICKS; i++) step(e);
  assert.strictEqual(e.phase, 'intro');
  assert.strictEqual(e.fade, 1);
  assert.strictEqual(e.dialogue.npc, 'Pan od informatyki');
  finishDialogue(e);
  assert.strictEqual(e.phase, 'battle');
  assert.strictEqual(e.battle.def.name, 'Szalona Powtórka');
});

test('oszczedzenie: outro, rozjasnienie, nagroda z walki i z sali', () => {
  const e = api.createEncounter(ROOM, PLAYER, [], 1);
  until(e, 'intro'); finishDialogue(e);
  step(e, OK);                                        // tekst intro walki -> menu
  step(e, { right: true }); step(e, OK);              // ACT
  step(e, { down: true }); step(e, OK);               // Uspokoj (+100)
  step(e, OK);                                        // do tury bossa
  for (let i = 0; i < 400 && e.battle.phase === 'dodge'; i++) step(e);
  step(e, OK);                                        // -> menu
  step(e, { right: true }); step(e, { right: true }); step(e, { right: true }); step(e, OK);    // MERCY
  step(e, OK);
  assert.strictEqual(e.phase, 'outro');
  assert.strictEqual(e.dialogue.pages[0].text, '* Uspokoiłeś ją. Dziękuję.');
  finishDialogue(e);
  assert.strictEqual(e.phase, 'fadeIn');
  until(e, 'done');
  assert(api.encounterDone(e));
  const r = api.encounterResult(e);
  assert.strictEqual(r.outcome, 'spared');
  assert.strictEqual(r.xp, 60 + 40);
  assert.strictEqual(r.unlock[0], 'drzwi-biblioteki');
});

test('zabicie bossa: nagroda i outro killed', () => {
  const e = api.createEncounter({ ...ROOM, boss: { ...ROOM.boss, hp: 1 } }, PLAYER, [], 1);
  until(e, 'intro'); finishDialogue(e);
  step(e, OK); step(e, OK);                           // menu -> FIGHT (pasek)
  while (e.battle.bar.pos < 0.5) step(e);
  step(e, OK); step(e, OK);                           // stop, killText -> end
  assert.strictEqual(e.phase, 'outro');
  assert.strictEqual(e.dialogue.pages[0].text, '* Spokój wrócił.');
  finishDialogue(e); until(e, 'done');
  assert.strictEqual(api.encounterResult(e).outcome, 'killed');
});

test('porazka: bez nagrody, bez outro, hp zero', () => {
  const room = { ...ROOM, boss: { ...ROOM.boss, patterns: [{ type: 'rain', rate: 1, speed: 4, dmg: 99 }] } };
  const e = api.createEncounter(room, PLAYER, [], 2);
  until(e, 'intro'); finishDialogue(e);
  step(e, OK); step(e, OK); step(e, OK); step(e, OK);   // menu, FIGHT, pudlo, do uniku
  for (let i = 0; i < 600 && e.phase === 'battle'; i++) step(e);
  assert.strictEqual(e.phase, 'fadeIn');
  until(e, 'done');
  const r = api.encounterResult(e);
  assert.strictEqual(r.outcome, 'lost');
  assert.strictEqual(r.xp, 0);
  assert.strictEqual(r.unlock.length, 0);
});

test('zuzyte przedmioty trafiaja do wyniku', () => {
  const items = [{ id: 'food', name: 'Kanapka', heal: 25, count: 2 }];
  const e = api.createEncounter({ ...ROOM, boss: { ...ROOM.boss, hp: 1 } }, { hp: 10, maxHp: 40, level: 1 }, items, 1);
  until(e, 'intro'); finishDialogue(e);
  step(e, OK);                                        // menu
  step(e, { right: true }); step(e, { right: true }); step(e, OK);   // ITEM
  step(e, OK);                                        // uzyj kanapke
  assert.strictEqual(e.battle.hp, 35);
  for (let i = 0; i < 600 && e.battle.phase !== 'menu'; i++) step(e, OK);
  while (e.phase === 'battle' && e.battle.phase !== 'end') {
    if (e.battle.phase === 'menu') { e.battle.enemyHp = 0; step(e, OK); step(e, OK); step(e, OK); } else step(e, OK);
    if (e.battle.phase === 'bar') while (e.battle.bar.pos < 0.5 && e.battle.phase === 'bar') step(e);
  }
  const r = api.encounterResult(e);
  assert.strictEqual(r.used.food, 1);
});

console.log(`\n${passed} testow przeszlo`);
