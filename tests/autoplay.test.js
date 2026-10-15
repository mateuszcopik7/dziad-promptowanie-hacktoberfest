// node tests/autoplay.test.js - autogra przechodzi cala gre bez przegladarki (ta sama logika co przycisk "Bot przechodzi gre")
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({ Math });
const load = f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
const src = ['world-data.js', 'world.js', 'content.js', 'quests.js', 'dialogue.js', 'battle.js', 'encounter.js', 'game.js', 'guide.js', 'autoplay.js'].map(load).join('\n');
vm.runInContext(src + `\nthis.api = { createGame, step, useStairs, useInteractable, respawn, doorStatus, applyEffects, gainXp, roomEncounter, chooseDialog, dialogFor, noteTalk, onQuestRoom,
  QUEST_DEFS, createDialogue, stepDialogue, dialogueDone, createEncounter, stepEncounter, encounterDone, encounterResult, FINAL_ROOM,
  apGoal, apIntent, apDialogueKey, apBattleKey, apDodgeHeld, apStairsOption };`, ctx);
const api = ctx.api;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

// minimalna petla gry: to samo co main.js, bez DOM i bez dzwieku
function playThrough(maxTicks) {
  const g = api.createGame(), log = { talks: 0, stairs: 0, encounters: 0, won: false };
  for (let t = 0; t < maxTicks && !log.won; t++) {
    const it = api.apIntent(g);
    if (!it) break;
    api.step(g, it);
    if (g.state === 'dead') { api.respawn(g); continue; }
    const req = g.request;
    if (!req) continue;
    if (req.type === 'npc') {
      const def = g.npcDefs[req.id], node = api.dialogFor(g.qs, api.QUEST_DEFS, g.npcDefs, req.id);
      api.noteTalk(g.qs, req.id);
      const d = api.createDialogue({ ...node });
      runDialogue(d, []);
      api.applyEffects(g, api.chooseDialog(g.qs, api.QUEST_DEFS, g.npcDefs, req.id, d.result));
      log.talks++;
    } else if (req.type === 'interact') {
      if (api.useInteractable(g, req.id) === 'escaped') log.won = true;
    } else if (req.type === 'stairs') {
      const want = api.apGoal(g).floor, d = api.createDialogue({ npc: 'Klatka schodowa', lines: ['Dokad?'],
        options: [...req.options.map((s, i) => ({ id: 'go:' + i, label: String(s.to[0]) })), { id: 'stay', label: 'Zostan' }] });
      runDialogue(d, [api.apStairsOption(g, want)]);
      if (d.result.startsWith('go:')) { api.useStairs(g, req.options[+d.result.slice(3)]); log.stairs++; }
    } else if (req.type === 'door') {
      const st = api.doorStatus(g, req.door);
      if (st.kind !== 'encounter') continue;
      const room = api.roomEncounter(st.zone, g.floor), p = g.player;
      const e = api.createEncounter(room, { hp: p.hp, maxHp: p.maxHp, level: p.level }, [{ id: 'food', name: 'Kanapka', heal: 25, count: g.food }], 7);
      runEncounter(e);
      const r = api.encounterResult(e);
      log.encounters++;
      if (r.outcome === 'lost') { api.respawn(g); continue; }
      p.hp = Math.max(1, r.hp); g.cleared.push(room.id);
      if (!room.final && !room.secret) api.applyEffects(g, api.onQuestRoom(g.qs, api.QUEST_DEFS, room.id));
      api.gainXp(g, r.xp);
      if (room.final && !g.qs.items.includes('klucz-wyjscie')) g.qs.items.push('klucz-wyjscie');
    }
  }
  log.g = g;
  return log;
}

function runDialogue(d, prefer) {
  for (let i = 0; i < 5000 && d.phase !== 'done'; i++) {
    const key = i % 3 === 0 ? api.apDialogueKey(d, prefer) : null;
    api.stepDialogue(d, key ? { [key]: true } : {});
  }
  assert.strictEqual(d.phase, 'done');
}

function runEncounter(e) {
  for (let i = 0; i < 200000 && !api.encounterDone(e); i++) {
    const b = e.phase === 'battle' ? e.battle : null;
    const held = b && b.phase === 'dodge' ? api.apDodgeHeld(b) : {};
    const key = !(b && b.phase === 'dodge') && i % 3 === 0
      ? (b ? api.apBattleKey(b) : (e.dialogue && (e.phase === 'intro' || e.phase === 'outro') ? api.apDialogueKey(e.dialogue) : null)) : null;
    api.stepEncounter(e, held, key ? { [key]: true } : {});
  }
  assert(api.encounterDone(e), 'walka sie skonczyla');
}

test('autogra przechodzi cala fabule: prad, ratunek, aula, klucz i wyjscie', () => {
  const log = playThrough(120000);
  assert(log.won, 'finalowy boss pokonany lub oszczedzony, ticki: ' + log.g.ticks);
  ['zasilanie', 'ratunek'].forEach(q => assert.strictEqual(log.g.qs.quests[q].status, 'done', q));
  assert(log.stairs >= 2 && log.talks >= 2, JSON.stringify({ stairs: log.stairs, talks: log.talks }));
});

test('apGoal: bezpieczniki, uczen, sale i aula', () => {
  const g = api.createGame();
  assert.strictEqual(api.apGoal(g).kind, 'interact');
  api.useInteractable(g, 'glowne-bezpieczniki');
  assert.strictEqual(api.apGoal(g).npc, 'uczen');
  g.qs.quests.ratunek = { status: 'active', progress: 0 };
  assert.strictEqual(api.apGoal(g).kind, 'door');
  g.qs.quests.ratunek = { status: 'done', progress: 3 };
  g.qs.unlocked.push('drzwi-auli');
  assert.strictEqual(api.apGoal(g).kind, 'door');
  g.cleared.push('f1-aula');
  g.qs.items.push('klucz-wyjscie');
  assert.strictEqual(api.apGoal(g).object, 'wyjscie-szkoly');
  g.state = 'escaped';
  assert.strictEqual(api.apGoal(g).kind, 'done');
});

console.log(passed + ' testow przeszlo');
