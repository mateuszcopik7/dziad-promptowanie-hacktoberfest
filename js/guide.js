// prowadzenie gracza (czysta logika): co robic teraz i dokad isc, takze miedzy pietrami.
// Wymaga: game.js, quests.js, content.js, world.js.

const QUEST_ORDER = ['zasilanie', 'ratunek'];

const doorCenter = door => ({
  x: door.cells.reduce((a, c) => a + c[0] + 0.5, 0) / door.cells.length,
  y: door.cells.reduce((a, c) => a + c[1] + 0.5, 0) / door.cells.length,
});

const npcTarget = (g, id, text) => {
  const n = g.npcs.find(x => x.id === id);
  return { floor: n.floor, x: n.x, y: n.y, label: g.npcDefs[id].name, text };
};

function doorTarget(g, zoneId, text) {
  for (let fl = 0; fl < g.world.floors.length; fl++) {
    const door = Object.values(g.world.floors[fl].doors).find(d => d.zone === zoneId);
    if (door) return { floor: fl, ...doorCenter(door), label: g.world.floors[fl].rooms[zoneId].name, text };
  }
  return null;
}

// najblizsza nieukonczona sala z bossem: na biezacym pietrze, a jak nie ma, na najnizszym pietrze z taka sala
function nextBossRoom(g) {
  const open = (f, fl) => Object.values(f.rooms).filter(z => z.boss_ready && !g.cleared.includes(z.id)
    && !(z.id === FINAL_ROOM && !isUnlocked(g.qs, 'drzwi-auli')) && (fl !== undefined)).map(z => ({ z, fl }));
  const here = open(g.world.floors[g.floor], g.floor);
  const all = here.length ? here : g.world.floors.flatMap((f, fl) => open(f, fl));
  if (!all.length) return null;
  const p = g.player;
  const pick = all.map(r => {
    const door = Object.values(g.world.floors[r.fl].doors).find(d => d.zone === r.z.id), c = doorCenter(door);
    return { r, c, d: r.fl === g.floor ? Math.hypot(c.x - p.x, c.y - p.y) : 1000 + r.fl };
  }).sort((a, b) => a.d - b.d)[0];
  return { floor: pick.r.fl, ...pick.c, zone: pick.r.z.id, label: pick.r.z.name, text: 'Wejdź do sali ' + (pick.r.z.number || '') + ' ' + pick.r.z.name + ' i uwolnij nauczyciela' };
}

// docelowy punkt bez uwzglednienia pieter
function rawObjective(g) {
  const st = id => questStatus(g.qs, QUEST_DEFS, id);
  for (const id of QUEST_ORDER) {
    if (st(id) === 'ready') return npcTarget(g, QUEST_DEFS[id].giver, 'Oddaj quest: ' + QUEST_DEFS[id].title);
  }
  for (const id of QUEST_ORDER) {
    if (st(id) !== 'active') continue;
    const d = QUEST_DEFS[id], q = g.qs.quests[id];
    if (d.type === 'switch') {
      const o = g.interactables.find(x => x.id === d.target);
      if (o) return { floor: o.floor, x: o.x, y: o.y, label: o.name, text: 'Awaria prądu: uruchom skrzynkę bezpieczników klawiszem E' };
    } else if (d.type === 'rescue') {
      const room = nextBossRoom(g);
      if (room) return { ...room, text: `${d.title}: ${q.progress}/${d.count} — ${room.text}` };
    } else if (d.type === 'kill') {
      const alive = g.floors.flatMap((f, fl) => f.enemies.filter(e => e.alive).map(e => ({ fl, e })));
      const near = alive.filter(a => a.fl === g.floor).sort((a, b) => Math.hypot(a.e.x - g.player.x, a.e.y - g.player.y) - Math.hypot(b.e.x - g.player.x, b.e.y - g.player.y))[0] || alive[0];
      if (near) return { floor: near.fl, x: near.e.x, y: near.e.y, label: 'bug', text: `${d.title}: zabij bugi (${q.progress}/${d.count}), LPM / spacja strzela` };
    } else if (d.type === 'fetch') {
      for (let fl = 0; fl < g.floors.length; fl++) {
        const it = g.floors[fl].items.find(i => i.item === d.item);
        if (it) return { floor: fl, x: it.x, y: it.y, label: it.name, text: `${d.title}: znajdź ${it.name} (${g.world.floors[fl].name})` };
      }
    } else if (d.type === 'talk') return npcTarget(g, d.to, `${d.title}: porozmawiaj z ${g.npcDefs[d.to].name}`);
  }
  for (const id of QUEST_ORDER) {
    if (st(id) === 'available') return npcTarget(g, QUEST_DEFS[id].giver, 'Nowy quest: porozmawiaj z ' + g.npcDefs[QUEST_DEFS[id].giver].name);
  }
  if (isUnlocked(g.qs, 'drzwi-auli') && !g.cleared.includes(FINAL_ROOM)) return doorTarget(g, FINAL_ROOM, 'Źródło ataku jest w auli — pokonaj Dyrektora Bugów');
  return null;
}

// jesli cel jest na innym pietrze, celem staja sie schody w jego strone
function routeTarget(g, t) {
  if (!t || t.floor === g.floor) return t;
  const dir = Math.sign(t.floor - g.floor), p = g.player;
  const options = g.world.stairs.filter(s => s.floor === g.floor && Math.sign(s.to[0] - s.floor) === dir);
  if (!options.length) return t;
  const s = options.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  return { floor: g.floor, x: s.x + 0.5, y: s.y + 0.5, label: 'Schody ' + (dir > 0 ? 'w górę' : 'w dół'), text: `${t.text} (schody ${dir > 0 ? 'w górę' : 'w dół'})` };
}

// { text, floor, x, y, label, dist, rel } albo null; rel = kat do celu wzgledem kierunku patrzenia (-pi..pi)
function objectiveOf(g) {
  const t = routeTarget(g, rawObjective(g));
  if (!t) return { text: 'Szkoła jest bezpieczna.', floor: g.floor, x: g.player.x, y: g.player.y, label: '', dist: 0, rel: 0 };
  const p = g.player, dx = t.x - p.x, dy = t.y - p.y;
  let rel = Math.atan2(dy, dx) - p.angle;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  return { ...t, dist: Math.hypot(dx, dy), rel };
}
