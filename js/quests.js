// system questow: czysta logika bez DOM i bez renderu.
// Dane (QUEST_DEFS, NPC_DEFS) sa osobno. Silnik nie zmienia gry, tylko zwraca "efekty" do zastosowania:
//   { type: 'xp', amount }, { type: 'unlock', id }, { type: 'accepted'|'progress'|'ready'|'done', quest }
//
// Typy questow:
//   kill  - { zone, count }  zabij count wrogow w sali zone (liczy sie dopiero po przyjeciu)
//   fetch - { item }         przynies przedmiot item (zebrany przed przyjeciem tez sie liczy)
//   talk  - { to }           przekaz wiadomosc do NPC to
// Kazdy quest oddaje sie u zleceniodawcy (giver). Nagroda: reward { xp, unlock: [idDrzwi] }.

function createQuestState() {
  return { quests: {}, unlocked: [], items: [] };      // quests[id] = { status, progress }
}

const questGoal = def => (def.type === 'kill' ? def.count : 1);

// locked | available | active | ready | done
function questStatus(qs, defs, id) {
  const q = qs.quests[id];
  if (q) return q.status;
  const needs = defs[id].requires || [];
  return needs.every(r => questStatus(qs, defs, r) === 'done') ? 'available' : 'locked';
}

function bumpQuests(qs, defs, type, matches) {
  const effects = [];
  for (const def of Object.values(defs)) {
    const q = qs.quests[def.id];
    if (!q || q.status !== 'active' || def.type !== type || !matches(def)) continue;
    q.progress = Math.min(questGoal(def), q.progress + 1);
    if (q.progress >= questGoal(def)) { q.status = 'ready'; effects.push({ type: 'ready', quest: def.id }); }
    else effects.push({ type: 'progress', quest: def.id });
  }
  return effects;
}

const onQuestKill = (qs, defs, zoneId) => bumpQuests(qs, defs, 'kill', d => d.zone === zoneId);

function onQuestItem(qs, defs, itemId) {
  if (!qs.items.includes(itemId)) qs.items.push(itemId);
  return bumpQuests(qs, defs, 'fetch', d => d.item === itemId);
}

const isUnlocked = (qs, doorId) => qs.unlocked.includes(doorId);

// pierwszy quest NPC o danym statusie (kolejnosc z NPC_DEFS)
function npcQuest(qs, defs, npc, status) {
  return (npc.quests || []).find(id => questStatus(qs, defs, id) === status) || null;
}

// co NPC ma do powiedzenia teraz: { npc, kind, quest, lines, options }
function dialogFor(qs, defs, npcs, npcId) {
  const npc = npcs[npcId];
  const close = { id: 'close', label: 'Do widzenia' };
  const deliver = Object.values(defs).find(d => d.type === 'talk' && d.to === npcId && qs.quests[d.id]
    && qs.quests[d.id].status === 'active');
  if (deliver) {
    return { npc: npc.name, kind: 'deliver', quest: deliver.id, lines: deliver.deliverLines,
      options: [{ id: 'deliver', label: deliver.deliverLabel || 'Przekaż wiadomość' }] };
  }
  const ready = npcQuest(qs, defs, npc, 'ready');
  if (ready) {
    return { npc: npc.name, kind: 'turnin', quest: ready, lines: defs[ready].doneLines,
      options: [{ id: 'turnin', label: 'Odbierz nagrodę' }] };
  }
  const offer = npcQuest(qs, defs, npc, 'available');
  if (offer) {
    return { npc: npc.name, kind: 'offer', quest: offer, lines: defs[offer].offerLines,
      options: [{ id: 'accept', label: 'Biorę to' }, { id: 'decline', label: 'Może później' }] };
  }
  const active = npcQuest(qs, defs, npc, 'active');
  if (active) return { npc: npc.name, kind: 'active', quest: active, lines: defs[active].activeLines, options: [close] };
  return { npc: npc.name, kind: 'idle', quest: null, lines: npc.idle, options: [close] };
}

// wybor gracza w dialogu; zwraca efekty do zastosowania w grze
function chooseDialog(qs, defs, npcs, npcId, optionId) {
  const node = dialogFor(qs, defs, npcs, npcId);
  if (!node.options.some(o => o.id === optionId) || !node.quest) return [];
  const def = defs[node.quest];
  if (optionId === 'accept') {
    qs.quests[def.id] = { status: 'active', progress: 0 };
    const effects = [{ type: 'accepted', quest: def.id }];
    if (def.type === 'fetch' && qs.items.includes(def.item)) effects.push(...onQuestItem(qs, defs, def.item));
    return effects;
  }
  if (optionId === 'deliver') return bumpQuests(qs, defs, 'talk', d => d.id === def.id);
  if (optionId === 'turnin') {
    qs.quests[def.id].status = 'done';
    const reward = def.reward || {}, effects = [{ type: 'done', quest: def.id }];
    if (reward.xp) effects.push({ type: 'xp', amount: reward.xp });
    for (const id of reward.unlock || []) {
      if (!qs.unlocked.includes(id)) qs.unlocked.push(id);
      effects.push({ type: 'unlock', id });
    }
    return effects;
  }
  return [];
}

// znacznik nad glowa NPC: '!' nowy quest, '?' do oddania, '>' wiadomosc do przekazania, '' nic
function npcMarker(qs, defs, npcs, npcId) {
  const npc = npcs[npcId];
  const target = Object.values(defs).some(d => d.type === 'talk' && d.to === npcId && qs.quests[d.id]
    && qs.quests[d.id].status === 'active');
  if (target) return '>';
  if (npcQuest(qs, defs, npc, 'ready')) return '?';
  return npcQuest(qs, defs, npc, 'available') ? '!' : '';
}

// lista do HUD: aktywne i gotowe do oddania questy z opisem postepu
function trackedQuests(qs, defs, npcs) {
  return Object.values(defs).filter(d => qs.quests[d.id] && ['active', 'ready'].includes(qs.quests[d.id].status))
    .map(d => {
      const q = qs.quests[d.id];
      const text = q.status === 'ready' ? 'Wróć do: ' + npcs[d.giver].name
        : d.type === 'kill' ? `${d.zoneName || d.zone}: ${q.progress}/${d.count}`
        : d.type === 'fetch' ? 'Znajdź: ' + d.itemName
        : 'Porozmawiaj z: ' + npcs[d.to].name;
      return { id: d.id, title: d.title, text, ready: q.status === 'ready' };
    });
}
