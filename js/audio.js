// dzwieki generowane w WebAudio, bez plikow
let actx = null, master = null;

function audioInit() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.connect(actx.destination);
    applyVolume();
  } catch (_) { actx = null; }
}

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

function tone(freq, dur, type = 'square', slide = 0, vol = 0.25, delay = 0) {
  if (!actx) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur);
}

function noise(dur, vol = 0.3, delay = 0) {
  if (!actx) return;
  const n = Math.floor(actx.sampleRate * dur), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const t = actx.currentTime + delay, s = actx.createBufferSource(), g = actx.createGain();
  s.buffer = b;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g); g.connect(master);
  s.start(t);
}

const SFX = {
  shoot: () => { noise(0.08, 0.35); tone(220, 0.12, 'sawtooth', -160, 0.25); },
  empty: () => tone(120, 0.05, 'square', 0, 0.15),
  hit: () => tone(300, 0.06, 'square', -100, 0.2),
  kill: () => { tone(200, 0.25, 'sawtooth', -150, 0.3); noise(0.15, 0.3); },
  pickup: () => { tone(520, 0.08, 'square', 0, 0.2); tone(780, 0.1, 'square', 0, 0.2, 0.07); },
  hurt: () => tone(110, 0.2, 'sawtooth', -50, 0.35),
  levelup: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0, 0.2, i * 0.09)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0, 0.22, i * 0.12)),
  lose: () => [330, 262, 196, 147].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0, 0.25, i * 0.16)),
};

function playSfx(name) {
  if (SFX[name]) SFX[name]();
}

// dzwieki scen: dialog (blipy glosu NPC) i walka. Zdarzenia to stringi (walka) albo { type, pitch } (dialog).
const SCENE_SFX = {
  blip: e => tone(e.pitch * (0.92 + Math.random() * 0.16), 0.045, 'square', 0, 0.07),
  move: () => tone(520, 0.03, 'square', 0, 0.08),
  select: () => tone(780, 0.06, 'square', 0, 0.1),
  hit: () => { noise(0.06, 0.3); tone(220, 0.1, 'sawtooth', -120, 0.2); },
  miss: () => tone(120, 0.08, 'square', 0, 0.12),
  hurt: () => tone(90, 0.15, 'sawtooth', -40, 0.25),
  heal: () => tone(660, 0.12, 'square', 0, 0.15),
  act: () => tone(440, 0.06, 'square', 0, 0.12),
};

function playSceneSfx(e) {
  const name = typeof e === 'string' ? e : e.type;
  if (SCENE_SFX[name]) SCENE_SFX[name](e);
}
