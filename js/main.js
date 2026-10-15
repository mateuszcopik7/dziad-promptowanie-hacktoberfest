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

function startGame() {
  autoplay = false; botSpeed = 1;
  game = createGame();
  scene = 'play';
  acc = 0;
  clearInput();
  hideScreen();
  audioInit();
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
  if (!autoplay) lockPointer();
}

function pause() {
  if (scene !== 'play') return;
  scene = 'paused';
  clearInput();
  unlockPointer();
  showScreen('pause');
}

function resume() {
  hideScreen();
  backToPlay();
}

function toMenu() {
  scene = 'menu';
  enc = null; dialogue = null;
  game = createGame();
  unlockPointer();
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

// scenka na starcie: Przewodnik uczy sterowania (klawisze z ustawien gracza)
function startIntro() {
  const k = settings.keys, y = s => `{c:yellow}${s}{/c}`;
  const lines = [
    '* Hej!{p} Jestem ' + y('Przewodnik') + '.{p} Pokażę Ci, jak się tu chodzi.',
    `* Ruch: ${y([k.forward, k.left, k.back, k.right].map(keyLabel).join(' '))}.{p} Rozglądasz się ${y('myszą')} albo ${y(keyLabel(k.turnLeft) + ' ' + keyLabel(k.turnRight))}.`,
    `* ${y('E')}: rozmowa.{p} ${y('F')}: latarka.{p} ${y('H')}: kanapka leczy.`,
    `* ${y('M')}: mapa.{p} ${y('Esc')}: pauza.`,
    `* Wejdź w drzwi sali, a zacznie się walka.{p} W walce: strzałki i ${y('Z')}.`,
    '* Żółta strzałka u góry pokazuje cel.{p} Zacznij od ' + y('Woźnego Heńka') + '.{p} Powodzenia!',
  ];
  const def = game.npcDefs[GUIDE_NPC.id];
  startDialogue({ npc: def.name, lines, options: [{ id: 'ok', label: 'Ruszam' }] }, def.color, def.voice, null);
}

function talkToNpc(id) {
  const def = game.npcDefs[id];
  const node = dialogFor(game.qs, QUEST_DEFS, game.npcDefs, id);
  noteTalk(game.qs, id);
  startDialogue(node, def.color, def.voice, result => applyEffects(game, chooseDialog(game.qs, QUEST_DEFS, game.npcDefs, id, result)));
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
}

function finishEncounter() {
  const r = encounterResult(enc), room = enc.room, p = game.player;
  game.food = Math.max(0, game.food - (r.used.food || 0));
  enc = null;
  if (r.outcome === 'lost') {
    respawn(game);
    notify(game, 'Budzisz się przy schodach');
    return backToPlay();
  }
  p.hp = Math.max(1, r.hp);
  game.cleared.push(room.id);
  gainXp(game, r.xp);
  notify(game, `${room.name}: ${r.outcome === 'spared' ? 'oszczędzony' : 'pokonany'}, +${r.xp} XP`, 200);
  if (room.final) return showEnd('victory');
  backToPlay();
}

function showEnd(which) {
  stopAutoplay();
  scene = which;
  clearInput();
  unlockPointer();
  showScreen(which, { time: fmtTime(game.ticks), level: game.player.level, rooms: game.cleared.length });
}

function handleRequest(req) {
  if (req.type === 'npc') talkToNpc(req.id);
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
    case 'retry': respawn(game); hideScreen(); backToPlay(); break;
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
    step(game, ap || readIntent());
    acc -= STEP_MS;
    if (game.request) { handleRequest(game.request); break; }
    if (game.state === 'dead') { playSfx('lose'); scene = 'dead'; clearInput(); unlockPointer(); showScreen('dead', { time: fmtTime(game.ticks), level: game.player.level, rooms: game.cleared.length }); break; }
  }
  game.events.forEach(playSfx);
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
    enc.events.forEach(playSceneSfx);
    acc -= STEP_MS;
    if (encounterDone(enc)) finishEncounter();
  }
}

function drawOverlays() {
  const k = uiScale;
  sctx.setTransform(k, 0, 0, k, 0, 0);
  if (scene === 'dialogue') {
    sctx.fillStyle = 'rgba(0,0,0,.4)'; sctx.fillRect(0, 0, W * SCALE, H * SCALE);
    sctx.setTransform(k * SCENE_ZOOM, 0, 0, k * SCENE_ZOOM, k * SCENE_OFFSET_X, 0);
    drawDialogueBox(sctx, dialogue, dialogueColor, tick);
  } else if (scene === 'encounter') {
    if (enc.phase === 'fadeOut' || enc.phase === 'fadeIn') { sctx.fillStyle = `rgba(0,0,0,${enc.fade})`; sctx.fillRect(0, 0, W * SCALE, H * SCALE); return; }
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W * SCALE, H * SCALE);
    sctx.setTransform(k * SCENE_ZOOM, 0, 0, k * SCENE_ZOOM, k * SCENE_OFFSET_X, 0);
    drawEncounter(sctx, enc, tick);
  }
  sctx.setTransform(k, 0, 0, k, 0, 0);
}

function frame(now) {
  const dt = Math.min(100, now - last);
  last = now; tick++;
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
    dialogue: dialogue && dialogueView(dialogue), enc: enc && encounterView(enc),
  }),
  world: () => ({
    stairs: WORLD.stairs, npcs: game.npcs.map(n => ({ id: n.id, floor: n.floor, x: n.x, y: n.y })), items: ITEM_PLACE,
    doors: WORLD.floors.map(f => [...new Set(Object.values(f.doors))].map(d => ({ zone: d.zone, cells: d.cells }))),
  }),
  setSpeed: n => { botSpeed = n; },
  setIntent: it => { botIntent = it; },
  action: a => ui.onAction(a),
};

showScreen('main');
requestAnimationFrame(frame);
