// petla gry, wejscie, przejscia miedzy scenami: menu, gra, dialog, spotkanie w sali, smierc, zwyciestwo
const STEP_MS = 1000 / 60;
const TURN_KEY_SPEED = 0.045;
const MOUSE_SPEED = 0.003;
const SCENE_ZOOM = 1.25, SCENE_OFFSET_X = 80;        // scena 640x480 wycentrowana na canvasie 960x600

const keys = {};
let edges = {};                                       // jednorazowe wcisniecia w grze: interact, flashlight, heal
let scene = 'menu';                                   // menu | play | paused | dialogue | encounter | dead | victory
let game = createGame();
let dialogue = null, dialogueColor = '#fff', dialogueCallback = null, enc = null;
let acc = 0, last = performance.now(), tick = 0, mouseDX = 0, mouseDown = false;
let sceneHeld = {}, sceneQueue = [];
let autoplay = false, apTick = 0;                     // autogra (przycisk w menu): bot w przegladarce, Esc zatrzymuje
let botSpeed = 1;                                     // mnoznik tempa symulacji (bot przyspiesza gre)
let botIntent = null;                                 // gdy ustawione, zastepuje klawiature (bot)

let shakeIntensity = 0, shakeFrames = 0;
let shakeX = 0, shakeY = 0;
function addScreenShake(intensity, frames) {
  shakeIntensity = Math.max(shakeIntensity, intensity);
  shakeFrames = Math.max(shakeFrames, frames);
}

let hitFlashRgb = '255, 255, 255', hitFlashAlpha = 0;
function addHitFlash(rgb, alpha) {
  hitFlashRgb = rgb;
  hitFlashAlpha = Math.max(hitFlashAlpha, alpha);
}

// Lekkie pikselowe czasteczki: kilka kwadratow zamiast kosztownych obrazkow/filtrów.
// Limit chroni renderer przed zapchaniem przy szybkiej autogrze.
const particles = [];
function spawnParticles(x, y, colors, count = 12, force = 4, gravity = 0.12, life = 28) {
  for (let i = 0; i < count && particles.length < 180; i++) {
    const a = Math.random() * Math.PI * 2, speed = force * (0.35 + Math.random() * 0.65);
    particles.push({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - force * 0.25,
      gravity, life: life * (0.65 + Math.random() * 0.5), maxLife: life,
      size: 2 + Math.floor(Math.random() * 4), color: colors[i % colors.length],
    });
  }
}

function battlePlayerPoint() {
  if (!enc || !enc.battle) return { x: 480, y: 390 };
  return {
    x: SCENE_OFFSET_X + (BATTLE_BX + enc.battle.heart.x * BATTLE_S) * SCENE_ZOOM,
    y: (BATTLE_BY + enc.battle.heart.y * BATTLE_S) * SCENE_ZOOM,
  };
}

function spawnEventParticles(ev, inBattle) {
  if (ev === 'crit') spawnParticles(480, 112, ['#fff4a8', '#ffd700', '#ff9a1f'], 28, 8, 0.18, 38);
  else if (ev === 'hit') spawnParticles(480, inBattle ? 125 : 285, ['#ffffff', '#ffe080', '#ff7a35'], inBattle ? 15 : 8, 5, 0.14, 25);
  else if (ev === 'kill') spawnParticles(480, 275, ['#ffd700', '#ff7a35', '#ffffff'], 26, 7, 0.16, 36);
  else if (ev === 'hurt') {
    const p = inBattle ? battlePlayerPoint() : { x: 480, y: 330 };
    spawnParticles(p.x, p.y, ['#ff3030', '#ff7555', '#ffffff'], 18, 6, 0.18, 30);
  } else if (ev === 'heal' || ev === 'pickup' || ev === 'levelup') {
    spawnParticles(480, 505, ev === 'levelup' ? ['#ffe600', '#ffffff', '#4ad66d'] : ['#4ad66d', '#9fffb8', '#ffffff'], ev === 'levelup' ? 24 : 12, 5, -0.03, 34);
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= 0.97; p.life--;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const alpha = Math.min(1, p.life / Math.max(1, p.maxLife * 0.35));
    sctx.globalAlpha = alpha;
    sctx.fillStyle = p.color;
    sctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    if (p.size >= 4 && p.life > p.maxLife * 0.55) {
      sctx.fillRect(Math.round(p.x - p.size), Math.round(p.y + p.size / 2), p.size * 3, 1);
      sctx.fillRect(Math.round(p.x + p.size / 2), Math.round(p.y - p.size), 1, p.size * 3);
    }
  }
  sctx.globalAlpha = 1;
}

// Wszystkie zewnetrzne PNG sa gotowe przed pokazaniem menu. Dzięki temu renderer nigdy
// nie musi przez kilka klatek podmieniac nauczyciela proceduralnym klockiem zastepczym.
const worldSpriteAssets = [GUIDE_NPC.def.sprite, ...TEACHERS.map(t => teacherAsset(t.sprite)), ...Object.values(STAIR_ICON_ASSETS)];
const teacherSceneImages = [GUIDE_NPC.def.portrait, 'assets/teachers/dyrektor1.png', 'assets/zlota-tarcza.png',
  ...TEACHERS.flatMap(t => [teacherAsset(t.sprite), teacherAsset(t.portrait)])];
const visualAssetsReady = Promise.all([
  preloadExternalSprites(worldSpriteAssets),
  preloadSceneImages(teacherSceneImages),
]);

// klawisze w dialogach i walce (strzalki i WASD, Z/Enter/Spacja, X)
const SCENE_KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'confirm', Enter: 'confirm', Space: 'confirm', KeyX: 'cancel', Backspace: 'cancel',
};

function readIntent() {
  if (botIntent) return botIntent;
  const k = settings.keys, on = code => (keys[code] ? 1 : 0);
  const turn = (on(k.turnRight) - on(k.turnLeft)) * TURN_KEY_SPEED + mouseDX * MOUSE_SPEED * settings.sensitivity;
  mouseDX = 0;
  const intent = {
    move: on(k.forward) - on(k.back), strafe: on(k.right) - on(k.left), turn, fire: !!(keys[k.fire] || mouseDown),
    interact: !!edges.interact, flashlight: !!edges.flashlight, heal: !!edges.heal,
  };
  edges = {};
  return intent;
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
  edges = {}; sceneHeld = {}; sceneQueue = [];
  mouseDown = false; mouseDX = 0;
}

function updateGameMusic(g) {
  if (scene === 'play' || scene === 'dialogue') {
    playMusic(g && g.power ? 'explore' : 'dark');
  }
}

function startGame() {
  autoplay = false; botSpeed = 1;
  game = createGame();
  scene = 'play';
  acc = 0;
  clearInput();
  hideScreen();
  audioInit();
  setMusicMuffled(false);
  updateGameMusic(game);
  lockPointer();
  startIntro();
}

function startAutoplay() {
  startGame();
  autoplay = true; apTick = 0; botSpeed = 2;
}

function stopAutoplay() {
  autoplay = false; botSpeed = 1; sceneHeld = {};
}

function backToPlay() {
  scene = 'play';
  acc = 0;
  clearInput();
  setMusicMuffled(false);
  if (!autoplay) lockPointer();
}

function pause() {
  if (scene !== 'play') return;
  scene = 'paused';
  clearInput();
  unlockPointer();
  setMusicMuffled(true);
  showScreen('pause');
}

function resume() {
  hideScreen();
  setMusicMuffled(false);
  backToPlay();
}

function toMenu() {
  scene = 'menu';
  enc = null; dialogue = null;
  game = createGame();
  unlockPointer();
  setMusicMuffled(false);
  playMusic('menu');
  showScreen('main');
}

// --- dialog (NPC, schody) --------------------------------------------------------------------------
function startDialogue(node, color, voice, onDone) {
  dialogue = createDialogue({ ...node, voice });
  dialogueColor = color; dialogueCallback = onDone;
  scene = 'dialogue';
  acc = 0;
  clearInput();
  unlockPointer();
}

// Scenka na starcie: Pani Pietrzyk-Piotrwska (mentor) prowadzi tutorial i rozpoczyna fabule.
function startIntro() {
  const k = settings.keys, y = s => `{c:yellow}${s}{/c}`;
  const lines = [
    { text: '* Stój!{p} Zanim wejdziesz dalej — krótki tutorial.', face: 'sad' },
    '* Jestem ' + y('Pani Pietrzyk-Piotrwska (mentor)') + '.{p} Przeprowadzę Cię przez podstawy.',
    `* Poruszasz się: ${y([k.forward, k.left, k.back, k.right].map(keyLabel).join(' '))}.{p} Rozglądasz się ${y('myszą')} albo ${y(keyLabel(k.turnLeft) + ' ' + keyLabel(k.turnRight))}.`,
    `* ${y('E')} służy do rozmowy i używania obiektów.{p} ${y('F')} włącza latarkę, a ${y('H')} zjada leczącą kanapkę.`,
    `* Pod ${y('M')} masz mapę, a ${y('Esc')} zatrzymuje grę.{p} Żółta strzałka zawsze wskazuje aktualny cel.`,
    { text: '* I od razu mamy problem.{p} W całej szkole wysiadł prąd.', face: 'sad' },
    `* Pierwsza misja: idź do ${y('skrzynki bezpieczników')} po lewej stronie holu i użyj ${y('E')}.`,
    '* Bez paniki.{p} Latarka działa awaryjnie.{p} Ruszaj za żółtą strzałką!',
  ];
  const def = game.npcDefs[GUIDE_NPC.id];
  startDialogue({ npc: def.name, lines, portrait: def.portrait, options: [{ id: 'ok', label: 'Włączam prąd' }] }, def.color, def.voice, () => {
    notify(game, 'NOWA MISJA: uruchom główne bezpieczniki', 220);
  });
}

function talkToNpc(id) {
  const def = game.npcDefs[id];
  const node = dialogFor(game.qs, QUEST_DEFS, game.npcDefs, id);
  noteTalk(game.qs, id);
  startDialogue({ ...node, portrait: def.portrait }, def.color, def.voice, result => applyEffects(game, chooseDialog(game.qs, QUEST_DEFS, game.npcDefs, id, result)));
}

function useStairsDialogue(options) {
  const labels = options.map((s, i) => ({ id: 'go:' + i, label: game.world.floors[s.to[0]].name }));
  const node = { npc: 'Klatka schodowa', lines: ['* Schody.{p} Dokąd idziesz?'], options: [...labels, { id: 'stay', label: 'Zostań' }] };
  startDialogue(node, '#4ad66d', { pitch: 240 }, result => {
    if (result && result.startsWith('go:')) { useStairs(game, options[+result.slice(3)]); playSfx('stairs'); }
  });
}

// --- spotkanie w sali --------------------------------------------------------------------------------
function startEncounter(zone) {
  const room = roomEncounter(zone, game.floor), p = game.player;
  const items = [{ id: 'food', name: 'Kanapka', heal: 25, count: game.food }];
  enc = createEncounter(room, { hp: p.hp, maxHp: p.maxHp, level: p.level }, items, (Math.random() * 1e9) | 0);
  scene = 'encounter';
  acc = 0;
  clearInput();
  unlockPointer();
  playMusic(room.final ? 'boss' : 'battle');
}

function finishEncounter() {
  const r = encounterResult(enc), room = enc.room, p = game.player;
  game.food = Math.max(0, game.food - (r.used.food || 0));
  enc = null;
  if (r.outcome === 'lost') {
    respawn(game);
    notify(game, 'Budzisz się przy schodach');
    updateGameMusic(game);
    return backToPlay();
  }
  p.hp = Math.max(1, r.hp);
  game.cleared.push(room.id);
  if (!room.final && !room.secret) applyEffects(game, onQuestRoom(game.qs, QUEST_DEFS, room.id));
  gainXp(game, r.xp);
  notify(game, `${room.name}: ${r.outcome === 'spared' ? 'oszczędzony' : 'pokonany'}, +${r.xp} XP`, 200);
  if (room.final) {
    if (!game.qs.items.includes('klucz-wyjscie')) game.qs.items.push('klucz-wyjscie');
    notify(game, 'ZDOBYTO KLUCZ DO WYJŚCIA — wróć na parter', 300);
  }
  if (room.secret && !game.qs.items.includes('zlota-legitymacja')) {
    game.qs.items.push('zlota-legitymacja');
    p.maxHp += 20; p.hp = p.maxHp;
    notify(game, 'ZŁOTA LEGITYMACJA — maksymalne HP +20', 300);
    game.events.push('levelup');
  }
  updateGameMusic(game);
  backToPlay();
}

function showEnd(which) {
  stopAutoplay();
  scene = which;
  clearInput();
  unlockPointer();
  if (which === 'victory') playMusic('victory');
  else if (which === 'dead') stopMusic();
  showScreen(which, { time: fmtTime(game.ticks), level: game.player.level, rooms: game.cleared.length, secret: game.qs.items.includes('zlota-legitymacja') });
}

function handleRequest(req) {
  if (req.type === 'npc') talkToNpc(req.id);
  else if (req.type === 'interact' && useInteractable(game, req.id) === 'escaped') showEnd('victory');
  else if (req.type === 'stairs') useStairsDialogue(req.options);
  else if (req.type === 'door') {
    const st = doorStatus(game, req.door);
    if (st.kind === 'msg') notify(game, st.text, 200); else startEncounter(st.zone);
  }
}

ui.onAction = action => {
  switch (action) {
    case 'play': startGame(); break;
    case 'bot': startAutoplay(); break;
    case 'howto': ui.from = 'main'; showScreen('howto'); break;
    case 'settings': ui.from = scene === 'paused' ? 'pause' : 'main'; showScreen('settings'); break;
    case 'back': showScreen(ui.from); break;
    case 'resume': resume(); break;
    case 'retry': respawn(game); hideScreen(); backToPlay(); updateGameMusic(game); break;
    case 'menu': toMenu(); break;
    case 'fullscreen': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); break;
  }
};

function onEscape() {
  if (scene === 'play') pause();
  else if (scene === 'paused') ui.current === 'pause' ? resume() : ui.onAction('back');
  else if (scene === 'menu' && ui.current !== 'main') ui.onAction('back');
}

addEventListener('keydown', e => {
  if (e.code === 'Escape' && autoplay) { stopAutoplay(); return; }
  if (scene === 'dialogue' || scene === 'encounter') {
    const a = SCENE_KEYS[e.code];
    if (a) { e.preventDefault(); if (!e.repeat) sceneQueue.push(a); sceneHeld[a] = true; }
    return;
  }
  keys[e.code] = true;
  if (scene === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') onEscape();
  else if (e.code === 'KeyM') showMap = (showMap + 1) % 3;
  else if (scene === 'play') {
    if (e.code === 'KeyE') edges.interact = true;
    else if (e.code === 'KeyF') edges.flashlight = true;
    else if (e.code === 'KeyH') edges.heal = true;
  }
});
addEventListener('keyup', e => {
  delete keys[e.code];
  const a = SCENE_KEYS[e.code];
  if (a) sceneHeld[a] = false;
});
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

// --- petla ---------------------------------------------------------------------------------------------
function consumeScene() {
  const pressed = {};
  for (const a of sceneQueue) pressed[a] = true;
  sceneQueue = [];
  return pressed;
}

function updatePlay() {
  while (acc >= STEP_MS && scene === 'play') {
    const ap = autoplay ? apIntent(game) : null;
    if (autoplay && !ap) stopAutoplay();
    const prevPower = game.power;
    step(game, ap || readIntent());
    if (game.power !== prevPower) updateGameMusic(game);
    acc -= STEP_MS;
    if (game.request) { handleRequest(game.request); break; }
    if (game.state === 'dead') {
      playSfx('lose');
      stopMusic();
      scene = 'dead';
      clearInput();
      unlockPointer();
      showScreen('dead', { time: fmtTime(game.ticks), level: game.player.level, rooms: game.cleared.length });
      break;
    }
  }
  game.events.forEach(ev => {
    if (ev === 'hurt') {
      addScreenShake(7, 10);
      addHitFlash('255, 30, 30', 0.38);
    }
    spawnEventParticles(ev, false);
    playSfx(ev);
  });
  game.events.length = 0;
}

// autogra w scenach: dialog i walka dostaja klawisze od bota (co 6 klatek, unik w kazdej klatce)
function autoplaySceneInput() {
  if (!autoplay) return;
  apTick++;
  const press = a => { if (a && apTick % 6 === 0) sceneQueue.push(a); };
  if (scene === 'dialogue') {
    const goal = apGoal(game), prefer = dialogue.npc === 'Klatka schodowa' ? [apStairsOption(game, goal.floor)] : [];
    press(apDialogueKey(dialogue, prefer));
    return;
  }
  const b = enc.battle && enc.phase === 'battle' ? enc.battle : null;
  sceneHeld = b && b.phase === 'dodge' ? apDodgeHeld(b) : {};
  botSpeed = b && b.phase === 'dodge' ? 1 : 2;
  if (enc.phase === 'intro' || enc.phase === 'outro') press(apDialogueKey(enc.dialogue));
  else if (b) press(apBattleKey(b));
}

function updateDialogue() {
  while (acc >= STEP_MS && scene === 'dialogue') {
    autoplaySceneInput();
    stepDialogue(dialogue, consumeScene());
    dialogue.events.forEach(playSceneSfx);
    acc -= STEP_MS;
    if (dialogue.phase === 'done') {
      const done = dialogueCallback, result = dialogue.result;
      dialogue = null;
      backToPlay();
      if (done) done(result);
    }
  }
}

function updateEncounter() {
  while (acc >= STEP_MS && scene === 'encounter') {
    autoplaySceneInput();
    stepEncounter(enc, sceneHeld, consumeScene());
    enc.events.forEach(ev => {
      if (ev === 'hurt') {
        addScreenShake(8, 12);
        addHitFlash('255, 30, 30', 0.4);
      } else if (ev === 'crit') {
        addScreenShake(9, 14);
        addHitFlash('255, 220, 50', 0.35);
      } else if (ev === 'hit') {
        addScreenShake(4, 7);
        addHitFlash('255, 255, 255', 0.2);
      }
      spawnEventParticles(ev, true);
      playSceneSfx(ev);
    });
    acc -= STEP_MS;
    if (encounterDone(enc)) finishEncounter();
  }
}

function drawOverlays() {
  const k = uiScale;
  const sx = shakeX, sy = shakeY;
  sctx.setTransform(k, 0, 0, k, sx * k, sy * k);
  if (scene === 'dialogue') {
    sctx.fillStyle = 'rgba(0,0,0,.4)'; sctx.fillRect(-20, -20, W * SCALE + 40, H * SCALE + 40);
    sctx.setTransform(k * SCENE_ZOOM, 0, 0, k * SCENE_ZOOM, (SCENE_OFFSET_X + sx) * k, sy * k);
    drawDialogueBox(sctx, dialogue, dialogueColor, tick);
  } else if (scene === 'encounter') {
    if (enc.phase === 'fadeOut' || enc.phase === 'fadeIn') {
      sctx.fillStyle = `rgba(0,0,0,${enc.fade})`;
      sctx.fillRect(-20, -20, W * SCALE + 40, H * SCALE + 40);
      return;
    }
    sctx.fillStyle = '#000'; sctx.fillRect(-20, -20, W * SCALE + 40, H * SCALE + 40);
    sctx.setTransform(k * SCENE_ZOOM, 0, 0, k * SCENE_ZOOM, (SCENE_OFFSET_X + sx) * k, sy * k);
    drawEncounter(sctx, enc, tick);
  }
  sctx.setTransform(k, 0, 0, k, 0, 0);

  // Efekt niskiego poziomu zdrowia (pulsująca czerwona winieta ostrzegawcza)
  const p = scene === 'encounter' && enc && enc.battle ? enc.battle : (game ? game.player : null);
  if (p && (scene === 'play' || scene === 'encounter')) {
    const hpRatio = p.hp / p.maxHp;
    if (hpRatio <= 0.28 && p.hp > 0) {
      const pulse = Math.sin(tick * 0.12) * 0.5 + 0.5;
      const alpha = (0.2 + 0.25 * pulse) * (1 - hpRatio / 0.28);
      const radGrad = sctx.createRadialGradient(
        W * SCALE / 2, H * SCALE / 2, H * SCALE * 0.28,
        W * SCALE / 2, H * SCALE / 2, W * SCALE * 0.65
      );
      radGrad.addColorStop(0, 'rgba(220, 20, 20, 0)');
      radGrad.addColorStop(1, `rgba(220, 20, 20, ${alpha.toFixed(3)})`);
      sctx.fillStyle = radGrad;
      sctx.fillRect(0, 0, W * SCALE, H * SCALE);
    }
  }

  drawParticles();

  // Rozbłysk uderzenia / trafienia krytycznego
  if (hitFlashAlpha > 0.01) {
    sctx.fillStyle = `rgba(${hitFlashRgb}, ${hitFlashAlpha.toFixed(3)})`;
    sctx.fillRect(-20, -20, W * SCALE + 40, H * SCALE + 40);
    hitFlashAlpha *= 0.8;
    if (hitFlashAlpha < 0.01) hitFlashAlpha = 0;
  }
}

function frame(now) {
  const dt = Math.min(100, now - last);
  last = now; tick++;
  if (shakeFrames > 0) {
    shakeX = (Math.random() - 0.5) * 2 * shakeIntensity;
    shakeY = (Math.random() - 0.5) * 2 * shakeIntensity;
    shakeFrames--;
    if (shakeFrames <= 0) shakeIntensity = 0;
  } else {
    shakeX = 0; shakeY = 0;
  }
  if (typeof window !== 'undefined') window.shakeOffset = { x: shakeX, y: shakeY };
  if (autoplay && scene === 'dead') ui.onAction('retry');
  if (scene === 'menu') game.player.angle += 0.0015;
  else if (scene === 'play') { acc += dt * botSpeed; updatePlay(); }
  else if (scene === 'dialogue') { acc += dt * botSpeed; updateDialogue(); }
  else if (scene === 'encounter') { acc += dt * botSpeed; updateEncounter(); }
  render(game, scene !== 'menu');
  drawOverlays();
  requestAnimationFrame(frame);
}

// interfejs dla bota (Playwright): odczyt stanu i sterowanie bez klawiatury
const dialogueView = d => ({ npc: d.npc, phase: d.phase, options: d.options.map(o => o.id), cursor: d.cursor });
const encounterView = e => ({
  phase: e.phase, dialogue: e.dialogue && dialogueView(e.dialogue),
  battle: e.battle && {
    phase: e.battle.phase, menu: e.battle.menu, cursor: e.battle.cursor, hp: e.battle.hp, maxHp: e.battle.maxHp,
    mercy: e.battle.mercy, enemyHp: e.battle.enemyHp, invuln: e.battle.invuln, heart: { ...e.battle.heart },
    bullets: e.battle.bullets.map(k => ({ x: k.x, y: k.y, vx: k.vx, vy: k.vy, r: k.r })),
    acts: e.battle.def.acts.map(a => ({ id: a.id, mercy: a.mercy || 0 })), items: e.battle.items.map(i => i.count),
  },
});

window.raid = {
  scene: () => scene,
  state: noGrid => ({
    scene, floor: game.floor, state: game.state, ticks: game.ticks, player: { ...game.player }, food: game.food,
    npcs: game.npcs.filter(n => n.floor === game.floor), enemies: game.floors[game.floor].enemies.filter(e => e.alive).map(e => ({ type: e.type, x: e.x, y: e.y })),
    quests: JSON.parse(JSON.stringify(game.qs.quests)), grid: noGrid ? undefined : game.grid, stairLock: game.stairLock, cleared: [...game.cleared], prompt: game.prompt,
    power: game.power, interactables: game.interactables.filter(o => o.floor === game.floor).map(o => ({ ...o })),
    dialogue: dialogue && dialogueView(dialogue), enc: enc && encounterView(enc),
  }),
  world: () => ({
    stairs: WORLD.stairs, npcs: game.npcs.map(n => ({ id: n.id, floor: n.floor, x: n.x, y: n.y })), items: ITEM_PLACE,
    interactables: STORY_INTERACTABLES,
    rescueRooms: STORY_RESCUE_ROOMS.map(id => ({ id, floor: WORLD.floors.findIndex(f => f.rooms[id]) })),
    doors: WORLD.floors.map(f => [...new Set(Object.values(f.doors))].map(d => ({ zone: d.zone, cells: d.cells }))),
  }),
  setSpeed: n => { botSpeed = n; },
  setIntent: it => { botIntent = it; },
  action: a => ui.onAction(a),
};

showScreen('loading');
visualAssetsReady.then(() => { if (scene === 'menu') showScreen('main'); });
playMusic('menu');
const onFirstAudioInteraction = () => {
  audioInit();
  if (scene === 'menu') playMusic('menu');
  removeEventListener('pointerdown', onFirstAudioInteraction);
  removeEventListener('keydown', onFirstAudioInteraction);
};
addEventListener('pointerdown', onFirstAudioInteraction);
addEventListener('keydown', onFirstAudioInteraction);
requestAnimationFrame(frame);
