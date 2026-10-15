// autogra: bot w przegladarce (przycisk "Bot przechodzi gre" w menu). Port logiki bot/bot.py na stan gry w pamieci.
// Czysta logika bez DOM: apIntent(g) daje intent chodzenia, apDialogueKey / apBattleKey / apDodgeHeld sterują scenami.
// Przebieg: bezpieczniki, alarm ucznia, ratowanie nauczycieli, potem aula i Dyrektor Bugow (ACT -> MERCY).
// Wymaga: game.js, guide.js, quests.js, content.js, world.js.

const AP = {
  TALK_RANGE: 1.5, KEEP_DISTANCE: 2.2, FIRE_RANGE: 9, AIM_TOL: 0.06, FACE_TOL: 0.12, MAX_TURN: 0.05, TURN_GAIN: 0.3,
  NPC_CLEARANCE: 0.9, LOW_HP: 25, STUCK_TICKS: 40, FINAL_ZONE: 'f1-aula',
  BOX_W: 240, BOX_H: 120, HEART_R: 5, HEART_SPEED: 2.2, HORIZON: 50, MARGIN: 3, MENU: ['fight', 'act', 'item', 'mercy'],
};
const apStuck = { pos: '', since: 0, force: 0 };            // force: do tego ticku idz po trasie BFS, nie prosto

const apIntentOf = o => ({ move: 0, strafe: 0, turn: 0, fire: false, interact: false, flashlight: false, heal: false, ...o });
const apDist = (p, t) => Math.hypot(t.x - p.x, t.y - p.y);
const apCell = p => [Math.floor(p.x), Math.floor(p.y)];

function apPath(grid, start, goal, blocked) {
  const h = grid.length, w = grid[0].length, key = (x, y) => y * w + x;
  const prev = new Map([[key(start[0], start[1]), null]]), queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    if (x === goal[0] && y === goal[1]) break;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || grid[ny][nx] || prev.has(key(nx, ny))) continue;
      if (blocked.has(key(nx, ny)) && !(nx === goal[0] && ny === goal[1])) continue;
      prev.set(key(nx, ny), [x, y]); queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(goal[0], goal[1]))) return null;
  const path = [];
  for (let cur = goal; cur; cur = prev.get(key(cur[0], cur[1]))) path.push(cur);
  return path.reverse();
}

// komorki zajete przez NPC (obchodzimy je, bo NPC blokuja ruch)
function apNpcCells(g, skip) {
  const w = g.grid[0].length, out = new Set();
  for (const n of g.npcs) {
    if (n.floor !== g.floor || n.id === skip) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const cx = Math.floor(n.x) + dx, cy = Math.floor(n.y) + dy;
      if (Math.hypot(cx + 0.5 - n.x, cy + 0.5 - n.y) < AP.NPC_CLEARANCE) out.add(cy * w + cx);
    }
  }
  return out;
}

// czy prosty odcinek nie wchodzi w komorki zajete przez NPC
function apSegmentFree(g, a, b, blocked) {
  const w = g.grid[0].length, steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    if (blocked.has(Math.floor(y) * w + Math.floor(x))) return false;
  }
  return true;
}

// widocznosc z zapasem na promien gracza: trzy rownolegle promienie (srodek i boki)
function apClearLine(g, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d * 0.3, ny = (b.x - a.x) / d * 0.3;
  return [-1, 0, 1].every(k => hasLOS(g.grid, a.x + nx * k, a.y + ny * k, b.x + nx * k, b.y + ny * k));
}

function apWaypoint(g, target, skip) {
  const p = g.player, w = g.grid[0].length, blocked = apNpcCells(g, skip);
  const [tx, ty] = [Math.floor(target.x), Math.floor(target.y)];
  if (g.ticks >= apStuck.force && apClearLine(g, p, target) && apSegmentFree(g, p, target, blocked)) return [target.x, target.y];
  const path = apPath(g.grid, apCell(p), [tx, ty], blocked);
  return path && path.length > 1 ? [path[1][0] + 0.5, path[1][1] + 0.5] : [target.x, target.y];
}

function apTurn(p, wx, wy) {
  const err = Math.atan2(Math.sin(Math.atan2(wy - p.y, wx - p.x) - p.angle), Math.cos(Math.atan2(wy - p.y, wx - p.x) - p.angle));
  return [err, Math.max(-AP.MAX_TURN, Math.min(AP.MAX_TURN, err * AP.TURN_GAIN))];
}

function apWalkTo(g, target, reach, skip) {
  const p = g.player, [wx, wy] = apWaypoint(g, target, skip), [err, turn] = apTurn(p, wx, wy);
  return apIntentOf({ move: Math.abs(err) < 0.5 && apDist(p, target) > reach ? 1 : 0, turn });
}

function apHunt(g) {
  const p = g.player, enemies = g.floors[g.floor].enemies.filter(e => e.alive);
  if (!enemies.length) return null;
  const target = enemies.reduce((a, b) => (apDist(p, b) < apDist(p, a) ? b : a)), dist = apDist(p, target);
  const seen = hasLOS(g.grid, p.x, p.y, target.x, target.y), [wx, wy] = apWaypoint(g, target), [err, turn] = apTurn(p, wx, wy);
  return apIntentOf({
    move: Math.abs(err) < 0.5 && !(seen && dist < AP.KEEP_DISTANCE) ? 1 : 0, turn,
    fire: seen && Math.abs(err) < AP.AIM_TOL && dist < AP.FIRE_RANGE,
  });
}

function apTalk(g, npc) {
  const p = g.player, dist = apDist(p, npc), close = dist < AP.TALK_RANGE;
  const [wx, wy] = close ? [npc.x, npc.y] : apWaypoint(g, npc, npc.id), [err, turn] = apTurn(p, wx, wy);
  return apIntentOf({ move: Math.abs(err) < 0.5 && !close ? 1 : 0, turn, interact: close && Math.abs(err) < AP.FACE_TOL });
}

function apUse(g, object) {
  const p = g.player, dist = apDist(p, object), close = dist < AP.TALK_RANGE;
  const [wx, wy] = close ? [object.x, object.y] : apWaypoint(g, object), [err, turn] = apTurn(p, wx, wy);
  return apIntentOf({ move: Math.abs(err) < 0.5 && !close ? 1 : 0, turn, interact: close && Math.abs(err) < AP.FACE_TOL });
}

// --- schody i drzwi ----------------------------------------------------------------------------------
const apFreeNeighbors = (grid, [x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
  .filter(([nx, ny]) => ny >= 0 && nx >= 0 && ny < grid.length && nx < grid[0].length && !grid[ny][nx]);

function apStairsStep(g, wantFloor) {
  const next = g.floor + (wantFloor > g.floor ? 1 : -1), p = g.player, blocked = apNpcCells(g);
  let best = null;
  for (const s of g.world.stairs) {
    if (s.floor !== g.floor || s.to[0] !== next) continue;
    const path = apPath(g.grid, apCell(p), [s.x, s.y], blocked);
    if (path && (!best || path.length < best.path.length)) best = { path, s };
  }
  if (!best) return apIntentOf({});
  if (g.stairLock) return apWalkTo(g, { x: best.s.x < 42 ? 9.5 : 72.5, y: best.s.y + 0.5 }, 0.3);   // wyjdz z klatki, wejdz znowu
  return apWalkTo(g, { x: best.s.x + 0.5, y: best.s.y + 0.5 }, 0.1);
}

// id opcji "go:i" w oknie schodow prowadzacej na pietro wantFloor (kolejnosc jak w stairsNear gry)
function apStairsOption(g, wantFloor) {
  const letter = g.player.x < 42 ? 'A' : 'B', next = g.floor + (wantFloor > g.floor ? 1 : -1);
  const options = g.world.stairs.filter(s => s.floor === g.floor && s.id.includes('-' + letter + '-'));
  const i = options.findIndex(s => s.to[0] === next);
  return i >= 0 ? 'go:' + i : 'stay';
}

function apDoorStep(g, zone) {
  const p = g.player, door = Object.values(g.world.floors[g.floor].doors).find(d => d.zone === zone);
  const blocked = apNpcCells(g);
  const options = door.cells.flatMap(c => apFreeNeighbors(g.grid, c).map(n => ({ c, n, path: apPath(g.grid, apCell(p), n, blocked) }))).filter(o => o.path);
  if (!options.length) return apIntentOf({});
  const { c, n } = options.reduce((a, b) => (b.path.length < a.path.length ? b : a));
  const stand = { x: n[0] + 0.5, y: n[1] + 0.5 };
  if (apDist(p, stand) > 0.35) return apWalkTo(g, stand, 0.2);
  const [err, turn] = apTurn(p, c[0] + 0.5, c[1] + 0.5);
  return apIntentOf({ move: Math.abs(err) < 0.15 ? 1 : 0, turn });
}

// --- cel misji ---------------------------------------------------------------------------------------
// co robic teraz: { kind: npc|hunt|item|door|done, floor, ... }. Questy po kolei, na koncu aula.
function apGoal(g) {
  const st = id => questStatus(g.qs, QUEST_DEFS, id), npc = id => ({ kind: 'npc', npc: id, floor: g.npcs.find(n => n.id === id).floor });
  if (st('zasilanie') !== 'done') {
    const o = g.interactables.find(x => x.id === 'glowne-bezpieczniki');
    return { kind: 'interact', floor: o.floor, object: o.id, x: o.x, y: o.y };
  }
  if (st('ratunek') !== 'done') {
    if (st('ratunek') !== 'active') return npc('uczen');
    const room = nextBossRoom(g);
    if (room) return { kind: 'door', zone: room.zone, floor: room.floor };
    return npc('uczen');
  }
  if (g.cleared.includes(AP.FINAL_ZONE)) return { kind: 'done', floor: g.floor };
  return { kind: 'door', zone: AP.FINAL_ZONE, floor: 1 };
}

// intent dla sceny "play"; null gdy nic wiecej do zrobienia
function apIntent(g) {
  const goal = apGoal(g), p = g.player;
  if (goal.kind === 'done') return null;
  let it;
  if (goal.floor !== g.floor) it = apStairsStep(g, goal.floor);
  else if (goal.kind === 'hunt') it = apHunt(g) || apIntentOf({});
  else if (goal.kind === 'npc') { const n = g.npcs.find(x => x.id === goal.npc); it = apTalk(g, n); }
  else if (goal.kind === 'interact') { const o = g.interactables.find(x => x.id === goal.object); it = apUse(g, o); }
  else if (goal.kind === 'item') it = apWalkTo(g, goal, 0.3);
  else it = apDoorStep(g, goal.zone);
  if (it.move) {                                                   // utknelismy (np. za NPC): dorzuc unik w bok
    const pos = p.x.toFixed(1) + ',' + p.y.toFixed(1);
    if (pos !== apStuck.pos) { apStuck.pos = pos; apStuck.since = g.ticks; }
    else if (g.ticks - apStuck.since > AP.STUCK_TICKS) { it.strafe = Math.random() < 0.5 ? -1 : 1; apStuck.since = g.ticks - AP.STUCK_TICKS / 2; apStuck.force = g.ticks + 120; }
  }
  if (p.hp < AP.LOW_HP && g.food > 0) it.heal = true;
  return it;
}

// --- dialogi i walka (klawisze scen: left right up down confirm cancel) ------------------------------
function apDialogueKey(d, prefer = []) {
  if (d.phase === 'type') return 'cancel';
  if (d.phase === 'wait') return 'confirm';
  if (d.phase !== 'choice') return null;
  const ids = d.options.map(o => o.id), want = [...prefer, 'accept', 'turnin', 'deliver', 'close', 'ok'].find(c => ids.includes(c)) || ids[0];
  const idx = ids.indexOf(want);
  return d.cursor === idx ? 'confirm' : d.cursor < idx ? 'down' : 'up';
}

function apMenuKey(cursor, target, n) {
  if (cursor === target) return 'confirm';
  return ((target - cursor + n) % n) <= Math.floor(n / 2) ? 'right' : 'left';
}

function apBattleKey(b) {
  if (b.phase === 'text' || b.phase === 'bar') return 'confirm';
  if (b.phase !== 'menu') return null;
  if (b.menu === 'main') {
    if (b.mercy >= 100) return apMenuKey(b.cursor, AP.MENU.indexOf('mercy'), AP.MENU.length);
    if (b.hp < 0.45 * b.maxHp && b.items.some(i => i.count > 0)) return apMenuKey(b.cursor, AP.MENU.indexOf('item'), AP.MENU.length);
    return apMenuKey(b.cursor, AP.MENU.indexOf('act'), AP.MENU.length);
  }
  if (b.menu === 'act') {
    let best = 0;
    b.def.acts.forEach((a, i) => { if ((a.mercy || 0) > (b.def.acts[best].mercy || 0)) best = i; });
    return apMenuKey(b.cursor, best, b.def.acts.length);
  }
  return 'confirm';
}

// unik: wybiera bezpieczny punkt w pudelku (symulacja pociskow na HORIZON klatek) i zwraca trzymane strzalki
function apSurviveTicks(heart, target, tracks, invuln) {
  let x = heart.x, y = heart.y;
  for (let t = 0; t < tracks.length; t++) {
    x += Math.max(-AP.HEART_SPEED, Math.min(AP.HEART_SPEED, target[0] - x));
    y += Math.max(-AP.HEART_SPEED, Math.min(AP.HEART_SPEED, target[1] - y));
    if (t + 1 <= invuln) continue;
    for (const [bx, by, r] of tracks[t]) if ((bx - x) ** 2 + (by - y) ** 2 < r * r) return t + 1;
  }
  return tracks.length + 1;
}

function apDodgeHeld(b) {
  const h = b.heart, tracks = [];
  for (let t = 1; t <= AP.HORIZON; t++) tracks.push(b.bullets.map(k => [k.x + k.vx * t, k.y + k.vy * t, k.r + AP.HEART_R + AP.MARGIN]));
  let best = [h.x, h.y], bestKey = null;
  for (let tx = 10; tx < AP.BOX_W - 9; tx += 16) {
    for (let ty = 10; ty < AP.BOX_H - 9; ty += 16) {
      const key = [apSurviveTicks(h, [tx, ty], tracks, b.invuln), -Math.max(Math.abs(tx - h.x), Math.abs(ty - h.y)) / AP.HEART_SPEED];
      if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) { best = [tx, ty]; bestKey = key; }
    }
  }
  const dx = best[0] - h.x, dy = best[1] - h.y, d = AP.HEART_SPEED / 2;
  return { right: dx > d, left: dx < -d, down: dy > d, up: dy < -d };
}
