// petla gry, wejscie, przejscia miedzy ekranami
const STEP_MS = 1000 / 60;
const TURN_KEY_SPEED = 0.045;
const MOUSE_SPEED = 0.003;

const keys = {};
let scene = 'menu';                 // menu | play | paused | levelDone | dead | victory
let game = createGame(0);
let levelIdx = 0, carry = null;     // carry = stan gracza z poczatku biezacego poziomu
let acc = 0, last = performance.now(), mouseDX = 0, mouseDown = false;
let botIntent = null;               // gdy ustawione, zastepuje klawiature (bot)

function readIntent() {
  if (botIntent) return botIntent;
  const k = settings.keys, on = code => (keys[code] ? 1 : 0);
  const turn = (on(k.turnRight) - on(k.turnLeft)) * TURN_KEY_SPEED + mouseDX * MOUSE_SPEED * settings.sensitivity;
  mouseDX = 0;
  return { move: on(k.forward) - on(k.back), strafe: on(k.right) - on(k.left), turn, fire: !!(keys[k.fire] || mouseDown) };
}

function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (_) {}
}

function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

function clearInput() {
  for (const k in keys) delete keys[k];
  mouseDown = false; mouseDX = 0;
}

function startLevel(i) {
  levelIdx = i;
  game = createGame(i, carry);
  scene = 'play';
  acc = 0;
  clearInput();
  hideScreen();
  audioInit();
  lockPointer();
}

function pause() {
  if (scene !== 'play') return;
  scene = 'paused';
  clearInput();
  unlockPointer();
  showScreen('pause');
}

function resume() {
  scene = 'play';
  acc = 0;
  hideScreen();
  lockPointer();
}

function toMenu() {
  scene = 'menu';
  game = createGame(0);
  unlockPointer();
  showScreen('main');
}

function finishLevel() {
  const g = game;
  const data = { name: g.name, time: fmtTime(g.ticks), kills: g.kills, total: g.total, level: g.player.level };
  clearInput();
  if (g.state === 'dead') {
    scene = 'dead';
    playSfx('lose');
    showScreen('dead', data);
  } else {
    carry = carryOf(g);
    scene = levelIdx === LEVELS.length - 1 ? 'victory' : 'levelDone';
    playSfx('win');
    showScreen(scene, data);
  }
  unlockPointer();
}

ui.onAction = action => {
  switch (action) {
    case 'play': carry = null; startLevel(0); break;
    case 'howto': ui.from = 'main'; showScreen('howto'); break;
    case 'settings': ui.from = scene === 'paused' ? 'pause' : 'main'; showScreen('settings'); break;
    case 'back': showScreen(ui.from); break;
    case 'resume': resume(); break;
    case 'retry': startLevel(levelIdx); break;
    case 'next': startLevel(levelIdx + 1); break;
    case 'menu': toMenu(); break;
  }
};

function onEscape() {
  if (scene === 'play') pause();
  else if (scene === 'paused') ui.current === 'pause' ? resume() : ui.onAction('back');
  else if (scene === 'menu' && ui.current !== 'main') ui.onAction('back');
}

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (scene === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') onEscape();
  else if (e.code === 'KeyM') showMap = !showMap;
  else if (e.code === 'KeyR' && scene === 'play') startLevel(levelIdx);
});
addEventListener('keyup', e => { delete keys[e.code]; });
addEventListener('blur', () => { clearInput(); pause(); });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', e => {
  if (scene === 'play' && document.pointerLockElement === canvas) mouseDX += e.movementX;
});
canvas.addEventListener('mousedown', () => {
  if (scene !== 'play') return;
  if (document.pointerLockElement !== canvas) lockPointer();
  mouseDown = true;
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && scene === 'play') pause();
});

function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  if (scene === 'play') {
    acc += dt;
    while (acc >= STEP_MS && game.state === 'play') {
      step(game, readIntent());
      acc -= STEP_MS;
    }
    game.events.forEach(playSfx);
    game.events.length = 0;
    if (game.state !== 'play') finishLevel();
  } else if (scene === 'menu') {
    game.player.angle += 0.0015;
  }
  render(game, scene !== 'menu');
  requestAnimationFrame(frame);
}

// interfejs dla bota (Playwright): odczyt stanu i sterowanie bez klawiatury
window.raid = {
  scene: () => scene,
  state: () => ({
    scene, level: levelIdx, state: game.state, ticks: game.ticks, kills: game.kills, total: game.total,
    player: { ...game.player },
    enemies: game.enemies.filter(e => e.alive).map(e => ({ type: e.type, x: e.x, y: e.y, hp: e.hp, awake: e.awake })),
    pickups: game.pickups.map(k => ({ ...k })),
    grid: game.grid,
  }),
  setIntent: it => { botIntent = it; },
  action: a => ui.onAction(a),
};

showScreen('main');
requestAnimationFrame(frame);
