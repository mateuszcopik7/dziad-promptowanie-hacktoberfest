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
let uiScale = 1;                    // skala ekranu logicznego 960x600 do rzeczywistych pikseli canvasu
let showMap = 1;                    // minimapa: 0 wylaczona, 1 mala, 2 duza (klawisz M)

// oswietlenie: ciemny budynek, krotki zasieg widzenia (wszystko ginie w ciemnosci), latarka swieci dalej i jasniej w srodku ekranu
const EXPOSURE = 0.78;              // jasnosc bez latarki
const FLASH_EXPOSURE = 1.12;        // jasnosc w srodku stozka latarki
const NEAR = 1.5;                    // do tej odleglosci pelna jasnosc
const FAR = 9;                      // bez latarki wszystko dalej niz to jest czarne
const FAR_FLASH = 16;              // zasieg w stozku latarki
const FOG = 0.03;

// dopasowuje rozdzielczosc canvasu do rozmiaru okna (ostry tekst HUD na kazdym monitorze) i ustawia --u dla menu
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.round(r.width * dpr)), h = Math.max(200, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    document.documentElement.style.setProperty('--u', (r.width / 960) + 'px');
  }
  uiScale = canvas.width / 960;
  sctx.setTransform(uiScale, 0, 0, uiScale, 0, 0);
  sctx.imageSmoothingEnabled = false;
}

function cameraOf(p) {
  const k = Math.tan(settings.fov * Math.PI / 360), dx = Math.cos(p.angle), dy = Math.sin(p.angle);
  return { dirX: dx, dirY: dy, planeX: -dy * k, planeY: dx * k };
}

function shade(c, sh) {
  const r = ((c & 255) * sh) >> 8, g = (((c >> 8) & 255) * sh) >> 8, b = (((c >> 16) & 255) * sh) >> 8;
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

// ekspozycja i zasieg dla kolumny ekranu: w srodku stozka latarki jasniej i dalej
const colExp = new Float32Array(W), colFar = new Float32Array(W);
function setupColumns(g) {
  const fl = g.player.flashlight;
  for (let x = 0; x < W; x++) {
    const off = Math.min(1, Math.abs(2 * x / W - 1) * 1.5), t = fl ? 1 - off * off : 0;
    colExp[x] = EXPOSURE + (FLASH_EXPOSURE - EXPOSURE) * t;
    colFar[x] = FAR + (FAR_FLASH - FAR) * t;
  }
}

// jasnosc 0..256 dla kolumny x i odleglosci dist
function lightCol(x, dist) {
  const fade = Math.max(0, Math.min(1, (colFar[x] - dist) / (colFar[x] - NEAR)));
  return Math.min(256, 256 * colExp[x] * fade / (1 + dist * FOG)) | 0;
}
const lightAt = (g, x, dist) => lightCol(Math.max(0, Math.min(W - 1, x | 0)), dist);

// podloga i sufit z teksturami (casting po wierszach)
function renderFloorCeil(g, cam) {
  const p = g.player, f = g.world.floors[g.floor], set = THEME_SETS[g.floor], mask = edgeMask(g.world, g.floor), mw = f.grid[0].length, mh = f.grid.length;
  const rx0 = cam.dirX - cam.planeX, ry0 = cam.dirY - cam.planeY, rx1 = cam.dirX + cam.planeX, ry1 = cam.dirY + cam.planeY;
  for (let y = H / 2 + 1; y < H; y++) {
    const rowDist = 0.5 * H / (y - H / 2);
    const sx = rowDist * (rx1 - rx0) / W, sy = rowDist * (ry1 - ry0) / W;
    let fx = p.x + rowDist * rx0, fy = p.y + rowDist * ry0;
    const fi = y * W, ci = (H - 1 - y) * W, lvl = rowDist < 2.5 ? 0 : rowDist < 5 ? 1 : rowDist < 8 ? 2 : 3;
    for (let x = 0; x < W; x++, fx += sx, fy += sy) {
      const sh = lightCol(x, rowDist);
      if (sh <= 0) { buf[fi + x] = 0xff000000; buf[ci + x] = 0xff000000; continue; }
      const cx = Math.floor(fx), cy = Math.floor(fy), u = fx - cx, v = fy - cy;
      const inside = cx >= 0 && cy >= 0 && cx < mw && cy < mh;
      buf[fi + x] = shade(inside ? floorColor(set, mask[cy * mw + cx], f.stairCells[cy][cx], u, v, lvl) : set.stripe, sh);
      const c = ceilingColor(set, cx, cy, u, v, lvl);
      buf[ci + x] = c === LED_COLOR ? shade(c, Math.min(256, sh * 2)) : shade(c, sh);        // panele LED swieca mocniej niz sufit
    }
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
    const step = 64 / lineH, lvl = step < 1.2 ? 0 : step < 2.4 ? 1 : step < 4.8 ? 2 : 3, tex = THEME_SETS[g.floor].mips[hit][lvl], msize = 64 >> lvl;
    let tp = (y0 - H / 2 + lineH / 2) * step;
    const sh = (lightAt(g, x, dist) * (side ? 0.8 : 1)) | 0, top = H / 2 - lineH / 2;
    for (let y = y0; y <= y1; y++) {
      // cieniowanie przy suficie i podlodze (ambient occlusion): ciemniej tuz przy krawedziach sciany
      const t = (y - top) / lineH, e = Math.min(t, 1 - t), ao = e < 0.14 ? 0.72 + 0.28 * (e / 0.14) : 1;
      buf[y * W + x] = shade(tex[((tp & 63) >> lvl) * msize + (tx >> lvl)], (sh * ao) | 0);
      tp += step;
    }
  }
}

// lista obiektow do narysowania na biezacym pietrze
function spriteList(g) {
  const fs = g.floors[g.floor], list = [];
  fs.enemies.filter(e => e.alive).forEach(e => list.push({ x: e.x, y: e.y, spr: SPRITES[e.type], scale: ENEMY_TYPES[e.type].scale, hit: e.hit, shadow: true }));
  fs.pickups.forEach(k => list.push({ x: k.x, y: k.y, spr: SPRITES.food, scale: 0.28 }));
  fs.items.forEach(k => list.push({ x: k.x, y: k.y, spr: SPRITES[k.item], scale: 0.3 }));
  g.npcs.filter(n => n.floor === g.floor).forEach(n => {
    const def = g.npcDefs[n.id];
    list.push({ x: n.x, y: n.y, spr: npcSprite(def.look, def.color), scale: (def.look && def.look.scale) || 0.85, name: def.name, shadow: true, marker: npcMarker(g.qs, QUEST_DEFS, g.npcDefs, n.id) });
  });
  g.world.floors[g.floor].decor.forEach(d => {
    if (d.kind === 'bench') list.push({ x: d.x, y: d.y, spr: SPRITES.bench, scale: 0.34 });
    else if (d.kind === 'pufa') list.push({ x: d.x, y: d.y, spr: pufaSprite(d.color), scale: 0.26 });
    else if (d.kind === 'plant') list.push({ x: d.x, y: d.y, spr: SPRITES.plant, scale: 0.55 });
  });
  const seen = new Set();
  g.world.stairs.filter(s => s.floor === g.floor).forEach(s => {
    if (seen.has(s.x + ',' + s.y)) return;
    seen.add(s.x + ',' + s.y);
    const ups = g.world.stairs.some(t => t.floor === g.floor && t.x === s.x && t.y === s.y && t.to[0] > g.floor);
    list.push({ x: s.x + 0.5, y: s.y + 0.5, spr: iconSprite(ups ? 'stairsUp' : 'stairsDown'), scale: 0.9 });
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
    const sh = lightAt(g, Math.max(0, Math.min(W - 1, scrX)), ty);
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      if (ty >= zbuf[x]) continue;
      const tcx = Math.floor((x - x0) * s.spr.w / w);
      for (let y = Math.max(0, y0); y < Math.min(H, floorY); y++) {
        const c = s.spr.data[Math.floor((y - y0) * s.spr.h / h) * s.spr.w + tcx];
        if (!c) continue;
        buf[y * W + x] = s.hit > 0 ? rgb(255, 255, 255) : shade(c, sh);
      }
    }
    if (s.shadow) {                                     // cien kontaktowy pod postacia
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        if (ty >= zbuf[x]) continue;
        for (let y = floorY; y < Math.min(H, floorY + Math.max(1, Math.round(h * 0.07))); y++) buf[y * W + x] = shade(buf[y * W + x], 120);
      }
    }
    if ((s.marker || s.name) && scrX >= 0 && scrX < W && ty < zbuf[scrX]) markers.push({ x: scrX, y: y0 - 3, ch: s.marker || '', name: s.name, ty });
  }
}

// rzut punktu swiata na ekran (kolumna i glebokosc)
function project(cam, p, x, y) {
  const inv = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY), sx = x - p.x, sy = y - p.y;
  const tx = inv * (cam.dirY * sx - cam.dirX * sy), ty = inv * (-cam.planeY * sx + cam.planeX * sy);
  return { scrX: Math.floor(W / 2 * (1 + tx / ty)), ty };
}

// etykiety drzwi sal i schodow widoczne w polu widzenia
let labels = [];
function collectLabels(g, cam) {
  labels = [];
  const p = g.player, F = g.world.floors[g.floor], seen = new Set();
  for (const door of Object.values(F.doors)) {
    if (seen.has(door.id)) continue;
    seen.add(door.id);
    const c = doorCenter(door), pr = project(cam, p, c.x, c.y);
    if (pr.ty < 0.8 || pr.ty > 14 || pr.scrX < 0 || pr.scrX >= W || pr.ty > zbuf[pr.scrX] + 1.1) continue;
    const L = doorLabel(g, door);
    labels.push({ x: pr.scrX, y: H / 2 - 0.55 * H / pr.ty, ty: pr.ty, text: L.text, sub: L.sub, color: L.color });
  }
  const done = new Set();
  g.world.stairs.filter(s => s.floor === g.floor).forEach(s => {
    const key = s.x + ',' + s.y;
    if (done.has(key)) return;
    done.add(key);
    const pr = project(cam, p, s.x + 0.5, s.y + 0.5);
    if (pr.ty < 0.8 || pr.ty > 18 || pr.scrX < 0 || pr.scrX >= W || pr.ty > zbuf[pr.scrX] + 1.1) return;
    const dests = g.world.stairs.filter(t => t.floor === g.floor && t.x === s.x && t.y === s.y).map(t => g.world.floors[t.to[0]].name).join(' / ');
    labels.push({ x: pr.scrX, y: H / 2 - 0.25 * H / pr.ty, ty: pr.ty, text: 'SCHODY', sub: dests, color: '#4ad66d' });
  });
}

// rece i pistolet z js/weapon-art.js (latarka nie ma modelu: F tylko zmienia oswietlenie)
function drawFirstPerson(g) {
  const p = g.player, bob = g.moving ? Math.sin(g.walk * 0.22) * 2.5 : 0;
  if (p.weapon) drawPistol(lctx, W, H, g.flash > 0 ? 4 : 0, g.flash, bob);
  else drawHands(lctx, W, H, bob, 0);
  if (p.weapon) { lctx.fillStyle = '#fff'; lctx.fillRect(W / 2 - 1, H / 2 - 4, 2, 8); lctx.fillRect(W / 2 - 4, H / 2 - 1, 8, 2); }
}

function hudText(str, x, y, color, align = 'left') {
  sctx.textAlign = align; sctx.lineJoin = 'round'; sctx.lineWidth = 5; sctx.strokeStyle = 'rgba(0,0,0,.9)';
  sctx.strokeText(str, x, y);                          // czarny obrys: czytelne na kazdym tle
  sctx.fillStyle = color; sctx.fillText(str, x, y);
}

function hudBar(x, y, w, frac, color) {
  sctx.fillStyle = 'rgba(255,255,255,.18)'; sctx.fillRect(x, y, w, 7);
  sctx.fillStyle = color; sctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 7);
}

// tekst na ciemnej plakietce: czytelny na kazdym tle
function pill(str, x, y, color, size, align = 'center') {
  sctx.font = `bold ${size}px monospace`;
  const w = sctx.measureText(str).width + 18, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  sctx.fillStyle = 'rgba(6,8,16,.82)'; sctx.fillRect(x0, y - size - 2, w, size + 12);
  sctx.fillStyle = color; sctx.textAlign = 'left'; sctx.fillText(str, x0 + 9, y + 2);
}

function drawMinimap(g, objective) {
  const big = showMap === 2, c = big ? 6 : 3, gw = g.grid[0].length * c, gh = g.grid.length * c, p = g.player;
  const x0 = big ? Math.floor((W * SCALE - gw) / 2) : W * SCALE - gw - 10, y0 = big ? 100 : 112;
  sctx.fillStyle = big ? 'rgba(0,0,0,.82)' : 'rgba(0,0,0,.6)'; sctx.fillRect(x0 - 4, y0 - 4, gw + 8, gh + 8);
  g.grid.forEach((row, y) => row.forEach((v, x) => {
    if (!v) return;
    sctx.fillStyle = v === 4 ? '#e0903a' : '#6d6d7e';
    sctx.fillRect(x0 + x * c, y0 + y * c, c, c);
  }));
  g.world.floors[g.floor].stairCells.forEach((row, y) => row.forEach((v, x) => {
    if (v) { sctx.fillStyle = 'rgba(74,214,109,.4)'; sctx.fillRect(x0 + x * c, y0 + y * c, c, c); }
  }));
  const dot = (x, y, color, r) => { sctx.fillStyle = color; sctx.fillRect(x0 + x * c - r, y0 + y * c - r, 2 * r + 1, 2 * r + 1); };
  g.npcs.filter(n => n.floor === g.floor).forEach(n => dot(n.x, n.y, '#7cc4ff', big ? 2 : 1));
  g.floors[g.floor].enemies.forEach(e => { if (e.alive) dot(e.x, e.y, '#ff5555', big ? 2 : 1); });
  if (objective && objective.floor === g.floor) {                      // pulsujacy znacznik celu
    const pulse = 2 + Math.abs(Math.sin(g.ticks / 12)) * 3;
    sctx.strokeStyle = '#ffe600'; sctx.lineWidth = 2; sctx.beginPath(); sctx.arc(x0 + objective.x * c, y0 + objective.y * c, pulse + (big ? 3 : 1), 0, 7); sctx.stroke();
  }
  const stairsSeen = new Set();
  g.world.stairs.filter(t => t.floor === g.floor).forEach(t => {
    const key = t.x + ',' + t.y;
    if (stairsSeen.has(key)) return;
    stairsSeen.add(key);
    drawIcon(sctx, g.world.stairs.some(u => u.floor === g.floor && u.x === t.x && u.y === t.y && u.to[0] > g.floor) ? 'stairsUp' : 'stairsDown', x0 + t.x * c - (big ? 8 : 6), y0 + t.y * c - (big ? 8 : 6), big ? 1 : 0.75);
  });
  dot(p.x, p.y, '#4ad66d', big ? 3 : 2);
  sctx.strokeStyle = '#4ad66d'; sctx.lineWidth = 1; sctx.beginPath();
  sctx.moveTo(x0 + p.x * c, y0 + p.y * c);
  sctx.lineTo(x0 + (p.x + Math.cos(p.angle) * 3) * c, y0 + (p.y + Math.sin(p.angle) * 3) * c);
  sctx.stroke();
  sctx.font = 'bold 14px monospace';
  hudText(big ? 'MAPA: ' + g.world.floors[g.floor].name + '  (M: zmień rozmiar)' : g.world.floors[g.floor].name, x0, y0 - 8, '#ddd');
  if (big) {
    hudText('Ty', x0, y0 + gh + 18, '#4ad66d'); hudText('NPC', x0 + 40, y0 + gh + 18, '#7cc4ff');
    hudText('Wróg', x0 + 90, y0 + gh + 18, '#ff5555'); hudText('Drzwi sal', x0 + 140, y0 + gh + 18, '#e0903a');
    hudText('Cel', x0 + 230, y0 + gh + 18, '#ffe600'); hudText('Schody', x0 + 280, y0 + gh + 18, '#4ad66d');
  }
}

// strzalka kompasu wskazuje cel wzgledem kierunku patrzenia
function drawArrow(cx, cy, rel, size, color) {
  sctx.save(); sctx.translate(cx, cy); sctx.rotate(rel);
  sctx.fillStyle = color; sctx.strokeStyle = '#000'; sctx.lineWidth = 2;
  sctx.beginPath(); sctx.moveTo(0, -size); sctx.lineTo(size * 0.7, size * 0.7); sctx.lineTo(0, size * 0.3); sctx.lineTo(-size * 0.7, size * 0.7); sctx.closePath();
  sctx.stroke(); sctx.fill(); sctx.restore();
}

function drawObjective(g, o) {
  const bw = W * SCALE, pw = 640, ph = 84, px = (bw - pw) / 2, py = 10;
  sctx.fillStyle = 'rgba(6,8,16,.88)'; sctx.fillRect(px, py, pw, ph);
  sctx.strokeStyle = '#ffe600'; sctx.lineWidth = 3; sctx.strokeRect(px, py, pw, ph);
  sctx.font = 'bold 14px monospace'; hudText('CEL', px + 92, py + 20, '#ffe600');
  sctx.font = 'bold 19px monospace';
  const words = o.text.split(' '), lines = [''];
  for (const w of words) { if ((lines[lines.length - 1] + w).length > 44) lines.push(''); lines[lines.length - 1] += w + ' '; }
  lines.slice(0, 2).forEach((l, i) => hudText(l, px + 92, py + 45 + i * 24, '#fff'));
  if (o.dist > 1.8) { drawArrow(px + 44, py + 38, o.rel, 24, '#ffe600'); sctx.font = 'bold 16px monospace'; hudText(Math.round(o.dist) + ' m', px + 44, py + 76, '#ffe600', 'center'); }
  else { sctx.font = 'bold 18px monospace'; hudText('TU', px + 44, py + 46, '#4ad66d', 'center'); }
}

function drawQuestTracker(g) {
  const tr = trackedQuests(g.qs, QUEST_DEFS, g.npcDefs);
  if (!tr.length) return;
  const y0 = 106, hgt = 44 + tr.length * 28;
  sctx.fillStyle = 'rgba(6,8,16,.82)'; sctx.fillRect(10, y0, 430, hgt);
  sctx.font = 'bold 16px monospace'; hudText('ZADANIA', 20, y0 + 24, '#ffe600');
  sctx.font = 'bold 15px monospace';
  tr.forEach((t, i) => hudText((t.ready ? '[ok] ' : '[ ] ') + t.title + ': ' + t.text, 20, y0 + 52 + i * 28, t.ready ? '#4ad66d' : '#fff'));
}

function drawHints(g) {
  if (g.ticks > 1800) return;
  const a = Math.min(1, (1800 - g.ticks) / 300), y = H * SCALE - 160;
  sctx.globalAlpha = a;
  sctx.fillStyle = 'rgba(6,8,16,.82)'; sctx.fillRect(10, y - 34, 470, 120);
  sctx.font = 'bold 16px monospace'; hudText('STEROWANIE', 20, y - 8, '#ffe600');
  sctx.font = 'bold 15px monospace';
  hudText('WASD: ruch     mysz / strzałki: rozglądanie', 20, y + 18, '#fff');
  hudText('E: rozmowa     F: latarka     H: kanapka', 20, y + 42, '#fff');
  hudText('M: mapa        Esc: pauza', 20, y + 66, '#fff');
  sctx.globalAlpha = 1;
}

function drawHud(g) {
  const p = g.player, bw = W * SCALE, bar = 56, y = H * SCALE - bar, o = objectiveOf(g);
  if (g.hurt > 0) { sctx.fillStyle = `rgba(200,0,0,${g.hurt / 20})`; sctx.fillRect(0, 0, bw, H * SCALE); }
  // etykiety w swiecie: drzwi, schody, imiona NPC (min. 15 px, rosna przy zblizaniu)
  for (const l of labels) {
    const size = Math.max(15, Math.min(24, Math.round(34 - l.ty * 1.6))), sx = l.x * SCALE, sy = l.y * SCALE;
    pill(l.text, sx, sy - size - 8, '#fff', size);
    pill(l.sub, sx, sy - 2, l.color, Math.max(14, size - 3));
  }
  for (const m of markers) {
    if (m.name && m.ty < 6) pill(m.name, m.x * SCALE, m.y * SCALE - (m.ch ? 44 : 6), '#fff', 17);
    if (m.ch) { sctx.font = 'bold 38px monospace'; hudText(m.ch, m.x * SCALE, m.y * SCALE - 4, m.ch === '?' ? '#4ad66d' : m.ch === '>' ? '#7cc4ff' : '#ffe600', 'center'); }
  }
  // pasek statusu
  sctx.fillStyle = 'rgba(0,0,0,.78)'; sctx.fillRect(0, y, bw, bar);
  sctx.font = 'bold 22px monospace';
  hudText('HP ' + p.hp + '/' + p.maxHp, 16, y + 25, '#ff6b6b');
  hudBar(16, y + 36, 180, p.hp / p.maxHp, '#ff6b6b');
  hudText('LVL ' + p.level, 230, y + 25, '#7cc4ff');
  hudBar(230, y + 36, 150, p.xp / xpNeeded(p.level), '#7cc4ff');
  hudText('KANAPKI ' + g.food, 420, y + 25, '#ffd166');
  if (p.weapon) hudText('AMMO ' + p.ammo, 620, y + 25, '#ffd166');
  sctx.font = 'bold 18px monospace';
  hudText(g.world.floors[g.floor].name.toUpperCase(), bw - 16, y + 24, '#fff', 'right');
  sctx.font = 'bold 14px monospace';
  hudText(p.flashlight ? 'F: latarka ON' : 'F: latarka', bw - 16, y + 46, p.flashlight ? '#ffe9a8' : '#aaa', 'right');
  if (g.prompt) pill(g.prompt, bw / 2, y - 24, '#fff', 21);
  if (g.msgT > 0) {
    sctx.globalAlpha = Math.min(1, g.msgT / 30);
    pill(g.msg, bw / 2, 190, '#7cc4ff', 32);
    sctx.globalAlpha = 1;
  }
  drawObjective(g, o);
  drawQuestTracker(g);
  drawHints(g);
  if (showMap) drawMinimap(g, o);
}

// delikatna winieta ciemniejaca rogi ekranu
let vignette = null;
function drawVignette() {
  if (!vignette) {
    vignette = sctx.createRadialGradient(W * SCALE / 2, H * SCALE / 2, H * SCALE * 0.35, W * SCALE / 2, H * SCALE / 2, W * SCALE * 0.62);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.38)');
  }
  sctx.fillStyle = vignette; sctx.fillRect(0, 0, W * SCALE, H * SCALE);
}

function render(g, withHud) {
  fitCanvas();
  const cam = cameraOf(g.player);
  setupColumns(g); renderFloorCeil(g, cam); renderWalls(g, cam); renderSprites(g, cam);
  collectLabels(g, cam);
  lctx.putImageData(img, 0, 0);
  drawFirstPerson(g);
  sctx.drawImage(low, 0, 0, W * SCALE, H * SCALE);
  drawVignette();
  if (withHud) drawHud(g);
}
