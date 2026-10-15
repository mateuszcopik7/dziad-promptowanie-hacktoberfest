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

function cameraOf(p) {
  const k = Math.tan(settings.fov * Math.PI / 360), dx = Math.cos(p.angle), dy = Math.sin(p.angle);
  return { dirX: dx, dirY: dy, planeX: -dy * k, planeY: dx * k };
}

function shade(c, sh) {
  const r = ((c & 255) * sh) >> 8, g = (((c >> 8) & 255) * sh) >> 8, b = (((c >> 16) & 255) * sh) >> 8;
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function renderFlat() {
  for (let y = 0; y < H; y++) {
    let c;
    if (y < H / 2) {
      const t = y / (H / 2);
      c = rgb(clamp(20 + t * 30), clamp(24 + t * 30), clamp(40 + t * 30));
    } else {
      const d = 0.5 * H / (y - H / 2 + 1);
      const sh = Math.min(256, 256 / (1 + d * 0.25));
      c = shade(rgb(95, 95, 105), sh | 0);
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
    const sh = Math.min(256, (256 / (1 + dist * 0.14)) * (side ? 0.72 : 1)) | 0;
    for (let y = y0; y <= y1; y++) {
      buf[y * W + x] = shade(tex[(tp & 63) * 64 + tx], sh);
      tp += step;
    }
  }
}

function renderSprites(g, cam) {
  const p = g.player;
  const list = [
    ...g.enemies.filter(e => e.alive).map(e => ({ x: e.x, y: e.y, spr: SPRITES[e.type], scale: ENEMY_TYPES[e.type].scale, hit: e.hit })),
    ...g.pickups.map(k => ({ x: k.x, y: k.y, spr: SPRITES[k.kind], scale: 0.28, hit: 0 })),
  ];
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
    const sh = Math.min(256, 256 / (1 + ty * 0.14)) | 0;
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      if (ty >= zbuf[x]) continue;
      const tcx = Math.floor((x - x0) * s.spr.w / w);
      for (let y = Math.max(0, y0); y < Math.min(H, floorY); y++) {
        let c = s.spr.data[Math.floor((y - y0) * s.spr.h / h) * s.spr.w + tcx];
        if (!c) continue;
        buf[y * W + x] = s.hit > 0 ? rgb(255, 255, 255) : shade(c, sh);
      }
    }
  }
}

function drawGun(g) {
  const kick = g.flash > 0 ? 6 : 0, cx = W / 2, by = H + kick;
  lctx.fillStyle = '#2b2b33'; lctx.fillRect(cx - 14, by - 46, 28, 46);
  lctx.fillStyle = '#44444f'; lctx.fillRect(cx - 9, by - 62, 18, 20);
  lctx.fillStyle = '#6a6a78'; lctx.fillRect(cx - 4, by - 70, 8, 12);
  lctx.fillStyle = '#4ad66d'; lctx.fillRect(cx - 12, by - 30, 24, 3);
  if (g.flash > 0) {
    lctx.fillStyle = '#ffe066'; lctx.fillRect(cx - 6, by - 84, 12, 14);
    lctx.fillStyle = '#fff'; lctx.fillRect(cx - 3, by - 80, 6, 8);
  }
  lctx.fillStyle = '#fff'; lctx.fillRect(cx - 1, H / 2 - 4, 2, 8); lctx.fillRect(cx - 4, H / 2 - 1, 8, 2);
}

function hudText(str, x, y, color, align = 'left') {
  sctx.textAlign = align; sctx.fillStyle = color; sctx.fillText(str, x, y);
}

function hudBar(x, y, w, frac, color) {
  sctx.fillStyle = 'rgba(255,255,255,.18)'; sctx.fillRect(x, y, w, 7);
  sctx.fillStyle = color; sctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 7);
}

function drawMinimap(g) {
  const c = 5, gw = g.grid[0].length * c, gh = g.grid.length * c, x0 = W * SCALE - gw - 12, y0 = 12, p = g.player;
  sctx.fillStyle = 'rgba(0,0,0,.55)'; sctx.fillRect(x0 - 3, y0 - 3, gw + 6, gh + 6);
  sctx.fillStyle = '#8a8a99';
  g.grid.forEach((row, y) => row.forEach((v, x) => { if (v) sctx.fillRect(x0 + x * c, y0 + y * c, c, c); }));
  sctx.fillStyle = '#ffd166';
  for (const k of g.pickups) sctx.fillRect(x0 + k.x * c - 1, y0 + k.y * c - 1, 3, 3);
  sctx.fillStyle = '#ff5555';
  for (const e of g.enemies) if (e.alive) sctx.fillRect(x0 + e.x * c - 2, y0 + e.y * c - 2, 4, 4);
  sctx.fillStyle = '#4ad66d'; sctx.fillRect(x0 + p.x * c - 2, y0 + p.y * c - 2, 4, 4);
  sctx.strokeStyle = '#4ad66d'; sctx.beginPath();
  sctx.moveTo(x0 + p.x * c, y0 + p.y * c);
  sctx.lineTo(x0 + (p.x + Math.cos(p.angle) * 1.5) * c, y0 + (p.y + Math.sin(p.angle) * 1.5) * c);
  sctx.stroke();
}

function drawHud(g) {
  const p = g.player, bw = W * SCALE, y = H * SCALE - 44;
  if (g.hurt > 0) { sctx.fillStyle = `rgba(200,0,0,${g.hurt / 20})`; sctx.fillRect(0, 0, bw, H * SCALE); }
  sctx.fillStyle = 'rgba(0,0,0,.65)'; sctx.fillRect(0, y, bw, 44);
  sctx.font = 'bold 18px monospace';
  hudText('HP ' + p.hp + '/' + p.maxHp, 16, y + 20, '#ff6b6b');
  hudBar(16, y + 28, 150, p.hp / p.maxHp, '#ff6b6b');
  hudText('AMMO ' + p.ammo, 200, y + 20, '#ffd166');
  hudText('LVL ' + p.level, 340, y + 20, '#7cc4ff');
  hudBar(340, y + 28, 150, p.xp / xpNeeded(p.level), '#7cc4ff');
  hudText('BUGI ' + g.kills + '/' + g.total, 530, y + 20, '#4ad66d');
  sctx.font = '14px monospace';
  hudText(g.name, bw - 16, y + 20, '#aaa', 'right');
  if (g.msgT > 0) {
    sctx.font = 'bold 40px monospace';
    sctx.globalAlpha = Math.min(1, g.msgT / 30);
    hudText(g.msg, bw / 2, 110, '#7cc4ff', 'center');
    sctx.globalAlpha = 1;
  }
  if (showMap) drawMinimap(g);
}

function render(g, withHud) {
  const cam = cameraOf(g.player);
  renderFlat(); renderWalls(g, cam); renderSprites(g, cam);
  lctx.putImageData(img, 0, 0);
  drawGun(g);
  sctx.drawImage(low, 0, 0, W * SCALE, H * SCALE);
  if (withHud) drawHud(g);
}
