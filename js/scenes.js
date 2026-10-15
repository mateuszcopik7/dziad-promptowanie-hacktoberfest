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

function getPortraitType(name) {
  if (!name) return 'student_boy';
  const n = String(name).toLowerCase();
  if (n.includes('schody') || n.includes('klatka')) return 'stairs';
  if (n.includes('woźn') || n.includes('heniek') || n.includes('ochroniarz')) return 'janitor';
  if (n.includes('sekretar')) return 'secretary';
  if (n.includes('bibliotekar')) return 'librarian';
  if (n.includes('dyrektor')) return 'director';
  if (n.includes('pietrzyk') || n.includes('mentor')) return 'mentor';
  if (n.includes('uczennica')) return 'student_girl';
  if (n.includes('matematyk') || n.includes('fibich') || n.includes('kręcichwost') || n.includes('pani')) return 'teacher_f';
  if (n.includes('uczeń') || n.includes('kolega') || n.includes('praktykant')) return 'student_boy';
  return 'teacher_m';
}

function drawPixelPortrait(g, ox, oy, type, face, mainColor, tick = 0, scale = 3) {
  const px = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(ox + x * scale), Math.round(oy + y * scale), Math.round(w * scale), Math.round(h * scale));
  };

  px(0, 0, 28, 28, '#12141c');
  g.strokeStyle = mainColor || '#4bb0d1';
  g.lineWidth = Math.max(1, Math.round(scale * 0.6));
  g.strokeRect(ox + 1, oy + 1, 28 * scale - 2, 28 * scale - 2);

  if (type === 'stairs') {
    const steps = [
      { x: 3, y: 19, w: 22, h: 4, c1: '#4ad66d', c2: '#207038' },
      { x: 6, y: 15, w: 16, h: 4, c1: '#5ae07d', c2: '#288040' },
      { x: 9, y: 11, w: 10, h: 4, c1: '#74f095', c2: '#309048' },
      { x: 12, y: 7, w: 4, h: 4, c1: '#9fffb8', c2: '#38a854' },
    ];
    for (const s of steps) {
      px(s.x, s.y, s.w, 2, s.c1);
      px(s.x, s.y + 2, s.w, s.h - 2, s.c2);
    }
    const blink = Math.floor(tick / 18) % 2 === 0;
    const arrowCol = blink ? '#ffffff' : '#4ad66d';
    px(13, 2, 2, 4, arrowCol);
    px(12, 3, 4, 1, arrowCol);
    px(11, 4, 6, 1, arrowCol);
    return;
  }

  const skin = '#f8cfab', skinSh = '#dea37c';
  const iris = mainColor || '#3672b8';

  // Szyja i owal twarzy
  px(11, 22, 6, 4, skinSh);
  px(7, 7, 14, 15, skin);
  px(6, 9, 16, 11, skin);
  px(8, 22, 12, 2, skin);
  px(9, 23, 10, 1, skinSh);

  // Oczy
  px(8, 12, 4, 3, '#ffffff');
  px(16, 12, 4, 3, '#ffffff');
  px(9, 12, 2, 3, iris);
  px(17, 12, 2, 3, iris);
  px(10, 13, 1, 2, '#181822');
  px(18, 13, 1, 2, '#181822');
  px(9, 12, 1, 1, '#ffffff');
  px(17, 12, 1, 1, '#ffffff');

  // Nos
  px(13, 15, 2, 2, skinSh);
  px(14, 16, 1, 1, '#c88662');

  // Brwi i usta wg nastroju
  const brow = '#38281e';
  if (face === 'sad') {
    px(8, 10, 2, 1, brow); px(10, 9, 2, 1, brow);
    px(16, 9, 2, 1, brow); px(18, 10, 2, 1, brow);
    px(12, 20, 4, 1, '#963444');
    px(11, 21, 1, 1, '#963444'); px(16, 21, 1, 1, '#963444');
    px(21, 7, 2, 3, '#60b8ff');
  } else if (face === 'smile') {
    px(8, 9, 4, 1, brow); px(16, 9, 4, 1, brow);
    px(11, 19, 6, 2, '#963444');
    px(12, 19, 4, 1, '#ffffff');
    px(10, 18, 1, 1, '#963444'); px(17, 18, 1, 1, '#963444');
    px(7, 15, 2, 2, 'rgba(235,100,110,0.4)');
    px(19, 15, 2, 2, 'rgba(235,100,110,0.4)');
  } else {
    px(8, 10, 4, 1, brow); px(16, 10, 4, 1, brow);
    px(12, 19, 4, 1, '#88303e');
    px(13, 20, 2, 1, skinSh);
  }

  // Cechy poszczegolnych postaci
  if (type === 'janitor') {
    px(5, 1, 18, 5, '#2c385c');
    px(3, 5, 22, 2, '#1a223a');
    px(13, 2, 2, 2, '#f0c030');
    px(4, 7, 3, 4, '#707888');
    px(21, 7, 3, 4, '#707888');
    px(8, 17, 12, 3, '#484e5c');
    px(7, 18, 14, 2, '#5a6272');
    px(4, 24, 20, 4, '#2c385c');
    px(10, 24, 8, 4, '#a03830');
  } else if (type === 'secretary') {
    const hair = '#422218';
    px(5, 2, 18, 6, hair);
    px(3, 7, 4, 11, hair); px(21, 7, 4, 11, hair);
    px(7, 7, 4, 2, hair); px(17, 7, 4, 2, hair);
    px(7, 11, 6, 4, '#d02838'); px(15, 11, 6, 4, '#d02838'); px(13, 12, 2, 1, '#d02838');
    px(8, 12, 4, 2, '#eef8ff'); px(16, 12, 4, 2, '#eef8ff');
    px(8, 12, 1, 1, '#ffffff'); px(16, 12, 1, 1, '#ffffff');
    px(5, 24, 18, 4, mainColor || '#d1684b');
    px(11, 23, 6, 1, '#ffffff');
  } else if (type === 'librarian') {
    const hair = '#4c3424';
    px(10, 0, 8, 4, hair);
    px(5, 3, 18, 5, hair);
    px(4, 8, 3, 8, hair); px(21, 8, 3, 8, hair);
    px(7, 12, 5, 4, '#cca040'); px(16, 12, 5, 4, '#cca040'); px(12, 13, 4, 1, '#cca040');
    px(8, 13, 3, 2, '#f0faff'); px(17, 13, 3, 2, '#f0faff');
    px(4, 24, 20, 4, '#38885a');
    px(12, 24, 4, 4, '#ede4d8');
  } else if (type === 'director') {
    const hair = '#282834';
    px(4, 2, 20, 6, hair);
    px(3, 7, 4, 11, hair); px(21, 7, 4, 11, hair);
    px(7, 3, 14, 2, '#9296a8');
    px(3, 16, 1, 2, '#ffd700'); px(24, 16, 1, 2, '#ffd700');
    px(4, 24, 20, 4, '#1c2234');
    px(11, 24, 6, 4, '#ffffff');
    px(13, 26, 2, 2, '#ffd700');
  } else if (type === 'mentor') {
    const hair = '#26262e';
    px(5, 3, 18, 5, hair);
    px(4, 7, 3, 9, hair); px(21, 7, 3, 9, hair);
    px(7, 7, 4, 2, hair); px(17, 7, 4, 2, hair);
    px(7, 11, 6, 4, '#4ad6c9'); px(15, 11, 6, 4, '#4ad6c9'); px(13, 12, 2, 1, '#4ad6c9');
    px(8, 12, 4, 2, '#eefeff'); px(16, 12, 4, 2, '#eefeff');
    px(8, 12, 1, 1, '#ffffff'); px(16, 12, 1, 1, '#ffffff');
    px(4, 24, 20, 4, '#243448');
    px(11, 24, 6, 4, '#4ad6c9');
  } else if (type === 'student_girl') {
    const hair = '#7a2e22', ribbon = mainColor || '#d64ba0';
    px(5, 3, 18, 5, hair);
    px(3, 7, 4, 16, hair); px(21, 7, 4, 16, hair);
    px(3, 7, 3, 2, ribbon); px(22, 7, 3, 2, ribbon);
    px(8, 7, 4, 3, hair); px(16, 7, 4, 3, hair);
    px(5, 24, 18, 4, '#222d42');
    px(11, 24, 6, 4, '#ffffff');
    px(12, 25, 4, 3, '#d02840');
  } else if (type === 'teacher_f') {
    const hair = '#5a3020';
    px(4, 3, 20, 6, hair);
    px(3, 7, 4, 12, hair); px(21, 7, 4, 12, hair);
    px(7, 11, 5, 4, '#804020'); px(16, 11, 5, 4, '#804020'); px(12, 12, 4, 1, '#804020');
    px(4, 24, 20, 4, mainColor || '#8b5d45');
    px(11, 24, 6, 4, '#f0ece4');
  } else if (type === 'teacher_m') {
    const hair = '#2e2e38';
    px(5, 2, 18, 6, hair);
    px(4, 7, 3, 8, hair); px(21, 7, 3, 8, hair);
    px(4, 24, 20, 4, mainColor || '#344269');
    px(11, 24, 6, 4, '#ffffff');
    px(13, 25, 2, 3, '#c03030');
  } else {
    const hair = '#34251c', hairHi = '#563e30';
    px(5, 3, 18, 5, hair);
    px(4, 5, 3, 8, hair); px(21, 5, 3, 8, hair);
    px(8, 7, 3, 3, hair); px(12, 7, 3, 4, hair); px(16, 7, 4, 3, hair);
    px(7, 3, 12, 1, hairHi); px(10, 2, 6, 1, hairHi);
    px(4, 24, 20, 4, mainColor || '#3878b8');
    px(11, 24, 6, 4, '#ffffff');
    px(13, 24, 2, 4, '#242c38');
    px(9, 25, 1, 3, '#ffffff'); px(18, 25, 1, 3, '#ffffff');
  }
}

function drawPortrait(g, x, y, color, face, portrait, name, tick = 0) {
  const img = sceneImage(portrait);
  if (img) { g.save(); g.beginPath(); g.rect(x, y, 84, 84); g.clip(); drawImageContain(g, img, x, y, 84, 84); g.restore(); return; }
  const type = getPortraitType(name || portrait);
  drawPixelPortrait(g, x, y, type, face, color, tick);
}

// color: kolor portretu NPC
function drawDialogueBox(g, d, color, tick) {
  const bx = 24, by = 330, bw = 592, bh = 138, face = pageFace(d);
  g.fillStyle = '#000'; g.fillRect(bx, by, bw, bh);
  g.strokeStyle = C_WHITE; g.lineWidth = 6; g.strokeRect(bx, by, bw, bh);
  drawPortrait(g, bx + 18, by + 22, color, face, d.portrait, d.npc, tick);
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
    const crit = !!b.bar.crit;
    g.fillStyle = crit ? '#ffd700' : C_RED;
    g.font = crit ? 'bold 24px monospace' : 'bold 22px monospace';
    const floatY = 14 - Math.min(8, (b.tick % 30) * 0.3);
    g.fillText((crit ? '★ KRYTYK! -' : '-') + b.bar.hit, 320, floatY);
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
    const barX = bx + 20, barY = by + 70, barW = BOX.w * S - 40, barH = 100;
    g.fillStyle = '#161824'; g.fillRect(barX, barY, barW, barH);
    g.strokeStyle = C_WHITE; g.lineWidth = 2; g.strokeRect(barX, barY, barW, barH);
    // Dobra strefa (zielona) i strefa krytyczna (zlota)
    const midX = barX + barW / 2;
    g.fillStyle = 'rgba(74, 214, 109, 0.32)'; g.fillRect(midX - 30, barY, 60, barH);
    g.fillStyle = '#ffd700'; g.fillRect(midX - 8, barY, 16, barH);
    g.fillStyle = '#ffffff'; g.fillRect(midX - 2, barY, 4, barH);
    // Ruchomy suwak
    const curX = barX + barW * b.bar.pos;
    g.fillStyle = C_WHITE; g.fillRect(curX - 4, barY - 6, 8, barH + 12);
    g.strokeStyle = '#ffd700'; g.lineWidth = 2; g.strokeRect(curX - 4, barY - 6, 8, barH + 12);
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
      g.save();
      drawPixelPortrait(g, 252, 54, getPortraitType(t.name), 'smile', look.color, tick, 4.8);
      g.restore();
    }
    drawDialogueBox(g, e.dialogue, look.color, tick);
  }
}
