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
  game = createGame();
  scene = 'play';
  acc = 0;
  clearInput();
  hideScreen();
  audioInit();
  lockPointer();
}

function backToPlay() {
  scene = 'play';
  acc = 0;
  clearInput();
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
    case 'howto': ui.from = 'main'; showScreen('howto'); break;
    case 'settings': ui.from = scene === 'paused' ? 'pause' : 'main'; showScreen('settings'); break;
    case 'back': showScreen(ui.from); break;
    case 'resume': resume(); break;
    case 'retry': respawn(game); hideScreen(); backToPlay(); break;
    case 'menu': toMenu(); break;
  }
};

function onEscape() {
  if (scene === 'play') pause();
  else if (scene === 'paused') ui.current === 'pause' ? resume() : ui.onAction('back');
  else if (scene === 'menu' && ui.current !== 'main') ui.onAction('back');
}

addEventListener('keydown', e => {
  if (scene === 'dialogue' || scene === 'encounter') {
    const a = SCENE_KEYS[e.code];
    if (a) { e.preventDefault(); if (!e.repeat) sceneQueue.push(a); sceneHeld[a] = true; }
    return;
  }
  keys[e.code] = true;
  if (scene === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') onEscape();
  else if (e.code === 'KeyM') showMap = !showMap;
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
    step(game, readIntent());
    acc -= STEP_MS;
    if (game.request) { handleRequest(game.request); break; }
    if (game.state === 'dead') { playSfx('lose'); scene = 'dead'; clearInput(); unlockPointer(); showScreen('dead', { time: fmtTime(game.ticks), level: game.player.level, rooms: game.cleared.length }); break; }
  }
  game.events.forEach(playSfx);
  game.events.length = 0;
}

function updateDialogue() {
  while (acc >= STEP_MS && scene === 'dialogue') {
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
    stepEncounter(enc, sceneHeld, consumeScene());
    enc.events.forEach(playSceneSfx);
    acc -= STEP_MS;
    if (encounterDone(enc)) finishEncounter();
  }
}

function drawOverlays() {
  if (scene === 'dialogue') {
    sctx.fillStyle = 'rgba(0,0,0,.4)'; sctx.fillRect(0, 0, W * SCALE, H * SCALE);
    sctx.save(); sctx.setTransform(SCENE_ZOOM, 0, 0, SCENE_ZOOM, SCENE_OFFSET_X, 0);
    drawDialogueBox(sctx, dialogue, dialogueColor, tick);
    sctx.restore();
  } else if (scene === 'encounter') {
    if (enc.phase === 'fadeOut' || enc.phase === 'fadeIn') { sctx.fillStyle = `rgba(0,0,0,${enc.fade})`; sctx.fillRect(0, 0, W * SCALE, H * SCALE); return; }
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W * SCALE, H * SCALE);
    sctx.save(); sctx.setTransform(SCENE_ZOOM, 0, 0, SCENE_ZOOM, SCENE_OFFSET_X, 0);
    drawEncounter(sctx, enc, tick);
    sctx.restore();
  }
}

function frame(now) {
  const dt = Math.min(100, now - last);
  last = now; tick++;
  if (scene === 'menu') game.player.angle += 0.0015;
  else if (scene === 'play') { acc += dt; updatePlay(); }
  else if (scene === 'dialogue') { acc += dt; updateDialogue(); }
  else if (scene === 'encounter') { acc += dt; updateEncounter(); }
  render(game, scene !== 'menu');
  drawOverlays();
  requestAnimationFrame(frame);
}

// interfejs dla bota (Playwright): odczyt stanu i sterowanie bez klawiatury
window.raid = {
  scene: () => scene,
  state: () => ({
    scene, floor: game.floor, state: game.state, ticks: game.ticks, player: { ...game.player }, food: game.food,
    npcs: game.npcs.filter(n => n.floor === game.floor), enemies: game.floors[game.floor].enemies.filter(e => e.alive).map(e => ({ type: e.type, x: e.x, y: e.y })),
    quests: JSON.parse(JSON.stringify(game.qs.quests)), grid: game.grid, cleared: [...game.cleared],
  }),
  setIntent: it => { botIntent = it; },
  action: a => ui.onAction(a),
};

showScreen('main');
requestAnimationFrame(frame);
