// spotkanie w sali (logika bez DOM): drzwi -> zaciemnienie -> scenka z nauczycielem -> walka turowa -> wynik -> rozjasnienie.
// Wnetrza sal nie sa modelowane w swiecie gry: wejscie w drzwi uruchamia to spotkanie.
// Wymaga: dialogue.js, battle.js.
//
// room: { id, name, teacher: { name, voice, intro: [linie], outro: { killed, spared, lost } }, boss: <def walki>, reward: { xp, unlock } }
// fazy: fadeOut -> intro -> battle -> outro -> fadeIn -> done

const FADE_TICKS = 40;

function createEncounter(room, player, items, seed = 1) {
  return { room, player, items, seed, phase: 'fadeOut', fade: 0, dialogue: null, battle: null, result: null, events: [] };
}

function teacherDialogue(room, lines) {
  return createDialogue({ npc: room.teacher.name, lines, options: [{ id: 'ok', label: 'Dalej' }], voice: room.teacher.voice });
}

function startOutro(e) {
  const lines = (e.room.teacher.outro || {})[e.result.outcome];
  if (!lines || !lines.length) { e.phase = 'fadeIn'; return; }
  e.dialogue = teacherDialogue(e.room, lines);
  e.phase = 'outro';
}

// held/pressed jak w battle.js i dialogue.js
function stepEncounter(e, held, pressed) {
  e.events = [];
  if (e.phase === 'fadeOut') {
    e.fade = Math.min(1, e.fade + 1 / FADE_TICKS);
    if (e.fade >= 1) { e.dialogue = teacherDialogue(e.room, e.room.teacher.intro); e.phase = 'intro'; }
  } else if (e.phase === 'intro' || e.phase === 'outro') {
    stepDialogue(e.dialogue, pressed);
    e.events.push(...e.dialogue.events);
    if (!dialogueDone(e.dialogue)) return;
    if (e.phase === 'intro') { e.battle = createBattle(e.room.boss, e.player, e.items, e.seed); e.phase = 'battle'; }
    else e.phase = 'fadeIn';
  } else if (e.phase === 'battle') {
    stepBattle(e.battle, held, pressed);
    e.events.push(...e.battle.events);
    e.battle.events = [];
    if (e.battle.phase !== 'end') return;
    e.result = battleResult(e.battle);
    startOutro(e);
  } else if (e.phase === 'fadeIn') {
    e.fade = Math.max(0, e.fade - 1 / FADE_TICKS);
    if (e.fade <= 0) e.phase = 'done';
  }
}

const encounterDone = e => e.phase === 'done';

// wynik do zastosowania w grze: HP po walce, zuzyte przedmioty, nagroda tylko za wygrana (zabicie lub oszczedzenie)
function encounterResult(e) {
  const r = e.result || { outcome: 'lost', xp: 0, hp: 0 }, won = r.outcome === 'killed' || r.outcome === 'spared';
  const used = {};
  (e.battle ? e.battle.items : []).forEach((it, i) => { used[it.id] = e.items[i].count - it.count; });
  return { room: e.room.id, outcome: r.outcome, xp: r.xp + (won && e.room.reward ? e.room.reward.xp || 0 : 0),
    unlock: won && e.room.reward ? e.room.reward.unlock || [] : [], hp: r.hp, used };
}
