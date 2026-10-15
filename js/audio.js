// dzwieki i muzyka generowane w WebAudio, bez zewnetrznych plikow
let actx = null, master = null, sfxGain = null, musicGain = null, musicFilter = null;

function audioInit() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    return;
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    actx = new AudioCtx();
    master = actx.createGain();
    master.connect(actx.destination);

    sfxGain = actx.createGain();
    sfxGain.connect(master);

    musicFilter = actx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 18000;

    musicGain = actx.createGain();
    musicGain.connect(musicFilter);
    musicFilter.connect(master);

    applyVolume();
    startMusicScheduler();
  } catch (_) { actx = null; }
}

function applyVolume() {
  const vol = (typeof settings !== 'undefined' && settings.volume !== undefined) ? settings.volume : 0.6;
  const muted = typeof settings !== 'undefined' && settings.muted;
  const sfxVol = (typeof settings !== 'undefined' && settings.sfxVolume !== undefined) ? settings.sfxVolume : 0.8;
  const musVol = (typeof settings !== 'undefined' && settings.musicVolume !== undefined) ? settings.musicVolume : 0.6;

  if (master) master.gain.value = muted ? 0 : vol;
  if (sfxGain) sfxGain.gain.value = sfxVol;
  if (musicGain) musicGain.gain.value = musVol * 0.45;
}

function setMusicMuffled(muffled) {
  if (!musicFilter || !actx) return;
  const target = muffled ? 650 : 18000;
  musicFilter.frequency.setTargetAtTime(target, actx.currentTime, 0.04);
}

function tone(freq, dur, type = 'square', slide = 0, vol = 0.25, delay = 0) {
  if (!actx) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxGain || master);
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
  s.connect(g); g.connect(sfxGain || master);
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
  stairs: () => [240, 320, 400].forEach((f, i) => tone(f, 0.08, 'triangle', 0, 0.15, i * 0.06)),
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

// --- Silnik muzyki chiptune ---
const NOTE_MAP = { c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11 };

function midi(str) {
  if (!str || str === '-') return 0;
  const m = str.toLowerCase().match(/^([a-g][#b]?)(-?\d+)$/);
  if (!m) return 0;
  return (parseInt(m[2], 10) + 1) * 12 + NOTE_MAP[m[1]];
}

function m2f(m) {
  return m > 0 ? 440 * Math.pow(2, (m - 69) / 12) : 0;
}

function playMusicBass(freq, time, dur, vol = 0.35, punch = false) {
  if (!actx || !musicGain) return;
  const osc = actx.createOscillator(), g = actx.createGain(), flt = actx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(punch ? 1200 : 500, time);
  flt.frequency.exponentialRampToValueAtTime(punch ? 180 : 110, time + dur);
  osc.type = punch ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(vol * (punch ? 0.95 : 0.7), time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(flt); flt.connect(g); g.connect(musicGain);
  osc.start(time); osc.stop(time + dur);
}

function playMusicLead(freq, time, dur, vol = 0.28, type = 'square', thick = false) {
  if (!actx || !musicGain) return;
  const osc = actx.createOscillator(), g = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.001, time);
  g.gain.linearRampToValueAtTime(vol * 0.65, time + 0.012);
  g.gain.setValueAtTime(vol * 0.65, time + dur * 0.65);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(time); osc.stop(time + dur);

  if (thick) {
    const o2 = actx.createOscillator(), g2 = actx.createGain();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(freq * 0.5, time);
    g2.gain.setValueAtTime(vol * 0.35, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o2.connect(g2); g2.connect(musicGain);
    o2.start(time); o2.stop(time + dur);
  }
}

function playMusicArp(freq, time, dur, vol = 0.16) {
  if (!actx || !musicGain) return;
  const osc = actx.createOscillator(), g = actx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(vol * 0.5, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(time); osc.stop(time + dur);
}

function playMusicDrums(hits, time, vol = 0.35) {
  if (!actx || !musicGain || !hits || hits === '-') return;

  if (hits.includes('k')) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(135, time);
    o.frequency.exponentialRampToValueAtTime(32, time + 0.08);
    g.gain.setValueAtTime(vol * 0.9, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.085);
    o.connect(g); g.connect(musicGain);
    o.start(time); o.stop(time + 0.085);
  }
  if (hits.includes('s')) {
    const n = Math.floor(actx.sampleRate * 0.07), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = actx.createBufferSource(), g = actx.createGain(), flt = actx.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 1000;
    s.buffer = b;
    g.gain.setValueAtTime(vol * 0.55, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    s.connect(flt); flt.connect(g); g.connect(musicGain);
    s.start(time);

    const o = actx.createOscillator(), og = actx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, time);
    o.frequency.exponentialRampToValueAtTime(70, time + 0.05);
    og.gain.setValueAtTime(vol * 0.4, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    o.connect(og); og.connect(musicGain);
    o.start(time); o.stop(time + 0.05);
  }
  if (hits.includes('h')) {
    const n = Math.floor(actx.sampleRate * 0.025), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = actx.createBufferSource(), g = actx.createGain(), flt = actx.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 6500;
    s.buffer = b;
    g.gain.setValueAtTime(vol * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    s.connect(flt); flt.connect(g); g.connect(musicGain);
    s.start(time);
  }
  if (hits.includes('o')) {
    const n = Math.floor(actx.sampleRate * 0.09), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = actx.createBufferSource(), g = actx.createGain(), flt = actx.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 5500;
    s.buffer = b;
    g.gain.setValueAtTime(vol * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    s.connect(flt); flt.connect(g); g.connect(musicGain);
    s.start(time);
  }
}

const MUSIC_TRACKS = {
  menu: {
    bpm: 118,
    steps: 32,
    drums: [
      'k','-','h','-','s','-','h','-','k','-','k','-','s','-','h','h',
      'k','-','h','-','s','-','h','-','k','-','h','-','s','-','s','s',
    ],
    bass: [
      'd2','-','d2','-','d3','-','d2','-','bb1','-','bb1','-','bb2','-','bb1','-',
      'f1','-','f1','-','f2','-','f1','-','c2','-','c2','-','c3','-','c2','-',
    ],
    lead: [
      'd4','-','f4','-','a4','-','d5','-','c5','-','a4','-','f4','g4','f4','e4',
      'd4','-','f4','-','g4','-','a4','-','g4','-','f4','-','e4','-','c4','-',
    ],
    arp: [
      'd3','f3','a3','d4','f3','a3','d4','f4','bb2','d3','f3','bb3','d3','f3','bb3','d4',
      'f2','a2','c3','f3','a2','c3','f3','a3','c3','e3','g3','c4','e3','g3','c4','e4',
    ],
  },
  dark: {
    bpm: 96,
    steps: 32,
    drums: [
      'k','-','-','-','h','-','-','-','-','-','k','-','h','-','-','-',
      'k','-','-','-','h','-','-','-','-','-','-','-','h','-','h','-',
    ],
    bass: [
      'c2','-','-','-','-','-','-','-','eb2','-','-','-','-','-','-','-',
      'bb1','-','-','-','-','-','-','-','g1','-','-','-','-','-','-','-',
    ],
    lead: [
      'c4','-','-','-','eb4','-','-','-','gb4','-','-','-','g4','-','-','-',
      'gb4','-','-','-','eb4','-','-','-','c4','-','-','-','b3','-','-','-',
    ],
    arp: [
      'c3','-','eb3','-','g3','-','b3','-','c4','-','b3','-','g3','-','eb3','-',
      'bb2','-','d3','-','f3','-','a3','-','ab2','-','c3','-','eb3','-','g3','-',
    ],
  },
  explore: {
    bpm: 104,
    steps: 32,
    thick: false,
    drums: [
      'k','-','-','-','h','-','-','-','-','-','k','-','h','-','-','-',
      'k','-','-','-','h','-','-','-','-','-','-','-','h','-','-','o',
    ],
    bass: [
      'a1','-','-','-','a1','-','c2','-','d2','-','-','-','e2','-','d2','-',
      'f1','-','-','-','f1','-','a1','-','g1','-','-','-','e1','-','g1','-',
    ],
    lead: [
      'e4','-','-','-','-','-','g4','-','a4','-','-','-','-','-','b4','-',
      'c5','-','-','-','b4','-','a4','-','g4','-','-','-','e4','-','-','-',
    ],
    arp: [
      'a2','-','c3','-','e3','-','a3','-','d3','-','f3','-','a3','-','d4','-',
      'f2','-','a2','-','c3','-','f3','-','g2','-','b2','-','d3','-','g3','-',
    ],
  },
  battle: {
    bpm: 162,
    steps: 32,
    thick: true,
    drums: [
      'k','h','k','h','s','h','k','h','k','k','h','k','s','h','k','s',
      'k','h','k','h','s','h','k','h','k','h','k','k','s','s','s','s',
    ],
    bass: [
      'd2','d3','d2','d3','f2','f3','g2','ab2','a2','a2','a3','a2','c3','c2','c#3','c#2',
      'd2','d3','d2','d3','c2','c3','bb1','bb2','a1','a2','g1','g2','f1','f2','e1','e2',
    ],
    lead: [
      'd4','d4','d5','-','a4','-','-','ab4','g4','-','f4','-','d4','f4','g4','a4',
      'f4','-','d4','-','c4','-','d4','-','f4','-','g4','-','a4','-','c5','d5',
    ],
    arp: [
      'd3','f3','a3','d4','f3','a3','d4','f4','c3','e3','g3','c4','e3','g3','c4','e4',
      'bb2','d3','f3','bb3','d3','f3','bb3','d4','a2','c#3','e3','a3','d3','f3','a3','d4',
    ],
  },
  boss: {
    bpm: 174,
    steps: 32,
    thick: true,
    drums: [
      'k','k','h','k','s','k','h','k','k','k','h','k','s','k','s','s',
      'k','k','h','k','s','k','h','k','k','k','h','k','s','s','s','s',
    ],
    bass: [
      'e2','e2','e3','e2','g2','g2','g3','g2','a2','a2','a3','a2','bb2','bb2','b2','b2',
      'c3','c3','b2','b2','bb2','bb2','a2','a2','g2','g2','f#2','f#2','f2','f2','d#2','d#2',
    ],
    lead: [
      'e5','-','e5','g5','a5','-','bb5','-','b5','-','a5','g5','e5','g5','a5','b5',
      'd6','-','b5','-','a5','-','g5','-','e5','-','g5','-','f#5','-','d#5','-',
    ],
    arp: [
      'e3','g3','b3','e4','g3','b3','e4','g4','a3','c4','e4','a4','bb3','d4','f4','bb4',
      'b3','d#4','f#4','b4','a3','c4','e4','a4','g3','b3','e4','g4','f#3','a#3','c#4','f#4',
    ],
  },
  victory: {
    bpm: 124,
    steps: 32,
    thick: false,
    drums: [
      'k','-','h','-','s','-','h','-','k','-','k','-','s','-','h','o',
      'k','-','h','-','s','-','h','-','k','-','h','k','s','-','s','s',
    ],
    bass: [
      'c2','c2','c3','c2','g2','g2','g3','g2','a2','a2','a3','a2','f2','f2','f3','f2',
      'c2','c2','c3','c2','f2','f2','f3','f2','g2','g2','g3','g2','c2','e2','g2','c3',
    ],
    lead: [
      'c4','-','e4','-','g4','-','c5','-','b4','-','a4','-','g4','-','-','-',
      'a4','-','c5','-','b4','-','a4','-','g4','-','e4','-','c4','-','-','-',
    ],
    arp: [
      'c3','e3','g3','c4','g2','b2','d3','g3','a2','c3','e3','a3','f2','a2','c3','f3',
      'c3','e3','g3','c4','f2','a2','c3','f3','g2','b2','d3','g3','c3','e3','g3','c4',
    ],
  },
};

let musicSchedulerTimer = null;
let currentMusicTrack = null;
let currentMusicTrackName = null;
let nextMusicStepTime = 0;
let currentMusicStep = 0;

function scheduleMusicStep(track, step, time, stepDur) {
  if (!actx || !track) return;
  const isAction = !!track.thick;
  if (track.drums && track.drums[step]) {
    playMusicDrums(track.drums[step], time, isAction ? 0.46 : 0.26);
  }
  if (track.bass && track.bass[step] && track.bass[step] !== '-') {
    const f = m2f(midi(track.bass[step]));
    if (f) playMusicBass(f, time, stepDur * 0.9, isAction ? 0.44 : 0.28, isAction);
  }
  if (track.lead && track.lead[step] && track.lead[step] !== '-') {
    const f = m2f(midi(track.lead[step]));
    if (f) playMusicLead(f, time, stepDur * 0.85, isAction ? 0.34 : 0.22, 'square', isAction);
  }
  if (track.arp && track.arp[step] && track.arp[step] !== '-') {
    const f = m2f(midi(track.arp[step]));
    if (f) playMusicArp(f, time, stepDur * 0.45, isAction ? 0.20 : 0.12);
  }
}

function musicSchedulerTick() {
  if (!actx || !currentMusicTrack) return;
  const stepDur = (60 / currentMusicTrack.bpm) / 4;
  while (nextMusicStepTime < actx.currentTime + 0.15) {
    scheduleMusicStep(currentMusicTrack, currentMusicStep, nextMusicStepTime, stepDur);
    currentMusicStep = (currentMusicStep + 1) % currentMusicTrack.steps;
    nextMusicStepTime += stepDur;
  }
}

function startMusicScheduler() {
  if (typeof setInterval !== 'undefined' && !musicSchedulerTimer) {
    musicSchedulerTimer = setInterval(musicSchedulerTick, 25);
  }
}

function playMusic(trackName) {
  if (!trackName || !MUSIC_TRACKS[trackName]) {
    currentMusicTrackName = null;
    currentMusicTrack = null;
    return;
  }
  if (currentMusicTrackName === trackName) return;
  currentMusicTrackName = trackName;
  currentMusicTrack = MUSIC_TRACKS[trackName];
  currentMusicStep = 0;
  if (actx) {
    nextMusicStepTime = actx.currentTime + 0.05;
  }
  startMusicScheduler();
}

function stopMusic() {
  playMusic(null);
}

function getMusicTrack() {
  return currentMusicTrackName;
}
