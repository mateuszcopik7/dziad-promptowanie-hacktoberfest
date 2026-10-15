(function (global) {
  'use strict';

  const OUTLINE = '#151923';
  const SKIN_DARK = '#7b5149';
  const SKIN = '#b77a68';
  const SKIN_LIGHT = '#d39a82';
  const SLEEVE_DARK = '#262d3a';
  const SLEEVE = '#465268';
  const SLEEVE_LIGHT = '#65738b';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function box(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawSleeve(ctx, x, y, side, scale) {
    const s = scale;
    const dx = side * 2 * s;
    box(ctx, OUTLINE, x - 13 * s + dx, y + 17 * s, 26 * s, 28 * s);
    box(ctx, SLEEVE_DARK, x - 10 * s + dx, y + 18 * s, 20 * s, 27 * s);
    box(ctx, SLEEVE, x - 8 * s + dx, y + 18 * s, 15 * s, 27 * s);
    box(ctx, SLEEVE_LIGHT, x - 6 * s + dx, y + 20 * s, 4 * s, 23 * s);
    box(ctx, OUTLINE, x - 13 * s, y + 15 * s, 26 * s, 6 * s);
    box(ctx, SLEEVE, x - 10 * s, y + 16 * s, 20 * s, 3 * s);
  }

  function drawFist(ctx, x, y, side, scale) {
    const s = scale;
    drawSleeve(ctx, x, y, side, s);

    // Kontur dloni i schodkowy zarys palcow.
    box(ctx, OUTLINE, x - 14 * s, y - 5 * s, 28 * s, 24 * s);
    box(ctx, OUTLINE, x - 11 * s, y - 10 * s, 22 * s, 7 * s);
    box(ctx, OUTLINE, x - 17 * s, y + 2 * s, 5 * s, 13 * s);
    box(ctx, OUTLINE, x + 12 * s, y + 2 * s, 5 * s, 13 * s);
    box(ctx, SKIN_DARK, x - 12 * s, y - 3 * s, 24 * s, 20 * s);
    box(ctx, SKIN, x - 9 * s, y - 8 * s, 18 * s, 7 * s);
    box(ctx, SKIN, x - 15 * s, y + 3 * s, 5 * s, 10 * s);
    box(ctx, SKIN, x + 10 * s, y + 3 * s, 5 * s, 10 * s);
    box(ctx, SKIN_LIGHT, x - 8 * s, y - 6 * s, 5 * s, 15 * s);
    box(ctx, SKIN, x - 7 * s, y + 8 * s, 14 * s, 7 * s);

    // Linie zlozonych palcow.
    box(ctx, SKIN_DARK, x - 10 * s, y + 1 * s, 20 * s, 2 * s);
    box(ctx, SKIN_DARK, x - 5 * s, y - 6 * s, 2 * s, 8 * s);
    box(ctx, SKIN_DARK, x + 2 * s, y - 6 * s, 2 * s, 8 * s);
    box(ctx, OUTLINE, x - 7 * s, y + 15 * s, 14 * s, 3 * s);
  }

  function drawGunHand(ctx, x, baseY) {
    box(ctx, OUTLINE, x - 14, baseY - 34, 29, 38);
    box(ctx, SKIN_DARK, x - 11, baseY - 32, 23, 34);
    box(ctx, SKIN, x - 8, baseY - 31, 17, 32);
    box(ctx, SKIN_LIGHT, x - 6, baseY - 29, 5, 24);
    box(ctx, SLEEVE_DARK, x - 16, baseY - 6, 33, 10);
    box(ctx, SLEEVE, x - 12, baseY - 5, 25, 9);
  }

  function drawGunThumb(ctx, x, baseY) {
    // Kciuk obejmuje prawa strone chwytu.
    box(ctx, OUTLINE, x + 7, baseY - 31, 10, 17);
    box(ctx, SKIN_DARK, x + 8, baseY - 29, 7, 13);
    box(ctx, SKIN, x + 7, baseY - 28, 6, 10);
  }

  function drawMuzzleFlash(ctx, x, y, frame) {
    const flare = 2 + Math.min(4, frame);
    box(ctx, '#f59f00', x - 5, y - 8 - flare, 10, 11 + flare);
    box(ctx, '#ffe066', x - 10, y - 4 - flare, 20, 5 + flare);
    box(ctx, '#ffe066', x - 3, y - 14 - flare, 6, 16 + flare);
    box(ctx, '#fff7d6', x - 4, y - 7 - flare, 8, 8 + flare);
    box(ctx, '#ffffff', x - 2, y - 5 - flare, 4, 5 + flare);
  }

  function drawHands(ctx, W, H, bob, punch) {
    ctx.save();
    const cx = W / 2;
    const bounce = clamp(Number(bob) || 0, -3, 3);
    const hit = clamp(Number(punch) || 0, 0, 1);
    const baseY = H - 36 + bounce;

    drawFist(ctx, cx - 53, baseY, -1, 1);
    drawFist(ctx, cx + 53 - hit * 12, baseY - hit * 43, 1, 1 + hit * 0.34);
    ctx.restore();
  }

  function drawPistol(ctx, W, H, kick, flash, bob) {
    ctx.save();
    const x = Math.round(W / 2);
    const recoil = clamp(Number(kick) || 0, 0, 6);
    const bounce = clamp(Number(bob) || 0, -3, 3);
    const baseY = H + recoil + bounce;
    const top = baseY - 65;

    if (Number(flash) > 0) drawMuzzleFlash(ctx, x, top, Number(flash));
    drawGunHand(ctx, x - 1, baseY);

    // Chwyt o lekkim, zwezajacym sie profilu.
    box(ctx, OUTLINE, x - 11, baseY - 38, 22, 37);
    box(ctx, '#252b36', x - 8, baseY - 37, 16, 35);
    box(ctx, '#3c4657', x - 6, baseY - 35, 12, 31);
    box(ctx, '#596579', x - 5, baseY - 33, 4, 27);
    box(ctx, '#1b2029', x - 5, baseY - 27, 10, 3);
    box(ctx, '#1b2029', x - 5, baseY - 19, 10, 3);
    box(ctx, '#1b2029', x - 5, baseY - 11, 10, 3);
    box(ctx, '#4ad66d', x - 7, baseY - 6, 14, 2);
    drawGunThumb(ctx, x - 1, baseY);

    // Oslona spustu z pustym srodkiem.
    box(ctx, OUTLINE, x + 8, baseY - 42, 13, 4);
    box(ctx, OUTLINE, x + 17, baseY - 40, 4, 15);
    box(ctx, OUTLINE, x + 9, baseY - 28, 11, 4);
    box(ctx, '#596579', x + 10, baseY - 40, 7, 2);
    box(ctx, '#596579', x + 10, baseY - 30, 7, 2);
    box(ctx, '#161a21', x + 11, baseY - 38, 3, 9);

    // Zamek, widziany z gory i lekko od tylu.
    box(ctx, OUTLINE, x - 15, top + 18, 30, 25);
    box(ctx, '#323b4a', x - 12, top + 17, 24, 24);
    box(ctx, '#536176', x - 9, top + 18, 18, 22);
    box(ctx, '#77859a', x - 7, top + 19, 6, 19);
    box(ctx, '#202630', x - 10, top + 35, 20, 5);

    // Wyrzutnik oraz tylne naciecia zamka.
    box(ctx, '#171c24', x + 2, top + 23, 8, 8);
    box(ctx, '#8895a8', x + 3, top + 24, 6, 2);
    box(ctx, '#171c24', x - 12, top + 34, 3, 2);
    box(ctx, '#171c24', x - 12, top + 38, 3, 2);
    box(ctx, '#171c24', x + 9, top + 34, 3, 2);
    box(ctx, '#171c24', x + 9, top + 38, 3, 2);

    // Lufa i muszka.
    box(ctx, OUTLINE, x - 8, top + 3, 16, 17);
    box(ctx, '#252c37', x - 6, top + 2, 12, 16);
    box(ctx, '#65748a', x - 4, top + 3, 8, 14);
    box(ctx, '#10141a', x - 3, top + 2, 6, 5);
    box(ctx, OUTLINE, x - 3, top - 1, 6, 5);
    box(ctx, '#4ad66d', x - 1, top - 1, 2, 3);
    ctx.restore();
  }

  function drawFlashlightHand(ctx, x, baseY) {
    box(ctx, OUTLINE, x - 15, baseY - 30, 31, 34);
    box(ctx, SKIN_DARK, x - 12, baseY - 28, 25, 31);
    box(ctx, SKIN, x - 9, baseY - 26, 19, 28);
    box(ctx, SKIN_LIGHT, x - 7, baseY - 24, 5, 20);
    box(ctx, OUTLINE, x - 13, baseY - 23, 26, 3);
    box(ctx, OUTLINE, x - 13, baseY - 14, 26, 3);
    box(ctx, SLEEVE_DARK, x - 18, baseY - 5, 37, 9);
    box(ctx, SLEEVE, x - 14, baseY - 4, 29, 8);
  }

  function drawLightCone(ctx, x, lensY) {
    // Pasy nie dochodza do centrum ekranu i zachowuja czytelnosc celu.
    ctx.globalAlpha = 0.035;
    box(ctx, '#fff3c4', x - 39, 8, 78, lensY - 8);
    ctx.globalAlpha = 0.055;
    box(ctx, '#fff3c4', x - 29, 30, 58, lensY - 30);
    ctx.globalAlpha = 0.08;
    box(ctx, '#fff8dc', x - 20, 55, 40, lensY - 55);
    ctx.globalAlpha = 0.12;
    box(ctx, '#fffbed', x - 12, 82, 24, lensY - 82);
    ctx.globalAlpha = 1;
  }

  // latarka trzymana w piesci: cylinder wystaje z gory dloni, palce i kciuk lapia raczke, przedramie siega dolu ekranu
  function drawFlashlight(ctx, W, H, on, bob, xPos) {
    ctx.save();
    const x = Math.round(xPos === undefined ? W - 49 : xPos);         // xPos: gdzie trzymana, domyslnie prawa krawedz
    const bounce = clamp(Number(bob) || 0, -3, 3);
    const baseY = H - 36 + bounce;                                    // ta sama wysokosc co piesc z drawHands
    const lensY = baseY - 70;

    if (on === true) drawLightCone(ctx, x, lensY);

    // cylinder (rysowany pod dlonia): raczka, glowica i soczewka
    box(ctx, OUTLINE, x - 9, baseY - 38, 18, 40);
    box(ctx, '#252d39', x - 7, baseY - 36, 14, 38);
    box(ctx, '#465469', x - 4, baseY - 35, 8, 36);
    box(ctx, '#65748a', x - 3, baseY - 33, 2, 28);
    box(ctx, OUTLINE, x - 15, baseY - 62, 30, 26);
    box(ctx, '#303947', x - 13, baseY - 60, 26, 22);
    box(ctx, '#69788e', x - 10, baseY - 59, 20, 8);
    box(ctx, '#171c24', x - 13, baseY - 44, 26, 3);
    box(ctx, OUTLINE, x - 12, lensY - 4, 24, 9);
    box(ctx, on === true ? '#fff4bd' : '#1c2730', x - 10, lensY - 3, 20, 6);
    if (on === true) box(ctx, '#ffffff', x - 5, lensY - 2, 10, 3);
    box(ctx, OUTLINE, x + 9, baseY - 30, 7, 11);                      // wlacznik z boku
    box(ctx, on === true ? '#4ad66d' : '#394354', x + 10, baseY - 29, 5, 8);

    drawFist(ctx, x, baseY, 1, 1);                                    // piesc z przedramieniem zaslania dol raczki
    box(ctx, OUTLINE, x - 10, baseY - 15, 20, 3);                     // zageszczenie cienia nad palcami
    box(ctx, SKIN, x - 8, baseY - 13, 8, 9);                          // kciuk na cylindrze
    box(ctx, SKIN_LIGHT, x - 7, baseY - 12, 3, 5);
    box(ctx, OUTLINE, x - 9, baseY - 14, 1, 11);
    ctx.restore();
  }

  global.drawHands = drawHands;
  global.drawPistol = drawPistol;
  global.drawFlashlight = drawFlashlight;
})(globalThis);
