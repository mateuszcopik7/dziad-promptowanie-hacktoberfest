// logika gry (bez DOM, bez renderu i dzwieku): wielopietrowy swiat ZSTI, gracz, NPC, questy, strzelanie do mobkow z questa.
// Wejscie to "intent" { move, strafe, turn, fire, interact, flashlight, heal } - tak samo steruje klawiatura i bot.
// Gra nie rozstrzyga rozmow ani walk w salach: zglasza je w g.request, a main.js uruchamia dialog lub spotkanie.
// Wymaga: world.js, content.js, quests.js.

const ENEMY_TYPES = {
  bug: { hp: 3, speed: 0.02, dmg: 8, r: 0.35, scale: 0.7, xp: 10 },
  glitch: { hp: 2, speed: 0.034, dmg: 5, r: 0.3, scale: 0.6, xp: 15 },
};

const PLAYER_SPEED = 0.07;
const PLAYER_RADIUS = 0.22;
const NPC_RADIUS = 0.55;
const FIRE_COOLDOWN = 14;
const WAKE_DISTANCE = 10;
const TALK_DISTANCE = 1.9;
const KILL_AMMO = 3;                // zwrot amunicji za zabitego buga
const RESCUE_AMMO = 5;              // awaryjna amunicja przy zerze, gdy quest ze strzelaniem trwa
const FOOD_HEAL = 25;
const FOOD_MAX = 5;

const xpNeeded = level => 40 + 25 * (level - 1);
const wallAt = (grid, x, y) => (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) ? 1 : grid[y][x];
const floorOf = g => g.world.floors[g.floor];
const stateOf = g => g.floors[g.floor];

// --- tworzenie gry -------------------------------------------------------------------------------
// NPC z questami stoja na swoich slotach, reszta slotow to gadajace tlo (FLAVOR_NPCS po kolei)
function buildNpcs(world) {
  const defs = {}, list = [], used = new Set();
  for (const [id, d] of Object.entries(NPC_DEFS)) {
    defs[id] = { ...d, look: NPC_LOOKS[id] };
    used.add(d.slot);
  }
  let flavor = 0;
  world.floors.forEach((f, fi) => f.npcSlots.forEach(s => {
    let id = Object.keys(NPC_DEFS).find(k => NPC_DEFS[k].slot === s.id);
    if (!id) {
      if (flavor >= FLAVOR_NPCS.length) return;
      id = 'flav-' + flavor;
      defs[id] = { ...FLAVOR_NPCS[flavor], look: FLAVOR_LOOKS[flavor], quests: [] };
      flavor++;
    }
    list.push({ id, floor: fi, x: s.x + 0.5, y: s.y + 0.5 });
  }));
  return { defs, list };
}

function createGame(world = WORLD) {
  const e = world.entrance, npcs = buildNpcs(world);
  npcs.defs[GUIDE_NPC.id] = GUIDE_NPC.def;
  npcs.list.push({ id: GUIDE_NPC.id, floor: GUIDE_NPC.floor, x: GUIDE_NPC.x, y: GUIDE_NPC.y });
  const qs = createQuestState();
  qs.quests.zasilanie = { status: 'active', progress: 0 };
  const g = {
    world, floor: e.floor, grid: null,
    player: { x: e.x + 0.5, y: e.y + 0.5, angle: -Math.PI / 2, hp: 60, maxHp: 60, level: 1, xp: 0, weapon: false, ammo: 0, flashlight: false },
    spawn: { floor: e.floor, x: e.x + 0.5, y: e.y + 0.5, angle: -Math.PI / 2 },
    floors: world.floors.map(() => ({ enemies: [], pickups: [], items: [] })),
    npcs: npcs.list, npcDefs: npcs.defs, qs, food: 2, kills: 0, cleared: [], power: false,
    interactables: STORY_INTERACTABLES.map(o => ({ ...o, used: false })),
    state: 'play', ticks: 0, cooldown: 0, flash: 0, hurt: 0, msg: '', msgT: 0, events: [], request: null,
    stairLock: false, doorLock: 0, prompt: '', moving: false, walk: 0,
  };
  FOOD_PLACE.forEach(([f, x, y]) => g.floors[f].pickups.push({ kind: 'food', x, y }));
  ITEM_PLACE.forEach(i => g.floors[i.floor].items.push({ ...i }));
  setFloor(g, e.floor);
  return g;
}

function setFloor(g, idx) {
  g.floor = idx;
  g.grid = g.world.floors[idx].grid;
}

function notify(g, text, ticks = 150) {
  g.msg = text; g.msgT = ticks;
}

// --- geometria -----------------------------------------------------------------------------------
// odleglosc do sciany wzdluz znormalizowanego kierunku (DDA)
function castDist(grid, x, y, dx, dy) {
  let mx = Math.floor(x), my = Math.floor(y);
  const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
  const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
  let sdx = dx < 0 ? (x - mx) * ddx : (mx + 1 - x) * ddx;
  let sdy = dy < 0 ? (y - my) * ddy : (my + 1 - y) * ddy;
  let side = 0;
  while (!wallAt(grid, mx, my)) {
    if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; } else { sdy += ddy; my += stepY; side = 1; }
  }
  return side === 0 ? sdx - ddx : sdy - ddy;
}

function hasLOS(grid, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  return d < 1e-6 || castDist(grid, x1, y1, (x2 - x1) / d, (y2 - y1) / d) >= d;
}

const isFree = (grid, x, y) => !wallAt(grid, Math.floor(x - PLAYER_RADIUS), Math.floor(y - PLAYER_RADIUS))
  && !wallAt(grid, Math.floor(x + PLAYER_RADIUS), Math.floor(y - PLAYER_RADIUS))
  && !wallAt(grid, Math.floor(x - PLAYER_RADIUS), Math.floor(y + PLAYER_RADIUS))
  && !wallAt(grid, Math.floor(x + PLAYER_RADIUS), Math.floor(y + PLAYER_RADIUS));

const npcsHere = g => g.npcs.filter(n => n.floor === g.floor);
const blockedByNpc = (g, x, y) => npcsHere(g).some(n => Math.hypot(n.x - x, n.y - y) < NPC_RADIUS);

function tryMove(g, o, dx, dy, blockNpc) {
  const free = (x, y) => isFree(g.grid, x, y) && !(blockNpc && blockedByNpc(g, x, y));
  if (free(o.x + dx, o.y)) o.x += dx;
  if (free(o.x, o.y + dy)) o.y += dy;
}

// --- postep: XP, questy, efekty ---------------------------------------------------------------------
function gainXp(g, amount) {
  const p = g.player;
  p.xp += amount;
  while (p.xp >= xpNeeded(p.level)) {
    p.xp -= xpNeeded(p.level);
    p.level++; p.maxHp += 10; p.hp = Math.min(p.maxHp, p.hp + 30);
    notify(g, 'POZIOM ' + p.level, 120);
    g.events.push('levelup');
  }
}

function spawnEnemies(g, spec) {
  const zone = g.world.floors[spec.floor].zones.find(z => z.id === spec.zone);
  const grid = g.world.floors[spec.floor].grid, list = g.floors[spec.floor].enemies;
  for (let i = 0; i < spec.count; i++) {
    const x = zone.x + 3 + ((i + 0.5) / spec.count) * (zone.w - 6), y = zone.y + (i % 2 ? zone.h - 2.5 : 2.5);
    if (!wallAt(grid, Math.floor(x), Math.floor(y))) {
      list.push({ type: spec.type, x, y, hp: ENEMY_TYPES[spec.type].hp, alive: true, awake: false, hit: 0, atk: 0, zone: spec.zone });
    }
  }
}

// stosuje efekty z silnika questow (quests.js) do stanu gry
function applyEffects(g, effects) {
  const p = g.player;
  for (const e of effects) {
    const def = QUEST_DEFS[e.quest];
    if (e.type === 'accepted' && def.onAccept) {
      const a = def.onAccept;
      if (a.weapon) { p.weapon = true; p.ammo = a.ammo || 30; notify(g, 'DOSTAJESZ BROŃ'); g.events.push('pickup'); }
      if (a.spawn) spawnEnemies(g, a.spawn);
    } else if (e.type === 'ready') {
      notify(g, 'Cel wykonany: ' + def.title); g.events.push('pickup');
    } else if (e.type === 'done') {
      if (def.onDone && def.onDone.weapon === false) { p.weapon = false; p.ammo = 0; }
      notify(g, 'Quest ukończony: ' + def.title);
    } else if (e.type === 'xp') gainXp(g, e.amount);
    else if (e.type === 'unlock') notify(g, 'Odblokowano: ' + e.id);
  }
}

// --- strzelanie i wrogowie ---------------------------------------------------------------------------
function shoot(g) {
  const p = g.player, ca = Math.cos(p.angle), sa = Math.sin(p.angle);
  p.ammo--; g.cooldown = FIRE_COOLDOWN; g.flash = 4;
  g.events.push('shoot');
  const wallD = castDist(g.grid, p.x, p.y, ca, sa);
  let best = null, bestD = Infinity;
  for (const e of stateOf(g).enemies) {
    if (!e.alive) continue;
    const rx = e.x - p.x, ry = e.y - p.y;
    const d = rx * ca + ry * sa, perp = Math.abs(rx * sa - ry * ca);
    if (d > 0.2 && perp < ENEMY_TYPES[e.type].r && d < wallD && d < bestD) { best = e; bestD = d; }
  }
  if (!best) return;
  best.hp -= 1 + Math.floor((p.level - 1) / 3); best.hit = 6; best.awake = true;
  if (best.hp > 0) { g.events.push('hit'); return; }
  best.alive = false; g.kills++; p.ammo += KILL_AMMO;
  g.events.push('kill');
  gainXp(g, ENEMY_TYPES[best.type].xp);
  applyEffects(g, onQuestKill(g.qs, QUEST_DEFS, best.zone));
}

function updateEnemies(g) {
  const p = g.player, list = stateOf(g).enemies;
  for (const e of list) {
    if (!e.alive) continue;
    const T = ENEMY_TYPES[e.type];
    if (e.hit > 0) e.hit--;
    if (e.atk > 0) e.atk--;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (!e.awake && d < WAKE_DISTANCE && hasLOS(g.grid, e.x, e.y, p.x, p.y)) e.awake = true;
    if (!e.awake) continue;
    if (d > T.r + 0.45) tryMove(g, e, dx / d * T.speed, dy / d * T.speed, false);
    for (const o of list) {                             // wrogowie sie nie nakladaja
      if (o === e || !o.alive) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 0.6) tryMove(g, e, ox / od * 0.01, oy / od * 0.01, false);
    }
    if (d < T.r + 0.65 && e.atk === 0) { p.hp -= T.dmg; e.atk = 50; g.hurt = 10; g.events.push('hurt'); }
  }
}

function updatePickups(g) {
  const p = g.player, fs = stateOf(g);
  fs.pickups = fs.pickups.filter(k => {
    if (Math.hypot(k.x - p.x, k.y - p.y) > 0.6) return true;
    if (g.food >= FOOD_MAX) return true;
    g.food++; notify(g, 'Kanapka (H: zjedz)'); g.events.push('pickup');
    return false;
  });
  fs.items = fs.items.filter(it => {
    if (Math.hypot(it.x - p.x, it.y - p.y) > 0.7) return true;
    notify(g, 'Znaleziono: ' + it.name); g.events.push('pickup');
    applyEffects(g, onQuestItem(g.qs, QUEST_DEFS, it.item));
    return false;
  });
}

// --- interakcje: drzwi, schody, NPC --------------------------------------------------------------------
// co robi uderzenie w drzwi: spotkanie w sali albo komunikat
function doorStatus(g, door) {
  const zone = floorOf(g).rooms[door.zone];
  if (g.cleared.includes(zone.id)) return { kind: 'msg', text: zone.name + ': pusto. Tu już zrobiłeś porządek.' };
  if (zone.id === SECRET_ROOM) {
    if (!isUnlocked(g.qs, 'sekret-portiernia')) return { kind: 'msg', text: '001: Portiernia. Zamek oczekuje Protokołu 404.' };
    return { kind: 'encounter', zone };
  }
  if (zone.id === FINAL_ROOM && !isUnlocked(g.qs, 'drzwi-auli')) return { kind: 'msg', text: 'Aula zamknięta. Najpierw uwolnij nauczycieli i wróć do ucznia.' };
  if (!zone.boss_ready) return { kind: 'msg', text: (zone.number ? zone.number + ': ' : '') + zone.name + '. Zamknięte.' };
  if (zone.id !== FINAL_ROOM && !['active', 'ready', 'done'].includes(questStatus(g.qs, QUEST_DEFS, 'ratunek'))) {
    return { kind: 'msg', text: 'Drzwi są zablokowane. Najpierw dowiedz się od ucznia, co się stało.' };
  }
  return { kind: 'encounter', zone };
}

// drzwi sali przed graczem (do 1.8 komorki wzdluz kierunku patrzenia)
function doorAhead(g) {
  const p = g.player, F = floorOf(g);
  for (let d = 0.6; d <= 1.8; d += 0.3) {
    const door = F.doors[Math.floor(p.x + Math.cos(p.angle) * d) + ',' + Math.floor(p.y + Math.sin(p.angle) * d)];
    if (door) return door;
  }
  return null;
}

// opis drzwi sali: napis nad drzwiami, kolor i podpowiedz
function doorLabel(g, door) {
  const zone = floorOf(g).rooms[door.zone], st = doorStatus(g, door), name = (zone.number ? zone.number + ' ' : '') + zone.name;
  if (g.cleared.includes(zone.id)) return { text: name, sub: 'ukończona', color: '#4ad66d', prompt: name + ': pusto, już zrobione' };
  if (st.kind === 'msg') return { text: name, sub: 'zamknięte', color: '#9a9aa6', prompt: st.text };
  return { text: name, sub: 'WALKA', color: '#ff9a1f', prompt: 'Idź naprzód: wejdziesz do sali ' + name + ' (walka z bossem)' };
}

const nearestNpc = g => {
  const p = g.player;
  let best = null, bestD = TALK_DISTANCE;
  for (const n of npcsHere(g)) {
    const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - p.angle;
    da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    if (d < bestD && da < 0.9) { best = n; bestD = d; }
  }
  return best;
};

const nearestInteractable = g => {
  const p = g.player;
  let best = null, bestD = TALK_DISTANCE;
  for (const o of g.interactables.filter(x => x.floor === g.floor)) {
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - p.angle;
    da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    if (d < bestD && da < 0.9) { best = o; bestD = d; }
  }
  return best;
};

function useInteractable(g, id) {
  const o = g.interactables.find(x => x.id === id);
  if (!o) return;
  if (id === 'glowne-bezpieczniki' && !o.used) {
    const fx = onQuestSwitch(g.qs, QUEST_DEFS, id);
    if (!fx.length) return notify(g, 'Skrzynka nie reaguje. Najpierw porozmawiaj z: Pani Pietrzyk-Piotrwska (mentor).');
    o.used = true; g.power = true;
    applyEffects(g, fx);
    notify(g, 'ZASILANIE PRZYWRÓCONE — znajdź ucznia na parterze', 260);
    g.events.push('levelup');
    return 'power';
  }
  if (id === 'wyjscie-szkoly') {
    if (!g.qs.items.includes('klucz-wyjscie')) {
      notify(g, 'DRZWI ZABLOKOWANE — klucz ma źródło ataku w auli', 220);
      return 'locked';
    }
    o.used = true;
    g.state = 'escaped';
    return 'escaped';
  }
  notify(g, 'Zasilanie już działa.');
  return 'used';
}

function useStairs(g, s) {
  setFloor(g, s.to[0]);
  const p = g.player;
  p.x = s.to[1] + 0.5; p.y = s.to[2] + 0.5;
  g.spawn = { floor: g.floor, x: p.x, y: p.y, angle: p.angle };
  g.stairLock = true;
  notify(g, g.world.floors[g.floor].name.toUpperCase());
  g.events.push('stairs');
}

function respawn(g) {
  setFloor(g, g.spawn.floor);
  const p = g.player;
  p.x = g.spawn.x; p.y = g.spawn.y; p.angle = g.spawn.angle;
  p.hp = Math.max(1, Math.ceil(p.maxHp / 2));
  g.state = 'play'; g.stairLock = true; g.request = null;
  for (const f of g.floors) for (const e of f.enemies) e.awake = false;
}

// jeden krok symulacji (60 na sekunde)
function step(g, it) {
  if (g.state !== 'play') return;
  const p = g.player, F = floorOf(g);
  g.ticks++; g.request = null;
  p.angle += it.turn;
  const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
  const mx = ca * it.move - sa * it.strafe, my = sa * it.move + ca * it.strafe, len = Math.hypot(mx, my);
  g.moving = len > 0;
  if (g.moving) g.walk++;
  if (len > 0) {
    tryMove(g, p, mx / len * PLAYER_SPEED, my / len * PLAYER_SPEED, true);
    if (g.doorLock === 0) {                             // uderzenie w drzwi uruchamia sale
      const px = p.x + mx / len * (PLAYER_RADIUS + 0.3), py = p.y + my / len * (PLAYER_RADIUS + 0.3);
      const door = F.doors[Math.floor(px) + ',' + Math.floor(py)];
      if (door) { g.request = { type: 'door', door }; g.doorLock = 90; }
    }
  }
  if (g.doorLock > 0) g.doorLock--;

  const onStairs = F.stairCells[Math.floor(p.y)][Math.floor(p.x)];
  if (!onStairs) g.stairLock = false;
  else if (!g.stairLock && !g.request) { g.request = { type: 'stairs', options: stairsNear(g.world, g.floor, p.x) }; g.stairLock = true; }

  const npc = nearestNpc(g), object = nearestInteractable(g);
  const doorFront = doorAhead(g);
  g.prompt = npc ? 'E: porozmawiaj z ' + g.npcDefs[npc.id].name
    : object ? 'E: użyj — ' + object.name
    : doorFront ? doorLabel(g, doorFront).prompt : onStairs ? 'Klatka schodowa: wybierz piętro w oknie' : '';
  if (it.interact && npc && !g.request) g.request = { type: 'npc', id: npc.id };
  else if (it.interact && object && !g.request) g.request = { type: 'interact', id: object.id };

  if (it.flashlight) p.flashlight = !p.flashlight;
  if (it.heal && g.food > 0 && p.hp < p.maxHp) { g.food--; p.hp = Math.min(p.maxHp, p.hp + FOOD_HEAL); g.events.push('pickup'); }

  if (g.cooldown > 0) g.cooldown--;
  if (g.flash > 0) g.flash--;
  if (g.hurt > 0) g.hurt--;
  if (g.msgT > 0) g.msgT--;
  if (it.fire && p.weapon && g.cooldown === 0) {
    if (p.ammo > 0) shoot(g); else { g.cooldown = FIRE_COOLDOWN; g.events.push('empty'); }
  }

  updateEnemies(g);
  updatePickups(g);
  if (p.weapon && p.ammo === 0) { p.ammo = RESCUE_AMMO; notify(g, 'AWARYJNA AMUNICJA', 90); }
  if (p.hp <= 0) { p.hp = 0; g.state = 'dead'; }
}
