// ikony i portrety w stylu pixel-art
function iconRows(size, rows) {
  return rows.map(([x, art]) => '.'.repeat(x) + art + '.'.repeat(size - x - art.length));
}

const ICON_DARK = rgb(16, 20, 29);
const ICON_OUTLINE = rgb(35, 30, 47);
const ICON_GREEN = rgb(74, 214, 109);
const ICON_GREEN_LIGHT = rgb(135, 241, 151);

const ICONS = {
  stairsUp: makeSprite(iconRows(16, [
    [2, 'dddddddddddd'],
    [1, 'dddddddddddddd'],
    [1, 'dddddddddddddd'],
    [1, 'dddddggddddddd'],
    [1, 'ddddggggdddddd'],
    [1, 'dddggllggddddd'],
    [1, 'ddgglgglggdddd'],
    [1, 'dddddllddddddd'],
    [1, 'dddddllddddddd'],
    [1, 'dddddllddddss.'],
    [1, 'dddddlldddss..'],
    [1, 'ddddddddsss...'],
    [1, 'dddddddsss....'],
    [1, 'ddddddsss.....'],
    [1, 'dddddddddddddd'],
    [2, 'dddddddddddd'],
  ]), { d: ICON_DARK, g: ICON_GREEN, l: ICON_GREEN_LIGHT, s: rgb(74, 91, 105) }),

  stairsDown: makeSprite(iconRows(16, [
    [2, 'dddddddddddd'],
    [1, 'dddddddddddddd'],
    [1, 'dddddddddddddd'],
    [1, 'ddddddsssddddd'],
    [1, 'dddddddsssdddd'],
    [1, 'ddddddddsssddd'],
    [1, 'dddddddddsssdd'],
    [1, 'dddddllddddss.'],
    [1, 'dddddllddddddd'],
    [1, 'dddddllddddddd'],
    [1, 'ddgglgglggdddd'],
    [1, 'dddggllggddddd'],
    [1, 'ddddggggdddddd'],
    [1, 'dddddggddddddd'],
    [1, 'dddddddddddddd'],
    [2, 'dddddddddddd'],
  ]), { d: ICON_DARK, g: ICON_GREEN, l: ICON_GREEN_LIGHT, s: rgb(74, 91, 105) }),

  bug: makeSprite(iconRows(16, [
    [2, 'oo........oo'],
    [3, 'oo......oo'],
    [4, 'ooggggoo'],
    [3, 'ogggggggo'],
    [2, 'ogggggggggo'],
    [1, 'oogwrggrwggoo'],
    [1, 'ogggggggggggo'],
    [0, 'oogggmmmmgggoo'],
    [0, 'oggggmwmwggggo'],
    [1, 'ogggggggggggo'],
    [1, 'oogggggggggoo'],
    [0, 'oooggggggggooo'],
    [0, 'oooggoo..oggooo'],
    [0, 'ooogoo....oogooo'],
    [1, 'ooo........ooo'],
    [3, 'oo......oo'],
  ]), {
    o: ICON_OUTLINE, g: rgb(60, 200, 80), w: rgb(242, 245, 238),
    r: rgb(230, 42, 47), m: rgb(18, 57, 27),
  }),

  glitch: makeSprite(iconRows(16, [
    [2, 'oo........oo'],
    [3, 'oo......oo'],
    [4, 'ooppggoo'],
    [3, 'opppggppo'],
    [2, 'opppppppppo'],
    [1, 'oopwyppywpoo'],
    [1, 'opppppppppppo'],
    [0, 'oopppmmmmpppoo'],
    [0, 'oppppmympypppo'],
    [1, 'opppppppppppo'],
    [1, 'oogggpppppwoo'],
    [0, 'oooppppppppooo'],
    [0, 'oooppoo..oppooo'],
    [0, 'ooopoo....oopooo'],
    [1, 'ooo........ooo'],
    [3, 'oo......oo'],
  ]), {
    o: ICON_OUTLINE, p: rgb(171, 70, 222), g: rgb(70, 224, 206),
    w: rgb(244, 242, 250), y: rgb(255, 229, 62), m: rgb(54, 20, 82),
  }),

  'Szalona Powtórka': makeSprite(iconRows(32, [
    [2, 'ee'], [1, 'ee'], [2, 'ee..............oo'], [1, 'ee.............oppo'],
    [2, 'ee.........oooppppooo'], [1, 'ee........oppppppppppo'], [2, 'ee.......opplpppplppppo'],
    [0, 'ee.ee....opplppppplppppo'], [1, 'ee.....oppppppppppppppo'], [3, 'ee...oppppwwwppwwwppppo'],
    [4, 'ee.opppppkwwppwwkpppppo'], [6, 'oppppppppppppppppppo'], [5, 'oppppppoooooooppppppo'],
    [4, 'opppppoommmmmmoopppppo'], [3, 'eeopppomrrrrrrrmoppppoee'], [2, 'ee.opppomrwwrwwrmoppppo.ee'],
    [3, 'eeopppomrrrrrrrmoppppoee'], [4, 'opppppomrwrwrwrmopppppo'], [5, 'opppppommmmmmmoppppppo'],
    [6, 'opppppoooooooooppppppo'], [6, 'oppppppppppppppppppo'], [5, 'ooppppppppppppppppoo'],
    [4, 'oppoopppppppppppooppo'], [3, 'oppo.oppppppppppo.oppo'], [3, 'oo...oppppppppppo...oo'],
    [7, 'opppppppppppppppo'], [6, 'oppoppppppppppoppo'], [5, 'oppooppp....oppooppo'],
    [4, 'oppo.opp......oppo.oppo'], [4, 'oo...oo........oo...oo'], [0, ''], [0, ''],
  ]), {
    o: rgb(37, 22, 51), p: rgb(170, 62, 191), l: rgb(231, 118, 219), k: rgb(255, 225, 80),
    w: rgb(248, 241, 232), m: rgb(55, 13, 47), r: rgb(224, 68, 92), e: rgb(88, 210, 242),
  }),

  'Kserokopiarka Zagłady': makeSprite(iconRows(32, [
    [0, ''], [8, 'oooooooooooooooo'], [7, 'osssssssssssssssso'], [7, 'osllllllllllllllso'],
    [7, 'oslwwwwwwwwwwwwlso'], [7, 'oslwwwwwwwwwwwwlso'], [7, 'osllllllllllllllso'], [7, 'osssssssssssssssso'],
    [6, 'oooooooooooooooooooo'], [5, 'oossssssssssssssssooo'], [4, 'oossssssssssssssssssoo'],
    [3, 'oossssoooooooooosssssoo'], [3, 'ossssorrrsoosrrrossssso'], [3, 'ossssorrksooskrrossssso'],
    [3, 'ossssoooooooooosssssso'], [3, 'ossssssssssssssssssssso'], [3, 'osssllllllllllllllsssso'],
    [3, 'ossslyyyyyyyyyyyylsssso'], [3, 'ossslyoyoyoyoyoyylsssso'], [3, 'osssllllllllllllllsssso'],
    [3, 'ossssssssssssssssssssso'], [3, 'ossssssoooooossssssssso'], [4, 'ossssso....ossssssso'],
    [4, 'ossssso....ossssssso'], [4, 'ossssso....ossssssso'], [6, 'owwwwwwwwwwwwwwwwo'],
    [6, 'owwwwwwwwwwwwwwwwo'], [7, 'owwbwbwbwbwbwbwwo'], [7, 'owwwwwwwwwwwwwwwo'],
    [8, 'owwwwwwwwwwwwwo'], [9, 'oooooooooooooo'], [0, ''],
  ]), {
    o: rgb(29, 31, 40), s: rgb(104, 111, 124), l: rgb(164, 174, 185), w: rgb(238, 238, 225),
    r: rgb(212, 45, 45), k: rgb(255, 215, 55), y: rgb(232, 199, 65), b: rgb(72, 105, 185),
  }),

  'Zawieszony Projektor': makeSprite(iconRows(32, [
    [0, ''], [4, 'oo....................oo'], [3, 'obbo..................obbo'], [3, 'obbo..................obbo'],
    [4, 'oo....................oo'], [6, 'oooooooooooooooooooo'], [5, 'oobbbbbbbbbbbbbbbbbboo'],
    [4, 'oobbbbbbbbbbbbbbbbbbbboo'], [4, 'obddddddddddddddddddddbo'], [4, 'obdccccccccccccccccccdbo'],
    [4, 'obdcclccccccccccclccdbo'], [4, 'obdccccccccccccccccccdbo'], [4, 'obdccccccwwccccccccccdbo'],
    [4, 'obdccccccwwccccccccccdbo'], [4, 'obdccccccccccccccccccdbo'], [4, 'obdccccccccwwccccccccdbo'],
    [4, 'obdccccccccwwccccccccdbo'], [4, 'obdccccccccccccccccccdbo'], [4, 'obddddddddddddddddddddbo'],
    [4, 'obbbbbbbbbbbbbbbbbbbbbbbo'], [5, 'oobbbbbbbbbbbbbbbbbboo'], [6, 'oooooooooooooooooooo'],
    [8, 'ooossssssssssooo'], [7, 'oossssssssssssssoo'], [6, 'oosssssoooossssssoo'],
    [6, 'ossssso....osssssso'], [7, 'ossssoooooossssso'], [8, 'oossssssssssoo'],
    [10, 'ooss..ssoo'], [9, 'ooss....ssoo'], [8, 'oooo....oooo'], [0, ''],
  ]), {
    o: rgb(25, 27, 38), b: rgb(67, 86, 112), d: rgb(25, 76, 139), c: rgb(32, 143, 221),
    l: rgb(96, 215, 255), w: rgb(239, 247, 255), s: rgb(110, 116, 129),
  }),

  'Kartkówka-Widmo': makeSprite(iconRows(32, [
    [0, ''], [8, 'oooooooooooooo'], [7, 'owwwwwwwwwwwwwwo'], [6, 'owwwwwwwwwwwwwwwo'],
    [6, 'owwwwwwwwwwwwwwwo'], [6, 'owwwwwwwwwwwwwooo'], [6, 'owwwwwwwwwwwwoogo'],
    [5, 'owwwwwwwwwwwwwooggo'], [5, 'owwwwwwwwwwwwooggggo'], [4, 'owwwwwwwwwwwwooggggggo'],
    [4, 'owwwwwwwwwwwwoooooooo'], [4, 'owwwwwwwwwwwwwwwwwwo'], [3, 'owwwwwwwwwwwwwwwwwwwwo'],
    [3, 'owwwwwoowwwwwwoowwwwwo'], [3, 'owwwwommoowwoommowwwwwo'], [3, 'owwwwommmoooommmowwwwwo'],
    [3, 'owwwwoomoooooomoowwwwwo'], [3, 'owwwwwwoorrrroowwwwwwwo'], [3, 'owwwwwworrrrrrowwwwwwwwo'],
    [3, 'owwwwworrrrwrrowwwwwwwwo'], [3, 'owwwwwworrrrrrowwwwwwwwo'], [3, 'owwwwwwooooooowwwwwwwwwo'],
    [3, 'owwwwbbbbbbbbbbbbwwwwwwo'], [3, 'owwwwwwbbbwwbbbwwwwwwwwo'], [3, 'owwwwwwwbbwwbbwwwwwwwwwo'],
    [3, 'owwwwwwwwwwwwwwwwwwwwwo'], [3, 'owwwwwwwwwwwwwwwwwwwwwo'], [4, 'owwwwwwwwwwwwwwwwwwo'],
    [5, 'owwwwoowwwwoowwwwwo'], [6, 'owwwo..owwwo..owwwo'], [7, 'ooo....ooo....ooo'], [0, ''],
  ]), {
    o: rgb(42, 39, 59), w: rgb(231, 232, 221), g: rgb(183, 191, 201), m: rgb(87, 59, 116),
    r: rgb(207, 67, 91), b: rgb(79, 104, 176),
  }),

  'Nieskończona Pętla': makeSprite(iconRows(32, [
    [0, ''], [0, ''], [11, 'oooooo'], [8, 'oooggggggooo'], [6, 'oogggllllgggoo'],
    [5, 'ogggllllllllgggo'], [4, 'ogglllooooolllggo'], [3, 'oggllo......ollgggo'], [2, 'oggllo........ollgggo'],
    [2, 'oggl.............lggo'], [1, 'oggl....oooooo....lggo'], [1, 'ogl...ooggggggoo...lgo'],
    [1, 'ogl..ogggllllgggo..lgo'], [1, 'ogl.oggl......lggo.lgo'], [1, 'ogl.ogl........lgo.lgo'],
    [1, 'ogl.ogl........lgo.lgo'], [1, 'ogl.oggl......lggo.lgo'], [1, 'ogl..ogggllllgggo..lgo'],
    [1, 'oggl...ooggggggoo.lggo'], [2, 'oggl.....oooo....lggo'], [2, 'oggllo..........ollgggo'],
    [3, 'ogglllo......olllgggo'], [4, 'ogglllloooooollllgggo'], [5, 'ogggllllllllllgggo'],
    [6, 'ooggggllllggggoo'], [8, 'oooggggggooo'], [11, 'ogggo'], [10, 'oggkygo'],
    [10, 'ogkyygo'], [11, 'ogyygo'], [12, 'ooo'], [0, ''],
  ]), {
    o: rgb(27, 39, 36), g: rgb(44, 153, 89), l: rgb(92, 211, 113),
    k: rgb(19, 27, 24), y: rgb(255, 216, 64),
  }),

  'Błąd 404': makeSprite(iconRows(32, [
    [0, ''], [4, 'oooooooooooooooooooooooo'], [3, 'oossssssssssssssssssssssoo'],
    [3, 'osllllllllllllllllllllllso'], [3, 'osllrrllrrllrrllllllllllso'], [3, 'osllllllllllllllllllllllso'],
    [3, 'osssssssssssssssssssssssso'], [3, 'oddddddddddddddddddddddddo'], [3, 'odbbbbbbbbbbbbbbbbbbbbbbdo'],
    [3, 'odbccccccccccccccccccccbdo'], [3, 'odbccooooooooooooooooccbdo'], [3, 'odbccooyyooooooooyyooccbdo'],
    [3, 'odbccooykooooooookyyooccbdo'], [3, 'odbccooooooooooooooooccbdo'], [3, 'odbccccccccccccccccccccbdo'],
    [3, 'odbccwwccwwwwccwwccwwccbdo'], [3, 'odbccwwccwwwwccwwccwwccbdo'], [3, 'odbccwwwwccwwccwwwwwwccbdo'],
    [3, 'odbccwwwwccwwccwwwwwwccbdo'], [3, 'odbccccwwccwwccccccwwccbdo'], [3, 'odbccccwwccwwccccccwwccbdo'],
    [3, 'odbccccccccccccccccccccbdo'], [3, 'odbcccoooooooooooooocccbdo'], [3, 'odbccoorrroooooorrrooccbdo'],
    [3, 'odbccoorrrroooorrrrooccbdo'], [3, 'odbcccoorrrrrrrroocccbdo'], [3, 'odbccccooorrrrooooccccbdo'],
    [3, 'odbccccccccccccccccccccbdo'], [3, 'odbbbbbbbbbbbbbbbbbbbbbbdo'], [3, 'oddddddddddddddddddddddddo'],
    [4, 'oooooooooooooooooooooooo'], [0, ''],
  ]), {
    o: rgb(28, 26, 39), s: rgb(107, 109, 125), l: rgb(184, 188, 199), r: rgb(218, 58, 67),
    d: rgb(42, 50, 73), b: rgb(43, 89, 148), c: rgb(27, 126, 190), w: rgb(242, 244, 235),
    y: rgb(255, 221, 61), k: rgb(66, 27, 39),
  }),

  'Dyrektor Bugów': makeSprite(iconRows(32, [
    [0, ''], [6, 'yyo....yyyy....oyy'], [6, 'oyyo..oyyyo..oyyo'], [7, 'oyyooyyyyyooyyo'],
    [7, 'oyyyyyyyyyyyyyo'], [8, 'oyykyykyykyyo'], [8, 'oyyyyyyyyyyyyo'], [9, 'oooooooooooo'],
    [6, 'oo............oo'], [5, 'oggo..........oggo'], [4, 'ogggoooooooooogggo'],
    [3, 'oggggggggggggggggggo'], [2, 'ogggllllllllllllgggggo'], [2, 'ogggllllllllllllgggggo'],
    [1, 'oggglllwwllllwwlllggggo'], [1, 'ogggllwrrwllwrrwllggggo'], [1, 'ogggllwrrwllwrrwllggggo'],
    [1, 'oggglllwwllllwwlllggggo'], [1, 'ogggllllllllllllllggggo'], [1, 'oggglllllooooolllllggggo'],
    [1, 'ogggllloommmoooolllggggo'], [1, 'ogggllloomwmooolllggggo'], [1, 'oggglllloooooollllggggo'],
    [1, 'ogggggllllllllllggggggo'], [0, 'oggggggggggggggggggggggo'], [0, 'ooggggggggggggggggggggoo'],
    [0, 'ooogggggggggggggggggooo'], [2, 'oggggggggggggggggggo'], [3, 'ogggoooggggggoooggggo'],
    [3, 'oggo...oggggo...oggo'], [3, 'oooo...oooooo...oooo'], [0, ''],
  ]), {
    o: rgb(34, 21, 30), g: rgb(156, 45, 45), l: rgb(218, 70, 54), w: rgb(247, 229, 209),
    r: rgb(255, 38, 40), m: rgb(57, 13, 21), y: rgb(238, 183, 42), k: rgb(255, 231, 89),
  }),
};

const iconCache = {};

function iconSprite(name) {
  if (!ICONS[name]) return ICONS.bug;
  if (!iconCache[name]) iconCache[name] = ICONS[name];
  return iconCache[name];
}

function iconColor(color) {
  const r = color & 255;
  const g = (color >>> 8) & 255;
  const b = (color >>> 16) & 255;
  const a = (color >>> 24) & 255;
  return `rgba(${r},${g},${b},${a / 255})`;
}

function drawIcon(ctx, name, x, y, scale) {
  const sprite = iconSprite(name);
  const pixel = scale || 1;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let py = 0; py < sprite.h; py++) {
    for (let px = 0; px < sprite.w; px++) {
      const color = sprite.data[py * sprite.w + px];
      if (!color) continue;
      ctx.fillStyle = iconColor(color);
      ctx.fillRect(x + px * pixel, y + py * pixel, pixel, pixel);
    }
  }
  ctx.restore();
}

function drawBossPortrait(ctx, name, cx, cy, scale, t) {
  const sprite = iconSprite(name);
  const pixel = scale || 1;
  const tick = t || 0;
  const bob = Math.sin(tick / 20) * 2;
  const x = Math.round(cx - sprite.w * pixel / 2);
  const y = Math.round(cy - sprite.h * pixel / 2 + bob);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (name === 'Szalona Powtórka') {
    ctx.globalAlpha = 0.12;
    drawIcon(ctx, name, x - 6, y, pixel);
    ctx.globalAlpha = 0.2;
    drawIcon(ctx, name, x - 3, y, pixel);
    ctx.globalAlpha = 1;
  }
  drawIcon(ctx, name, x, y, pixel);
  ctx.restore();
}
