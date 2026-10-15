// node tests/audio.test.js - testy silnika syntezy muzyki i dzwiekow
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({
  window: {},
  settings: { volume: 0.6, musicVolume: 0.6, sfxVolume: 0.8, muted: false },
});

const src = fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8');
vm.runInContext(src + '\nthis.api = { midi, m2f, MUSIC_TRACKS, playMusic, stopMusic, getMusicTrack, applyVolume, setMusicMuffled };', ctx);
const api = ctx.api;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

test('parsowanie nut midi i przeliczanie na czestotliwosc Hz', () => {
  assert.strictEqual(api.midi('c4'), 60);
  assert.strictEqual(api.midi('C4'), 60);
  assert.strictEqual(api.midi('a4'), 69);
  assert.strictEqual(api.midi('A4'), 69);
  assert.strictEqual(api.midi('c#4'), 61);
  assert.strictEqual(api.midi('eb4'), 63);
  assert.strictEqual(api.midi('-'), 0);
  assert.strictEqual(api.midi(''), 0);

  assert.strictEqual(api.m2f(69), 440);
  assert(Math.abs(api.m2f(60) - 261.63) < 0.1);
  assert.strictEqual(api.m2f(0), 0);
});

test('kompletnosc i spojnosc definicji utworow muzycznych', () => {
  const tracks = ['menu', 'dark', 'explore', 'battle', 'boss', 'victory'];
  tracks.forEach(name => {
    const t = api.MUSIC_TRACKS[name];
    assert(t, `Brak sciezki: ${name}`);
    assert(t.bpm >= 70 && t.bpm <= 200, `Nieprawidlowe BPM w ${name}`);
    assert.strictEqual(t.steps, 32, `Wszystkie sciezki powinny miec 32 kroki (${name})`);
    assert.strictEqual(t.drums.length, t.steps, `Niezgodna dlugosc bebnow w ${name}`);
    assert.strictEqual(t.bass.length, t.steps, `Niezgodna dlugosc basu w ${name}`);
    assert.strictEqual(t.lead.length, t.steps, `Niezgodna dlugosc melodii w ${name}`);
    assert.strictEqual(t.arp.length, t.steps, `Niezgodna dlugosc arpeggio w ${name}`);

    // Sprawdz czy wszystkie nuty sa prawidlowe
    ['bass', 'lead', 'arp'].forEach(ch => {
      t[ch].forEach(n => {
        if (n !== '-') {
          const m = api.midi(n);
          assert(m > 0 && m < 128, `Nieprawidlowa nuta ${n} w ${name}.${ch}`);
          const f = api.m2f(m);
          assert(!isNaN(f) && f > 20 && f < 10000, `Nieprawidlowa czestotliwosc dla ${n} w ${name}.${ch}`);
        }
      });
    });
  });
});

test('maszyna stanow odtwarzacza muzyki', () => {
  assert.strictEqual(api.getMusicTrack(), null);
  api.playMusic('menu');
  assert.strictEqual(api.getMusicTrack(), 'menu');

  api.playMusic('explore');
  assert.strictEqual(api.getMusicTrack(), 'explore');

  api.stopMusic();
  assert.strictEqual(api.getMusicTrack(), null);

  api.playMusic('nieistniejaca_sciezka');
  assert.strictEqual(api.getMusicTrack(), null);
});

test('wyciszenie i glosnosc bez bledow w srodowisku bez AudioContext', () => {
  api.applyVolume();
  api.setMusicMuffled(true);
  api.setMusicMuffled(false);
});

console.log(`\n${passed} testow przeszlo`);
