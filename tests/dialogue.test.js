// node tests/dialogue.test.js - testy dialogow w stylu Undertale bez przegladarki
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({});
const src = fs.readFileSync(path.join(__dirname, '../js/dialogue.js'), 'utf8');
vm.runInContext(src + '\nthis.api = { parseMarkup, createDialogue, stepDialogue, visibleChars, allChars, dialogueDone, pageFace };', ctx);
const api = ctx.api;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

const NONE = {}, OK = { confirm: true }, SKIP = { cancel: true };
const text = d => api.visibleChars(d).map(t => t.ch).join('');
const typeAll = d => { for (let i = 0; i < 2000 && d.phase === 'type'; i++) api.stepDialogue(d, NONE); };
const node = (lines, options = [{ id: 'close', label: 'Do widzenia' }]) => ({ npc: 'Woźny', lines, options, voice: { pitch: 200 } });

test('znaczniki: kolor, drzenie, pauza i wolne pisanie', () => {
  const t = api.parseMarkup('Hej {c:red}ty{/c} {shake}!{/shake}{p:20}ok{s:0.2}..{/s}');
  const chars = t.filter(x => !x.pause);
  assert.strictEqual(chars.map(x => x.ch).join(''), 'Hej ty !ok..');
  assert.strictEqual(chars[4].color, 'red');
  assert.strictEqual(chars[3].color, null);
  assert.strictEqual(chars[7].shake, true);
  assert.strictEqual(t.find(x => x.pause).pause, 20);
  assert.strictEqual(chars[chars.length - 1].speed, 0.2);
});

test('tekst pojawia sie stopniowo i zatrzymuje na koncu strony', () => {
  const d = api.createDialogue(node(['Abc def']));
  api.stepDialogue(d, NONE); api.stepDialogue(d, NONE);
  assert(text(d).length > 0 && text(d).length < 7);
  typeAll(d);
  assert.strictEqual(text(d), 'Abc def');
  assert.strictEqual(d.phase, 'wait');
});

test('cancel pomija pisanie strony, confirm w trakcie pisania nic nie robi', () => {
  const d = api.createDialogue(node(['Dluga kwestia do przeczytania.']));
  api.stepDialogue(d, OK);
  assert.strictEqual(d.phase, 'type');
  api.stepDialogue(d, SKIP);
  assert.strictEqual(d.phase, 'wait');
  assert.strictEqual(text(d), 'Dluga kwestia do przeczytania.');
});

test('blipy: dzwiek tylko dla liter, nie dla spacji, z wysokoscia glosu NPC', () => {
  const d = api.createDialogue(node(['a b c d e f']));
  const blips = [];
  for (let i = 0; i < 200 && d.phase === 'type'; i++) { api.stepDialogue(d, NONE); blips.push(...d.events); }
  assert(blips.length > 0 && blips.length <= 6);
  assert(blips.every(e => e.type === 'blip' && e.pitch === 200));
});

test('pauzy znacznikiem i interpunkcja spowalniaja pisanie', () => {
  const ticks = s => { const d = api.createDialogue(node([s])); let n = 0; while (d.phase === 'type') { api.stepDialogue(d, NONE); n++; } return n; };
  assert(ticks('ab{p:40}cd') > ticks('abcd') + 35);
  assert(ticks('ab.cd') > ticks('abXcd'));
});

test('wiele stron: confirm przechodzi do nastepnej dopiero po dopisaniu', () => {
  const d = api.createDialogue(node(['Raz.', 'Dwa.', 'Trzy.']));
  typeAll(d); api.stepDialogue(d, OK);
  assert.strictEqual(d.page, 1);
  assert.strictEqual(d.phase, 'type');
  typeAll(d); api.stepDialogue(d, OK);
  typeAll(d); api.stepDialogue(d, OK);
  assert.strictEqual(api.dialogueDone(d), true);
  assert.strictEqual(d.result, 'close');
});

test('jedna opcja konczy dialog bez menu wyboru', () => {
  const d = api.createDialogue(node(['Cos.']));
  typeAll(d); api.stepDialogue(d, OK);
  assert(api.dialogueDone(d));
});

test('wybor: kursor krazy, confirm zwraca id opcji', () => {
  const opts = [{ id: 'accept', label: 'Biorę to' }, { id: 'decline', label: 'Może później' }];
  const d = api.createDialogue(node(['Pomozesz?'], opts));
  typeAll(d); api.stepDialogue(d, OK);
  assert.strictEqual(d.phase, 'choice');
  api.stepDialogue(d, { right: true });
  assert.strictEqual(d.cursor, 1);
  assert(d.events.some(e => e.type === 'move'));
  api.stepDialogue(d, { right: true });
  assert.strictEqual(d.cursor, 0);
  api.stepDialogue(d, { left: true });
  api.stepDialogue(d, OK);
  assert.strictEqual(d.result, 'decline');
  assert(api.dialogueDone(d));
});

test('twarz NPC zmienia sie z linia', () => {
  const d = api.createDialogue(node([{ text: 'Hm.', face: 'smile' }, { text: 'Grr!', face: 'angry' }]));
  assert.strictEqual(api.pageFace(d), 'smile');
  typeAll(d); api.stepDialogue(d, OK);
  assert.strictEqual(api.pageFace(d), 'angry');
});

test('puste linie nie wieszaja dialogu', () => {
  const d = api.createDialogue(node([]));
  typeAll(d);
  assert.strictEqual(text(d), '...');
});

console.log(`\n${passed} testow przeszlo`);
