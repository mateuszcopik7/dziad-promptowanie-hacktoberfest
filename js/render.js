// raycaster + HUD. Czyta stan gry, niczego w nim nie zmienia.
const W = 320, H = 200;             // rozdzielczosc wewnetrzna
const SCALE = 3;
const canvas = document.getElementById('screen');
const sctx = canvas.getContext('2d');
sctx.imageSmoothingEnabled = false;
const low = document.createElement('canvas');
low.width = W; low.height = H;
const lctx = low.getContext('2d');
const img = lctx.createImageData(W, H);
const buf = new Uint32Array(img.data.buffer);
const zbuf = new Float32Array(W);
let showMap = true;

const AMBIENT_K = 0.2;              // im wiecej, tym szybciej robi sie ciemno z odlegloscia
const FLASH_K = 0.05;               // ten sam wspolczynnik w stozku latarki

function cameraOf(p) {
  const k = Math.tan(settings.fov * Math.PI / 360), dx = Math.cos(p.angle), dy = Math.sin(p.angle);
  return { dirX: dx, dirY: dy, planeX: -dy * k, planeY: dx * k };
}

function shade(c, sh) {
  const r = ((c & 255) * sh) >> 8, g = (((c >> 8) & 255) * sh) >> 8, b = (((c >> 16) & 255) * sh) >> 8;
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

// wspolczynnik zaciemnienia dla kolumny ekranu: latarka rozjasnia srodek
function lightK(g, x) {
  if (!g.player.flashlight) return AMBIENT_K;
  const off = Math.min(1, Math.abs(2 * x / W - 1) * 1.6);
  return FLASH_K + (AMBIENT_K - FLASH_K) * off * off;
}

function renderFlat(g) {
  const fl = g.player.flashlight;
  for (let y = 0; y < H; y++) {
    let c;
    if (y < H / 2) {
      const t = y / (H / 2);
      c = rgb(clamp(16 + t * 26), clamp(20 + t * 26), clamp(34 + t * 28));
    } else {
      const d = 0.5 * H / (y - H / 2 + 1);
      const sh = Math.min(256, 256 / (1 + d * (fl ? 0.12 : 0.28)));
      c = shade(rgb(105, 100, 96), sh | 0);
    }
    buf.fill(c, y * W, (y + 1) * W);
  }
}

function renderWalls(g, cam) {
  const p = g.player;
  for (let x = 0; x < W; x++) {
    const k = 2 * x / W - 1;
    const rdx = cam.dirX + cam.planeX * k, rdy = cam.dirY + cam.planeY * k;
    let mapX = Math.floor(p.x), mapY = Math.floor(p.y);
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (p.x - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - p.x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (p.y - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - p.y) * ddy; }
    let side = 0, hit = 0;
    while (!hit) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
      hit = wallAt(g.grid, mapX, mapY);
    }
    const dist = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = dist;
    const lineH = Math.floor(H / dist);
    const y0 = Math.max(0, Math.floor(-lineH / 2 + H / 2)), y1 = Math.min(H - 1, Math.floor(lineH / 2 + H / 2));
    let wx = side === 0 ? p.y + dist * rdy : p.x + dist * rdx;
    wx -= Math.floor(wx);
    let tx = Math.floor(wx * 64);
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = 63 - tx;
    const tex = TEX[hit], step = 64 / lineH;
    let tp = (y0 - H / 2 + lineH / 2) * step;
    const sh = Math.min(256, (256 / (1 + dist * lightK(g, x))) * (side ? 0.72 : 1)) | 0;
    for (let y = y0; y <= y1; y++) {
      buf[y * W + x] = shade(tex[(tp & 63) * 64 + tx], sh);
      tp += step;
    }
  }
}

// lista obiektow do narysowania na biezacym pietrze
function spriteList(g) {
  const fs = g.floors[g.floor], list = [];
  fs.enemies.filter(e => e.alive).forEach(e => list.push({ x: e.x, y: e.y, spr: SPRITES[e.type], scale: ENEMY_TYPES[e.type].scale, hit: e.hit }));
  fs.pickups.forEach(k => list.push({ x: k.x, y: k.y, spr: SPRITES.food, scale: 0.28 }));
  fs.items.forEach(k => list.push({ x: k.x, y: k.y, spr: SPRITES[k.item], scale: 0.3 }));
  g.npcs.filter(n => n.floor === g.floor).forEach(n => {
    const def = g.npcDefs[n.id];
    list.push({ x: n.x, y: n.y, spr: npcSprite(def.color), scale: 0.85, marker: npcMarker(g.qs, QUEST_DEFS, g.npcDefs, n.id) });
  });
  const seen = new Set();
  g.world.stairs.filter(s => s.floor === g.floor).forEach(s => {
    if (seen.has(s.x + ',' + s.y)) return;
    seen.add(s.x + ',' + s.y);
    list.push({ x: s.x + 0.5, y: s.y + 0.5, spr: SPRITES.stairs, scale: 0.4 });
  });
  return list;
}

let markers = [];
function renderSprites(g, cam) {
  const p = g.player, list = spriteList(g);
  markers = [];
  for (const s of list) s.d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
  list.sort((a, b) => b.d - a.d);
  const inv = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY);
  for (const s of list) {
    const sx = s.x - p.x, sy = s.y - p.y;
    const tx = inv * (cam.dirY * sx - cam.dirX * sy);
    const ty = inv * (-cam.planeY * sx + cam.planeX * sy);
    if (ty <= 0.15) continue;
    const scrX = Math.floor(W / 2 * (1 + tx / ty));
    const h = Math.abs(Math.floor(H / ty * s.scale));
    const w = Math.floor(h * s.spr.w / s.spr.h);
    const floorY = Math.floor(H / 2 + H / ty / 2);
    const y0 = floorY - h, x0 = scrX - (w >> 1);
    const sh = Math.min(256, 256 / (1 + ty * lightK(g, Math.max(0, Math.min(W - 1, scrX))))) | 0;
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      if (ty >= zbuf[x]) continue;
      const tcx = Math.floor((x - x0) * s.spr.w / w);
      for (let y = Math.max(0, y0); y < Math.min(H, floorY); y++) {
        const c = s.spr.data[Math.floor((y - y0) * s.spr.h / h) * s.spr.w + tcx];
        if (!c) continue;
        buf[y * W + x] = s.hit > 0 ? rgb(255, 255, 255) : shade(c, sh);
      }
    }
    if (s.marker && scrX >= 0 && scrX < W && ty < zbuf[scrX]) markers.push({ x: scrX, y: y0 - 3, ch: s.marker });
  }
}

// rece, pistolet i latarka z js/weapon-art.js
function drawFirstPerson(g) {
  const p = g.player, bob = g.moving ? Math.sin(g.walk * 0.22) * 2.5 : 0;
  if (p.weapon) drawPistol(lctx, W, H, g.flash > 0 ? 4 : 0, g.flash, bob);
  else drawHands(lctx, W, H, bob, 0);
  if (p.flashlight) drawFlashlight(lctx, W, H, true, bob);
  if (p.weapon) { lctx.fillStyle = '#fff'; lctx.fillRect(W / 2 - 1, H / 2 - 4, 2, 8); lctx.fillRect(W / 2 - 4, H / 2 - 1, 8, 2); }
}

function hudText(str, x, y, color, align = 'left') {
  sctx.textAlign = align; sctx.fillStyle = color; sctx.fillText(str, x, y);
}

function hudBar(x, y, w, frac, color) {
  sctx.fillStyle = 'rgba(255,255,255,.18)'; sctx.fillRect(x, y, w, 7);
  sctx.fillStyle = color; sctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 7);
}

function drawMinimap(g) {
  const c = 3, gw = g.grid[0].length * c, gh = g.grid.length * c, x0 = W * SCALE - gw - 10, y0 = 10, p = g.player;
  sctx.fillStyle = 'rgba(0,0,0,.6)'; sctx.fillRect(x0 - 3, y0 - 3, gw + 6, gh + 6);
  g.grid.forEach((row, y) => row.forEach((v, x) => {
    if (!v) return;
    sctx.fillStyle = v === 4 ? '#c8873a' : '#6d6d7e';
    sctx.fillRect(x0 + x * c, y0 + y * c, c, c);
  }));
  g.world.floors[g.floor].stairCells.forEach((row, y) => row.forEach((v, x) => {
    if (v) { sctx.fillStyle = 'rgba(74,214,109,.35)'; sctx.fillRect(x0 + x * c, y0 + y * c, c, c); }
  }));
  sctx.fillStyle = '#7cc4ff';
  g.npcs.filter(n => n.floor === g.floor).forEach(n => sctx.fillRect(x0 + n.x * c - 1, y0 + n.y * c - 1, 3, 3));
  sctx.fillStyle = '#ff5555';
  g.floors[g.floor].enemies.forEach(e => { if (e.alive) sctx.fillRect(x0 + e.x * c - 1, y0 + e.y * c - 1, 3, 3); });
  sctx.fillStyle = '#4ad66d'; sctx.fillRect(x0 + p.x * c - 2, y0 + p.y * c - 2, 4, 4);
  sctx.strokeStyle = '#4ad66d'; sctx.beginPath();
  sctx.moveTo(x0 + p.x * c, y0 + p.y * c);
  sctx.lineTo(x0 + (p.x + Math.cos(p.angle) * 3) * c, y0 + (p.y + Math.sin(p.angle) * 3) * c);
  sctx.stroke();
}

function drawQuestTracker(g) {
  const tr = trackedQuests(g.qs, QUEST_DEFS, g.npcDefs);
  if (!tr.length) return;
  sctx.font = 'bold 13px monospace'; hudText('ZADANIA', 14, 22, '#ffe600');
  sctx.font = '13px monospace';
  tr.forEach((t, i) => hudText(t.title + ': ' + t.text, 14, 42 + i * 18, t.ready ? '#4ad66d' : '#fff'));
}

function drawHud(g) {
  const p = g.player, bw = W * SCALE, y = H * SCALE - 44;
  if (g.hurt > 0) { sctx.fillStyle = `rgba(200,0,0,${g.hurt / 20})`; sctx.fillRect(0, 0, bw, H * SCALE); }
  sctx.fillStyle = 'rgba(0,0,0,.65)'; sctx.fillRect(0, y, bw, 44);
  sctx.font = 'bold 18px monospace';
  hudText('HP ' + p.hp + '/' + p.maxHp, 16, y + 20, '#ff6b6b');
  hudBar(16, y + 28, 150, p.hp / p.maxHp, '#ff6b6b');
  hudText('LVL ' + p.level, 200, y + 20, '#7cc4ff');
  hudBar(200, y + 28, 130, p.xp / xpNeeded(p.level), '#7cc4ff');
  hudText('KANAPKI ' + g.food, 360, y + 20, '#ffd166');
  if (p.weapon) hudText('AMMO ' + p.ammo, 540, y + 20, '#ffd166');
  sctx.font = '14px monospace';
  hudText(g.world.floors[g.floor].name, bw - 16, y + 20, '#aaa', 'right');
  hudText(p.flashlight ? 'F: latarka ON' : 'F: latarka', bw - 16, y + 38, p.flashlight ? '#ffe9a8' : '#777', 'right');
  if (g.msgT > 0) {
    sctx.font = 'bold 34px monospace';
    sctx.globalAlpha = Math.min(1, g.msgT / 30);
    hudText(g.msg, bw / 2, 110, '#7cc4ff', 'center');
    sctx.globalAlpha = 1;
  }
  if (g.prompt) { sctx.font = 'bold 18px monospace'; hudText(g.prompt, bw / 2, y - 14, '#fff', 'center'); }
  sctx.font = 'bold 28px monospace';
  for (const m of markers) hudText(m.ch, m.x * SCALE, m.y * SCALE, m.ch === '?' ? '#4ad66d' : '#ffe600', 'center');
  drawQuestTracker(g);
  if (showMap) drawMinimap(g);
}

function render(g, withHud) {
  const cam = cameraOf(g.player);
  renderFlat(g); renderWalls(g, cam); renderSprites(g, cam);
  lctx.putImageData(img, 0, 0);
  drawFirstPerson(g);
  sctx.drawImage(low, 0, 0, W * SCALE, H * SCALE);
  if (withHud) drawHud(g);
}
