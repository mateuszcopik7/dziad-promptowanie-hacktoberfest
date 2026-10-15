// walka turowa w stylu Undertale: czysta logika bez DOM i bez renderu.
// Tura gracza: FIGHT (pasek timingu), ACT (akcje zmieniaja nastroj bossa), ITEM, MERCY (oszczedz, gdy nastroj pelny).
// Tura bossa: serce gracza unika pociskow w pudelku. Krok 60 razy na sekunde.
//
// def bossa: { name, hp, xp, intro, check, killText, spareText, acts: [{ id, label, mercy, text }],
//              patterns: [{ type: 'rain'|'wall'|'side', rate, speed, dmg }], turnTicks }
// wejscie: held = { left, right, up, down }, pressed = { left, right, up, down, confirm, cancel } (zbocza)

const BOX = { w: 240, h: 120 };      // pudelko uniku (jednostki logiczne)
const HEART_R = 5;
const HEART_SPEED = 2.2;
const TURN_TICKS = 360;
const INVULN_TICKS = 50;
const BAR_SPEED = 0.012;             // polowa paska na ~40 klatek
const MERCY_FULL = 100;
const MAIN_MENU = ['fight', 'act', 'item', 'mercy'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// player: { hp, maxHp, level }, items: [{ id, name, heal, count }]
function createBattle(def, player, items, seed = 1) {
  return {
    def, rng: mulberry32(seed), phase: 'text', next: 'menu', text: def.intro, menu: 'main', cursor: 0,
    hp: player.hp, maxHp: player.maxHp, level: player.level, atk: 4 + 2 * player.level,
    enemyHp: def.hp, mercy: 0, turn: 0, tick: 0, dodgeTick: 0,
    items: items.map(i => ({ ...i })), heart: { x: BOX.w / 2, y: BOX.h / 2 }, bullets: [], invuln: 0,
    bar: { pos: 0, hit: 0 }, outcome: null, pending: null, events: [],
  };
}

function say(b, text, next) {
  b.phase = 'text'; b.text = text; b.next = next;
}

const wrap = (v, n) => (v + n) % n;
const clamp01 = v => Math.max(0, Math.min(1, v));

function listFor(b) {
  if (b.menu === 'act') return b.def.acts;
  if (b.menu === 'item') return b.items.filter(i => i.count > 0);
  return MAIN_MENU;
}

function startBar(b) {
  b.phase = 'bar'; b.bar = { pos: 0, hit: 0 };
}

function stopBar(b) {
  const quality = clamp01(1 - Math.abs(b.bar.pos - 0.5) * 2);       // 1 na srodku, 0 na brzegu
  const dmg = Math.round(b.atk * quality * 2);
  b.bar.hit = dmg;
  b.enemyHp = Math.max(0, b.enemyHp - dmg);
  b.events.push(dmg > 0 ? 'hit' : 'miss');
  if (b.enemyHp <= 0) { b.pending = 'killed'; say(b, b.def.killText, 'end'); }
  else say(b, dmg > 0 ? `Trafienie! ${dmg} obrażeń.` : 'Pudło.', 'dodge');
}

function doAct(b, act) {
  b.mercy = Math.min(MERCY_FULL, b.mercy + (act.mercy || 0));
  b.events.push('act');
  say(b, act.id === 'check' ? b.def.check : act.text, 'dodge');
}

function doItem(b, item) {
  item.count--;
  b.hp = Math.min(b.maxHp, b.hp + item.heal);
  b.events.push('heal');
  say(b, `${item.name}: +${item.heal} HP.`, 'dodge');
}

function doMercy(b) {
  if (b.mercy >= MERCY_FULL) { b.pending = 'spared'; say(b, b.def.spareText, 'end'); }
  else say(b, `${b.def.name} jeszcze nie chce kończyć walki.`, 'dodge');
}

function confirmMenu(b) {
  const list = listFor(b), choice = list[b.cursor];
  if (b.menu === 'main') {
    if (choice === 'fight') startBar(b);
    else if (choice === 'mercy') doMercy(b);
    else if (list.length) { b.menu = choice; b.cursor = 0; if (!listFor(b).length) { b.menu = 'main'; say(b, 'Nic tu nie ma.', 'menu'); } }
  } else if (b.menu === 'act') { doAct(b, choice); b.menu = 'main'; b.cursor = 0; }
  else if (b.menu === 'item') { doItem(b, choice); b.menu = 'main'; b.cursor = 0; }
}

function spawnBullets(b, pat) {
  const r = b.rng;
  if (b.dodgeTick % pat.rate !== 0) return;
  if (pat.type === 'rain') {
    b.bullets.push({ x: r() * BOX.w, y: -4, vx: 0, vy: pat.speed, r: 4, dmg: pat.dmg });
  } else if (pat.type === 'side') {
    const left = r() < 0.5, y = 8 + r() * (BOX.h - 16);
    b.bullets.push({ x: left ? -4 : BOX.w + 4, y, vx: left ? pat.speed : -pat.speed, vy: 0, r: 4, dmg: pat.dmg });
  } else {                                                          // wall: linia pociskow z przerwa
    const gap = Math.floor(r() * 10), cols = 12, step = BOX.w / cols;
    for (let i = 0; i < cols; i++) {
      if (i === gap || i === gap + 1) continue;
      b.bullets.push({ x: step * (i + 0.5), y: -4, vx: 0, vy: pat.speed, r: 5, dmg: pat.dmg });
    }
  }
}

function stepDodge(b, held) {
  const pat = b.def.patterns[b.turn % b.def.patterns.length], h = b.heart;
  h.x = Math.max(HEART_R, Math.min(BOX.w - HEART_R, h.x + ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * HEART_SPEED));
  h.y = Math.max(HEART_R, Math.min(BOX.h - HEART_R, h.y + ((held.down ? 1 : 0) - (held.up ? 1 : 0)) * HEART_SPEED));
  if (b.invuln > 0) b.invuln--;
  b.dodgeTick++;
  spawnBullets(b, pat);
  for (const k of b.bullets) {
    k.x += k.vx; k.y += k.vy;
    if (b.invuln === 0 && Math.hypot(k.x - h.x, k.y - h.y) < k.r + HEART_R) {
      b.hp = Math.max(0, b.hp - k.dmg); b.invuln = INVULN_TICKS; b.events.push('hurt'); k.dead = true;
    }
  }
  b.bullets = b.bullets.filter(k => !k.dead && k.x > -10 && k.x < BOX.w + 10 && k.y > -10 && k.y < BOX.h + 10);
  if (b.hp <= 0) { b.outcome = 'lost'; b.phase = 'end'; return; }
  if (b.dodgeTick >= (b.def.turnTicks || TURN_TICKS)) {
    b.turn++; b.bullets = [];
    say(b, b.def.flavor ? b.def.flavor[b.turn % b.def.flavor.length] : '...', 'menu');
  }
}

function stepBattle(b, held, pressed) {
  b.tick++;
  if (b.phase === 'text') {
    if (!pressed.confirm) return;
    if (b.next === 'dodge') { b.phase = 'dodge'; b.dodgeTick = 0; b.bullets = []; b.heart = { x: BOX.w / 2, y: BOX.h / 2 }; b.invuln = 0; }
    else if (b.next === 'end') { b.phase = 'end'; b.outcome = b.pending; }
    else { b.phase = 'menu'; b.menu = 'main'; b.cursor = 0; }
  } else if (b.phase === 'menu') {
    const n = listFor(b).length;
    if (pressed.left || pressed.up) b.cursor = wrap(b.cursor - 1, n);
    if (pressed.right || pressed.down) b.cursor = wrap(b.cursor + 1, n);
    if (pressed.cancel && b.menu !== 'main') { b.menu = 'main'; b.cursor = 0; }
    if (pressed.confirm) confirmMenu(b);
  } else if (b.phase === 'bar') {
    b.bar.pos += BAR_SPEED;
    if (pressed.confirm) stopBar(b);
    else if (b.bar.pos >= 1) { b.bar.pos = 1; stopBar(b); }
  } else if (b.phase === 'dodge') stepDodge(b, held);
}

// wynik po zakonczeniu walki: { outcome, xp }
function battleResult(b) {
  return { outcome: b.outcome, xp: b.outcome === 'killed' || b.outcome === 'spared' ? b.def.xp : 0, hp: b.hp };
}
