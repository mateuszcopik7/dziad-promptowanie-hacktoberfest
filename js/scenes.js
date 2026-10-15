// rysowanie scen na canvasie 640x480: dialog, walka, zaciemnienie. Czyta stan, niczego w nim nie zmienia.
// Wymaga: dialogue.js (allChars, visibleChars, pageFace), battle.js (BOX, TURN_TICKS).

const SCENE_W = 640, SCENE_H = 480;
const BATTLE_S = 2, BATTLE_BX = 80, BATTLE_BY = 150;           // skala i pozycja pudelka walki
const C_WHITE = '#fff', C_ORANGE = '#ff9a1f', C_YELLOW = '#ffe600', C_RED = '#ff2a2a';
const sceneImageCache = {};

function loadSceneImage(path) {
  if (!path || typeof Image === 'undefined') return { img: null, promise: Promise.resolve(false) };
  if (!sceneImageCache[path]) {
    const img = new Image();
    const entry = sceneImageCache[path] = { img, promise: new Promise(resolve => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    }) };
    img.src = path;
  }
  return sceneImageCache[path];
}

function sceneImage(path) {
  const entry = loadSceneImage(path), img = entry.img;
  return img && img.complete && img.naturalWidth ? img : null;
}

function preloadSceneImages(paths) { return Promise.all([...new Set(paths.filter(Boolean))].map(path => loadSceneImage(path).promise)); }

function drawImageContain(g, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height), dw = img.width * scale, dh = img.height * scale;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawHeart(g, x, y, color) {
  g.fillStyle = color;
  g.fillRect(x - 6, y - 6, 5, 5); g.fillRect(x + 1, y - 6, 5, 5);
  g.fillRect(x - 7, y - 3, 14, 5); g.fillRect(x - 5, y + 2, 10, 3); g.fillRect(x - 2, y + 5, 4, 3);
}

function drawPlayerShield(g, x, y, size = 30, blink = false) {
  const img = sceneImage('assets/zlota-tarcza.png');
  if (!img) return drawHeart(g, x, y, blink ? '#f5df9a' : '#d4af37');
  g.save();
  if (blink) g.globalAlpha = 0.35;
  drawImageContain(g, img, x - size / 2, y - size / 2, size, size);
  g.restore();
}

// zawijanie na pelnym tekscie strony, zeby slowa nie przeskakiwaly podczas pisania
function wrapChars(g, chars, maxW) {
  g.font = '22px monospace';
  const lines = [[]];
  let w = 0, word = [];
  const flush = () => {
    if (w + word.length * 13.2 > maxW && lines[lines.length - 1].length) { lines.push([]); w = 0; }
    lines[lines.length - 1].push(...word); w += word.length * 13.2; word = [];
  };
  for (const c of chars) { word.push(c); if (c.ch === ' ') flush(); }
  flush();
  return lines;
}

function drawPortrait(g, x, y, color, face, portrait) {
  const img = sceneImage(portrait);
  if (img) { g.save(); g.beginPath(); g.rect(x, y, 84, 84); g.clip(); drawImageContain(g, img, x, y, 84, 84); g.restore(); return; }
  g.fillStyle = color; g.fillRect(x, y, 84, 84);
  g.fillStyle = '#fff'; g.fillRect(x + 16, y + 22, 14, 14); g.fillRect(x + 54, y + 22, 14, 14);
  g.fillStyle = '#000'; g.fillRect(x + 20, y + 26, 6, 6); g.fillRect(x + 58, y + 26, 6, 6);
  g.fillRect(x + 22, y + (face === 'sad' ? 62 : 56), 40, 5);
  if (face === 'smile') { g.fillRect(x + 18, y + 52, 5, 5); g.fillRect(x + 61, y + 52, 5, 5); }
  if (face === 'sad') { g.fillRect(x + 18, y + 66, 5, 5); g.fillRect(x + 61, y + 66, 5, 5); }
}

// color: kolor portretu NPC
function drawDialogueBox(g, d, color, tick) {
  const bx = 24, by = 330, bw = 592, bh = 138, face = pageFace(d);
  g.fillStyle = '#000'; g.fillRect(bx, by, bw, bh);
  g.strokeStyle = C_WHITE; g.lineWidth = 6; g.strokeRect(bx, by, bw, bh);
  drawPortrait(g, bx + 18, by + 22, color, face, d.portrait);
  const lines = wrapChars(g, allChars(d), bw - 150), shown = visibleChars(d).length;
  g.font = '22px monospace'; g.textBaseline = 'top';
  let k = 0;
  lines.forEach((ln, li) => {
    let x = bx + 120;
    ln.forEach(c => {
      if (k < shown) {
        const sx = c.shake ? (Math.random() - 0.5) * 3 : 0, sy = c.shake ? (Math.random() - 0.5) * 3 : 0;
        g.fillStyle = c.color || C_WHITE; g.fillText(c.ch, x + sx, by + 22 + li * 28 + sy);
      }
      x += 13.2; k++;
    });
  });
  g.textBaseline = 'alphabetic';
  if (d.phase === 'wait' && d.options.length <= 1 && Math.floor(tick / 20) % 2 === 0) { g.fillStyle = C_WHITE; g.fillRect(bx + bw - 34, by + bh - 26, 14, 10); }
  if (d.phase === 'choice') {
    d.options.forEach((o, i) => {
      const ox = bx + 140 + i * 210, oy = by + bh - 34;
      if (d.cursor === i) { g.fillStyle = C_RED; g.fillRect(ox - 22, oy + 4, 12, 10); }
      g.fillStyle = d.cursor === i ? C_YELLOW : C_WHITE; g.font = '20px monospace'; g.fillText('* ' + o.label, ox, oy);
    });
  }
  g.fillStyle = C_WHITE; g.font = 'bold 13px monospace'; g.fillText(d.npc, bx + 20, by - 8);
}

// portret bossa z icons.js; stary prostokat zostaje tylko dla bossa bez ikony
function drawBossPlaceholder(g, b) {
  const shake = b.bar.hit && b.phase === 'text' && b.next === 'dodge' ? Math.sin(b.tick * 1.2) * 6 : 0;
  if (typeof ICONS !== 'undefined' && ICONS[b.def.name]) drawBossPortrait(g, b.def.name, 320 + shake, 76, 4, b.tick);
  else {
    const look = b.def.look || { color: '#7a4bd1', head: '#b79aff' };
    g.save(); g.translate(320 + shake, 80);
    g.fillStyle = look.color; g.fillRect(-45, -40, 90, 100);
    g.fillStyle = look.head; g.fillRect(-35, -70, 70, 40);
    g.restore();
  }
  g.font = '16px monospace'; g.textAlign = 'center'; g.fillStyle = C_WHITE; g.fillText(b.def.name, 320, 144);
  if (b.bar.hit > 0 && b.phase === 'text') {
    g.fillStyle = '#333'; g.fillRect(250, 20, 140, 12);
    g.fillStyle = '#2bd62b'; g.fillRect(250, 20, 140 * b.enemyHp / b.def.hp, 12);
    g.fillStyle = C_RED; g.font = 'bold 22px monospace'; g.fillText('-' + b.bar.hit, 320, 14);
  }
  g.textAlign = 'left';
}

function drawBattleText(g, b) {
  const S = BATTLE_S, bx = BATTLE_BX, by = BATTLE_BY;
  g.font = '22px monospace'; g.fillStyle = C_WHITE; g.textBaseline = 'top';
  const typed = (text) => {
    const lines = wrapChars(g, parseMarkup(text).filter(t => !t.pause), BOX.w * S - 40);
    let left = Math.floor(b.tick / 1.5);
    lines.forEach((ln, i) => { const s = ln.map(c => c.ch).join(''); g.fillText(s.slice(0, Math.max(0, left)), bx + 20, by + 24 + i * 26); left -= s.length; });
  };
  if (b.phase === 'text') typed(b.text);
  else if (b.phase === 'menu' && b.menu !== 'main') {
    listFor(b).forEach((it, i) => {
      g.fillStyle = i === b.cursor ? C_YELLOW : C_WHITE;
      g.fillText((i === b.cursor ? '♥ ' : '  ') + (it.label || (it.name + ' x' + it.count)), bx + 30, by + 24 + i * 32);
    });
    if (b.menu === 'act') { g.fillStyle = '#888'; g.font = '14px monospace'; g.fillText('Nastrój: ' + b.mercy + '/100', bx + 30, by + 210); }
  } else if (b.phase === 'menu') typed(b.def.flavor[b.turn % b.def.flavor.length]);
  g.textBaseline = 'alphabetic';
}

function drawBattleScene(g, b) {
  const S = BATTLE_S, bx = BATTLE_BX, by = BATTLE_BY;
  drawBossPlaceholder(g, b);
  g.strokeStyle = C_WHITE; g.lineWidth = 4; g.strokeRect(bx - 2, by - 2, BOX.w * S + 4, BOX.h * S + 4);
  if (b.phase === 'dodge') {
    g.fillStyle = C_WHITE;
    for (const k of b.bullets) { g.beginPath(); g.arc(bx + k.x * S, by + k.y * S, k.r * S, 0, 7); g.fill(); }
    drawPlayerShield(g, bx + b.heart.x * S, by + b.heart.y * S, 32, b.invuln > 0 && Math.floor(b.invuln / 4) % 2 === 0);
    g.fillStyle = '#555'; g.fillRect(bx, by + BOX.h * S + 8, BOX.w * S * (1 - b.dodgeTick / (b.def.turnTicks || TURN_TICKS)), 4);
  } else if (b.phase === 'bar') {
    g.fillStyle = '#222'; g.fillRect(bx + 20, by + 70, BOX.w * S - 40, 100);
    g.strokeStyle = C_WHITE; g.lineWidth = 2; g.strokeRect(bx + 20, by + 70, BOX.w * S - 40, 100);
    g.fillStyle = '#2bd62b'; g.fillRect(bx + BOX.w * S / 2 - 6, by + 70, 12, 100);
    g.fillStyle = C_WHITE; g.fillRect(bx + 20 + (BOX.w * S - 40) * b.bar.pos - 4, by + 62, 8, 116);
  } else drawBattleText(g, b);
  // statystyki i przyciski
  g.font = 'bold 16px monospace'; g.fillStyle = C_WHITE; g.fillText('GRACZ  LV ' + b.level, 20, 408); g.fillText('HP', 260, 408);
  g.fillStyle = C_RED; g.fillRect(290, 394, 80, 16);
  g.fillStyle = C_YELLOW; g.fillRect(290, 394, 80 * b.hp / b.maxHp, 16);
  g.fillStyle = C_WHITE; g.fillText(b.hp + ' / ' + b.maxHp, 380, 408);
  g.fillStyle = '#888'; g.font = '13px monospace'; g.fillText('NASTRÓJ ' + b.mercy + '/100', 480, 408);
  ['FIGHT', 'ACT', 'ITEM', 'MERCY'].forEach((l, i) => {
    const x = 20 + i * 150, sel = b.phase === 'menu' && b.menu === 'main' && b.cursor === i;
    g.strokeStyle = sel ? C_YELLOW : C_ORANGE; g.lineWidth = 3; g.strokeRect(x, 420, 130, 40);
    g.fillStyle = sel ? C_YELLOW : C_ORANGE; g.font = 'bold 20px monospace'; g.textAlign = 'center'; g.fillText(l, x + 65, 447); g.textAlign = 'left';
    if (sel) drawPlayerShield(g, x + 16, 440, 22);
  });
}

function drawFade(g, alpha) {
  if (alpha <= 0) return;
  g.fillStyle = `rgba(0,0,0,${alpha})`; g.fillRect(0, 0, SCENE_W, SCENE_H);
}

// pelne spotkanie: zaciemnienie nad swiatem, scenka na czarnym tle, walka, rozjasnienie
function drawEncounter(g, e, tick) {
  if (e.phase === 'fadeOut' || e.phase === 'fadeIn') { drawFade(g, e.fade); return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, SCENE_W, SCENE_H);
  if (e.phase === 'battle') drawBattleScene(g, e.battle);
  else {
    const t = e.room.teacher, look = t.look || { color: '#4bb0d1' };
    const teacherImg = sceneImage(t.sprite || t.portrait);
    if (teacherImg) drawImageContain(g, teacherImg, 220, 38, 200, 270);
    else {
      g.fillStyle = look.color; g.fillRect(270, 90, 100, 150);
      g.fillStyle = '#fff'; g.fillRect(292, 120, 14, 14); g.fillRect(334, 120, 14, 14);
      g.fillStyle = '#000'; g.fillRect(296, 124, 6, 6); g.fillRect(338, 124, 6, 6); g.fillRect(298, 170, 44, 5);
    }
    drawDialogueBox(g, e.dialogue, look.color, tick);
  }
}
