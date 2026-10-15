// logika gry: poziomy, gracz, wrogowie, strzelanie. Bez DOM, bez renderu i dzwieku.
// Wejscie to "intent" { move, strafe, turn, fire } - tak samo steruje graczem klawiatura i bot.

const LEVELS = [
  {
    name: 'Parter ZSTI',
    map: [
      '1111111111111111',
      '1......1.......1',
      '1......1.......1',
      '1..............1',
      '1......1.......1',
      '11411111111.1111',
      '1..............1',
      '1..............1',
      '1..2222....333.1',
      '1..............1',
      '1..............1',
      '1111.1111111.111',
      '1......1.......1',
      '1......1.......1',
      '1..............1',
      '1111111111111111',
    ],
    start: { x: 1.5, y: 6.5, angle: 0 },
    enemies: [['bug', 10.5, 2.5], ['bug', 5.5, 2.5], ['bug', 4.5, 13.5], ['bug', 12.5, 13.5], ['bug', 13.5, 7.5], ['bug', 8.5, 9.5]],
    pickups: [['food', 8.5, 6.5], ['usb', 2.5, 13.5], ['usb', 13.5, 3.5], ['food', 8.5, 14.5]],
  },
  {
    name: 'Biblioteka',
    map: [
      '11111111111111111111',
      '1..................1',
      '1.5555..5555..5555.1',
      '1..................1',
      '1.5555..5555..5555.1',
      '1..................1',
      '11111.1111111111.111',
      '1..................1',
      '1.22............22.1',
      '1..................1',
      '1.5555..5555..5555.1',
      '1..................1',
      '1.5555..5555..5555.1',
      '1..................1',
      '1..................1',
      '11111111111111111111',
    ],
    start: { x: 3.5, y: 14.5, angle: -Math.PI / 2 },
    enemies: [
      ['bug', 6.5, 1.5], ['glitch', 12.5, 3.5], ['bug', 18.5, 5.5], ['bug', 1.5, 3.5],
      ['glitch', 10.5, 7.5], ['bug', 16.5, 9.5], ['glitch', 6.5, 13.5], ['bug', 18.5, 11.5],
    ],
    pickups: [['food', 9.5, 9.5], ['usb', 1.5, 5.5], ['usb', 18.5, 7.5], ['food', 9.5, 1.5], ['usb', 6.5, 11.5]],
  },
  {
    name: 'Stołówka',
    map: [
      '66666666666666666666',
      '6..................6',
      '6..11....66....11..6',
      '6..11..........11..6',
      '6..................6',
      '6.......6666.......6',
      '6..................6',
      '6..................6',
      '6.......6666.......6',
      '6..................6',
      '6..11..........11..6',
      '6..11....66....11..6',
      '6..................6',
      '66666666666666666666',
    ],
    start: { x: 1.5, y: 6.5, angle: 0 },
    enemies: [
      ['boss', 10.5, 6.5], ['bug', 6.5, 1.5], ['bug', 14.5, 1.5], ['glitch', 6.5, 12.5],
      ['glitch', 14.5, 12.5], ['bug', 18.5, 4.5], ['bug', 18.5, 9.5],
    ],
    pickups: [
      ['food', 1.5, 1.5], ['food', 18.5, 12.5], ['food', 1.5, 12.5], ['food', 18.5, 1.5],
      ['usb', 6.5, 6.5], ['usb', 13.5, 6.5], ['usb', 10.5, 4.5], ['usb', 10.5, 9.5],
    ],
  },
];

const ENEMY_TYPES = {
  bug: { hp: 3, speed: 0.018, dmg: 8, r: 0.35, scale: 0.7, xp: 10 },
  glitch: { hp: 2, speed: 0.032, dmg: 5, r: 0.3, scale: 0.6, xp: 15 },
  boss: { hp: 30, speed: 0.014, dmg: 15, r: 0.6, scale: 1.2, xp: 100 },
};

const PLAYER_SPEED = 0.06;
const PLAYER_RADIUS = 0.22;
const FIRE_COOLDOWN = 14;
const WAKE_DISTANCE = 10;
const KILL_AMMO = 3;                // zwrot amunicji za zabitego buga
const RESCUE_AMMO = 5;              // awaryjna amunicja, gdy zero i brak pendrive'ow na mapie
const START_CARRY ={ level: 1, xp: 0, maxHp: 100, hp: 100, ammo: 30 };

const xpNeeded = level => 30 + 20 * (level - 1);
const damageOf = level => 1 + Math.floor((level - 1) / 2);
const wallAt = (grid, x, y) => (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) ? 1 : grid[y][x];

function createGame(levelIdx, carry) {
  const L = LEVELS[levelIdx], c = carry || START_CARRY;
  return {
    levelIdx, name: L.name,
    grid: L.map.map(row => [...row].map(ch => ch === '.' ? 0 : +ch)),
    player: { x: L.start.x, y: L.start.y, angle: L.start.angle, hp: c.hp, maxHp: c.maxHp, ammo: Math.max(c.ammo, 20), level: c.level, xp: c.xp },
    enemies: L.enemies.map(([type, x, y]) => ({ type, x, y, hp: ENEMY_TYPES[type].hp, alive: true, awake: false, hit: 0, atk: 0 })),
    pickups: L.pickups.map(([kind, x, y]) => ({ kind, x, y })),
    kills: 0, total: L.enemies.length, state: 'play', ticks: 0,
    cooldown: 0, flash: 0, hurt: 0, msg: '', msgT: 0, events: [],
  };
}

// stan gracza przenoszony na kolejny poziom
function carryOf(g) {
  const p = g.player;
  return { level: p.level, xp: p.xp, maxHp: p.maxHp, hp: Math.min(p.maxHp, p.hp + 30), ammo: p.ammo };
}

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

function tryMove(grid, o, dx, dy) {
  if (isFree(grid, o.x + dx, o.y)) o.x += dx;
  if (isFree(grid, o.x, o.y + dy)) o.y += dy;
}

function gainXp(g, amount) {
  const p = g.player;
  p.xp += amount;
  while (p.xp >= xpNeeded(p.level)) {
    p.xp -= xpNeeded(p.level);
    p.level++; p.maxHp += 10; p.hp = Math.min(p.maxHp, p.hp + 30);
    g.msg = 'POZIOM ' + p.level; g.msgT = 120;
    g.events.push('levelup');
  }
}

function shoot(g) {
  const p = g.player, ca = Math.cos(p.angle), sa = Math.sin(p.angle);
  p.ammo--; g.cooldown = FIRE_COOLDOWN; g.flash = 4;
  g.events.push('shoot');
  const wallD = castDist(g.grid, p.x, p.y, ca, sa);
  let best = null, bestD = Infinity;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const rx = e.x - p.x, ry = e.y - p.y;
    const d = rx * ca + ry * sa, perp = Math.abs(rx * sa - ry * ca);
    if (d > 0.2 && perp < ENEMY_TYPES[e.type].r && d < wallD && d < bestD) { best = e; bestD = d; }
  }
  if (!best) return;
  best.hp -= damageOf(p.level); best.hit = 6; best.awake = true;
  if (best.hp > 0) { g.events.push('hit'); return; }
  best.alive = false; g.kills++; p.ammo += KILL_AMMO;
  g.events.push('kill');
  gainXp(g, ENEMY_TYPES[best.type].xp);
}

function updateEnemies(g) {
  const p = g.player;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const T = ENEMY_TYPES[e.type];
    if (e.hit > 0) e.hit--;
    if (e.atk > 0) e.atk--;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (!e.awake && d < WAKE_DISTANCE && hasLOS(g.grid, e.x, e.y, p.x, p.y)) e.awake = true;
    if (!e.awake) continue;
    if (d > T.r + 0.45) tryMove(g.grid, e, dx / d * T.speed, dy / d * T.speed);
    for (const o of g.enemies) {                        // wrogowie sie nie nakladaja
      if (o === e || !o.alive) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 0.6) tryMove(g.grid, e, ox / od * 0.01, oy / od * 0.01);
    }
    if (d < T.r + 0.65 && e.atk === 0) {
      p.hp -= T.dmg; e.atk = 50; g.hurt = 10;
      g.events.push('hurt');
    }
  }
}

function updatePickups(g) {
  const p = g.player;
  g.pickups = g.pickups.filter(k => {
    if (Math.hypot(k.x - p.x, k.y - p.y) > 0.5) return true;
    if (k.kind === 'food') p.hp = Math.min(p.maxHp, p.hp + 25); else p.ammo += 10;
    g.events.push('pickup');
    return false;
  });
}

// jeden krok symulacji (60 na sekunde)
function step(g, it) {
  if (g.state !== 'play') return;
  const p = g.player;
  g.ticks++;
  p.angle += it.turn;
  const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
  const mx = ca * it.move - sa * it.strafe, my = sa * it.move + ca * it.strafe, len = Math.hypot(mx, my);
  if (len > 0) tryMove(g.grid, p, mx / len * PLAYER_SPEED, my / len * PLAYER_SPEED);

  if (g.cooldown > 0) g.cooldown--;
  if (g.flash > 0) g.flash--;
  if (g.hurt > 0) g.hurt--;
  if (g.msgT > 0) g.msgT--;
  if (it.fire && g.cooldown === 0) {
    if (p.ammo > 0) shoot(g); else { g.cooldown = FIRE_COOLDOWN; g.events.push('empty'); }
  }

  updateEnemies(g);
  updatePickups(g);
  if (p.ammo === 0 && !g.pickups.some(k => k.kind === 'usb')) {   // bez tego mozna utknac bez amunicji
    p.ammo = RESCUE_AMMO; g.msg = 'AWARYJNA AMUNICJA'; g.msgT = 90;
    g.events.push('pickup');
  }

  if (p.hp <= 0) { p.hp = 0; g.state = 'dead'; }
  else if (g.kills === g.total) g.state = 'win';
}
