// dialogi NPC w stylu Undertale: czysta logika bez DOM i bez dzwieku.
// Tekst strony moze zawierac znaczniki:
//   {p} pauza (15 klatek), {p:30} pauza n klatek
//   {c:red}...{/c} kolor, {shake}...{/shake} drzenie, {s:0.2}...{/s} wolniejsze pisanie (znakow na klatke)
// Linia to string albo { text, face, speed }. Ostatnia strona moze konczyc sie wyborem (options).
// Sterowanie (zbocza): confirm = dalej, cancel = pomin pisanie strony, strzalki = wybor.
// Efekty do zagrania w UI: { type: 'blip', pitch }, { type: 'move' }, { type: 'select' }

const TYPE_SPEED = 0.5;                  // znakow na klatke (30 na sekunde)
const PAUSE_TICKS = 15;
const PUNCT_PAUSE = { ',': 6, '.': 10, '!': 10, '?': 10, ':': 6 };
const BLIP_EVERY = 2;                    // dzwiek co drugi znak

function parseMarkup(text) {
  const out = [], re = /\{(\/?)(p|c|shake|s)(?::([^}]*))?\}/g;
  let color = null, shake = false, speed = null, last = 0, m;
  const push = s => { for (const ch of s) out.push({ ch, color, shake, speed }); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    last = re.lastIndex;
    const close = m[1] === '/', tag = m[2], arg = m[3];
    if (tag === 'p') out.push({ pause: arg ? +arg : PAUSE_TICKS });
    else if (tag === 'c') color = close ? null : arg;
    else if (tag === 'shake') shake = !close;
    else if (tag === 's') speed = close ? null : +arg;
  }
  push(text.slice(last));
  return out;
}

// node: { npc, lines, options, voice: { pitch }, face }
function createDialogue(node) {
  const lines = node.lines && node.lines.length ? node.lines : ['...'];
  const d = {
    npc: node.npc, voice: node.voice || { pitch: 300 }, portrait: node.portrait || null, options: node.options || [],
    pages: lines.map(l => (typeof l === 'string' ? { text: l } : l)),
    page: 0, tokens: [], idx: 0, acc: 0, wait: 0, blip: 0, cursor: 0,
    phase: 'type', result: null, events: [],
  };
  loadPage(d, 0);
  return d;
}

function loadPage(d, i) {
  d.page = i; d.tokens = parseMarkup(d.pages[i].text);
  d.idx = 0; d.acc = 0; d.wait = 0; d.blip = 0; d.phase = 'type';
}

const pageFace = d => d.pages[d.page].face || null;

// znaki widoczne na ekranie (bez pauz) i wszystkie znaki strony do zawijania wierszy
const visibleChars = d => d.tokens.slice(0, d.idx).filter(t => !t.pause);
const allChars = d => d.tokens.filter(t => !t.pause);

function revealStep(d) {
  if (d.wait > 0) { d.wait--; return; }
  const next = d.tokens[d.idx];
  d.acc += (next && next.speed) || d.pages[d.page].speed || TYPE_SPEED;
  while (d.acc >= 1 && d.idx < d.tokens.length) {
    const t = d.tokens[d.idx++];
    d.acc -= 1;
    if (t.pause) { d.wait = t.pause; break; }
    if (t.ch !== ' ' && d.blip++ % BLIP_EVERY === 0) d.events.push({ type: 'blip', pitch: d.voice.pitch });
    if (PUNCT_PAUSE[t.ch]) { d.wait = PUNCT_PAUSE[t.ch]; break; }
  }
  if (d.idx >= d.tokens.length) d.phase = 'wait';
}

function advance(d) {
  if (d.page < d.pages.length - 1) { loadPage(d, d.page + 1); return; }
  if (d.options.length > 1) { d.phase = 'choice'; d.cursor = 0; return; }
  d.result = d.options.length ? d.options[0].id : null;
  d.phase = 'done';
}

function stepDialogue(d, pressed) {
  d.events = [];
  if (d.phase === 'type') {
    if (pressed.cancel) { d.idx = d.tokens.length; d.phase = 'wait'; return; }
    revealStep(d);
  } else if (d.phase === 'wait') {
    if (pressed.confirm) advance(d);
  } else if (d.phase === 'choice') {
    const n = d.options.length, prev = d.cursor;
    if (pressed.left || pressed.up) d.cursor = (d.cursor + n - 1) % n;
    if (pressed.right || pressed.down) d.cursor = (d.cursor + 1) % n;
    if (d.cursor !== prev) d.events.push({ type: 'move' });
    if (pressed.confirm) { d.result = d.options[d.cursor].id; d.phase = 'done'; d.events.push({ type: 'select' }); }
  }
}

const dialogueDone = d => d.phase === 'done';
