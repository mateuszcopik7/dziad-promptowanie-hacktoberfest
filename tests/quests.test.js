// node tests/quests.test.js - testy systemu questow bez przegladarki
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({});
const src = fs.readFileSync(path.join(__dirname, '../js/quests.js'), 'utf8');
vm.runInContext(src + `\nthis.api = { createQuestState, questStatus, onQuestKill, onQuestItem, dialogFor, chooseDialog,
  isUnlocked, npcMarker, trackedQuests };`, ctx);
const api = ctx.api;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };
// wyniki z vm maja inny prototyp tablic, wiec porownujemy przez JSON
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

const NPCS = {
  woznica: { name: 'Woźny', quests: ['sprzatanie'], idle: ['Pusto dzisiaj.'] },
  bibliotekarka: { name: 'Bibliotekarka', quests: ['ksiazka'], idle: ['Cisza.'] },
  uczen: { name: 'Uczeń z 3B', quests: ['wiadomosc'], idle: ['Hej.'] },
  dyrektor: { name: 'Pani Dyrektor', quests: ['klucz-do-auli'], idle: ['Słucham?'] },
};
const DEFS = {
  sprzatanie: { id: 'sprzatanie', title: 'Sprzątanie w pracowni', type: 'kill', giver: 'woznica', zone: 'pracownia', zoneName: 'Pracownia', count: 3,
    offerLines: ['Bugi w pracowni.'], activeLines: ['Jeszcze nie skończyłeś.'], doneLines: ['Dzięki!'], reward: { xp: 50, unlock: ['drzwi-biblioteki'] } },
  ksiazka: { id: 'ksiazka', title: 'Zaginiona książka', type: 'fetch', giver: 'bibliotekarka', item: 'ksiazka', itemName: 'Książka', requires: ['sprzatanie'],
    offerLines: ['Zgubiłam książkę.'], activeLines: ['Szukaj dalej.'], doneLines: ['Jest!'], reward: { xp: 30 } },
  wiadomosc: { id: 'wiadomosc', title: 'Wiadomość', type: 'talk', giver: 'uczen', to: 'dyrektor',
    offerLines: ['Zanieś to do dyrektorki.'], deliverLines: ['Ach, od ucznia. Dziękuję.'], deliverLabel: 'Przekaż liścik',
    activeLines: ['Poszło?'], doneLines: ['Super.'], reward: { xp: 20 } },
  'klucz-do-auli': { id: 'klucz-do-auli', title: 'Klucz do auli', type: 'kill', giver: 'dyrektor', zone: 'aula', count: 1, requires: ['sprzatanie', 'ksiazka'],
    offerLines: ['Aula czeka.'], activeLines: ['Aula.'], doneLines: ['Brawo.'], reward: { xp: 100, unlock: ['drzwi-auli'] } },
};

const accept = (qs, npc) => api.chooseDialog(qs, DEFS, NPCS, npc, 'accept');
const turnIn = (qs, npc) => api.chooseDialog(qs, DEFS, NPCS, npc, 'turnin');

test('NPC z dostepnym questem oferuje go, bez questu mowi idle', () => {
  const qs = api.createQuestState();
  assert.strictEqual(api.dialogFor(qs, DEFS, NPCS, 'woznica').kind, 'offer');
  assert.strictEqual(api.dialogFor(qs, DEFS, NPCS, 'bibliotekarka').kind, 'idle');   // zablokowany wymaganiem
});

test('kill: liczy tylko po przyjeciu i tylko w wlasciwej sali', () => {
  const qs = api.createQuestState();
  api.onQuestKill(qs, DEFS, 'pracownia');
  accept(qs, 'woznica');
  api.onQuestKill(qs, DEFS, 'biblioteka');
  assert.strictEqual(qs.quests.sprzatanie.progress, 0);
  api.onQuestKill(qs, DEFS, 'pracownia'); api.onQuestKill(qs, DEFS, 'pracownia');
  assert.strictEqual(api.questStatus(qs, DEFS, 'sprzatanie'), 'active');
  const fx = api.onQuestKill(qs, DEFS, 'pracownia');
  eq(fx, [{ type: 'ready', quest: 'sprzatanie' }]);
  assert.strictEqual(api.npcMarker(qs, DEFS, NPCS, 'woznica'), '?');
});

test('oddanie questa daje XP i odblokowuje drzwi, tylko raz', () => {
  const qs = api.createQuestState();
  accept(qs, 'woznica');
  for (let i = 0; i < 3; i++) api.onQuestKill(qs, DEFS, 'pracownia');
  const fx = turnIn(qs, 'woznica');
  assert(fx.some(e => e.type === 'xp' && e.amount === 50));
  assert(fx.some(e => e.type === 'unlock' && e.id === 'drzwi-biblioteki'));
  assert(api.isUnlocked(qs, 'drzwi-biblioteki'));
  eq(turnIn(qs, 'woznica'), []);
  assert.strictEqual(api.questStatus(qs, DEFS, 'sprzatanie'), 'done');
});

test('wymagania: quest odblokowuje sie po ukonczeniu poprzedniego', () => {
  const qs = api.createQuestState();
  assert.strictEqual(api.questStatus(qs, DEFS, 'ksiazka'), 'locked');
  accept(qs, 'woznica');
  for (let i = 0; i < 3; i++) api.onQuestKill(qs, DEFS, 'pracownia');
  turnIn(qs, 'woznica');
  assert.strictEqual(api.questStatus(qs, DEFS, 'ksiazka'), 'available');
  assert.strictEqual(api.npcMarker(qs, DEFS, NPCS, 'bibliotekarka'), '!');
});

test('fetch: przedmiot zebrany przed przyjeciem liczy sie od razu', () => {
  const qs = api.createQuestState();
  qs.quests.sprzatanie = { status: 'done', progress: 3 };
  api.onQuestItem(qs, DEFS, 'ksiazka');
  const fx = accept(qs, 'bibliotekarka');
  assert(fx.some(e => e.type === 'ready'));
  assert.strictEqual(api.dialogFor(qs, DEFS, NPCS, 'bibliotekarka').kind, 'turnin');
});

test('fetch: przedmiot zebrany po przyjeciu konczy cel', () => {
  const qs = api.createQuestState();
  qs.quests.sprzatanie = { status: 'done', progress: 3 };
  accept(qs, 'bibliotekarka');
  assert.strictEqual(api.questStatus(qs, DEFS, 'ksiazka'), 'active');
  api.onQuestItem(qs, DEFS, 'ksiazka');
  assert.strictEqual(api.questStatus(qs, DEFS, 'ksiazka'), 'ready');
});

test('talk: rozmowa z adresatem konczy cel, nagroda u zleceniodawcy', () => {
  const qs = api.createQuestState();
  accept(qs, 'uczen');
  assert.strictEqual(api.npcMarker(qs, DEFS, NPCS, 'dyrektor'), '>');
  const d = api.dialogFor(qs, DEFS, NPCS, 'dyrektor');
  assert.strictEqual(d.kind, 'deliver');
  eq(api.chooseDialog(qs, DEFS, NPCS, 'dyrektor', 'deliver'), [{ type: 'ready', quest: 'wiadomosc' }]);
  assert.strictEqual(api.npcMarker(qs, DEFS, NPCS, 'uczen'), '?');
  assert(turnIn(qs, 'uczen').some(e => e.type === 'xp' && e.amount === 20));
});

test('odrzucenie oferty nic nie zmienia', () => {
  const qs = api.createQuestState();
  eq(api.chooseDialog(qs, DEFS, NPCS, 'woznica', 'decline'), []);
  assert.strictEqual(api.questStatus(qs, DEFS, 'sprzatanie'), 'available');
});

test('nieprawidlowa opcja i podwojne przyjecie sa bezpieczne', () => {
  const qs = api.createQuestState();
  eq(api.chooseDialog(qs, DEFS, NPCS, 'woznica', 'turnin'), []);
  accept(qs, 'woznica');
  eq(accept(qs, 'woznica'), []);
  assert.strictEqual(qs.quests.sprzatanie.progress, 0);
});

test('tracker pokazuje postep i powrot do zleceniodawcy', () => {
  const qs = api.createQuestState();
  accept(qs, 'woznica');
  api.onQuestKill(qs, DEFS, 'pracownia');
  assert.strictEqual(api.trackedQuests(qs, DEFS, NPCS)[0].text, 'Pracownia: 1/3');
  api.onQuestKill(qs, DEFS, 'pracownia'); api.onQuestKill(qs, DEFS, 'pracownia');
  const t = api.trackedQuests(qs, DEFS, NPCS)[0];
  assert(t.ready);
  assert.strictEqual(t.text, 'Wróć do: Woźny');
});

console.log(`\n${passed} testow przeszlo`);
