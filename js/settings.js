// ustawienia gracza, zapis w localStorage
const ACTIONS = [
  ['forward', 'Do przodu'], ['back', 'Do tyłu'], ['left', 'W lewo'], ['right', 'W prawo'],
  ['turnLeft', 'Obrót w lewo'], ['turnRight', 'Obrót w prawo'], ['fire', 'Strzał'],
];

const DEFAULT_SETTINGS = {
  volume: 0.6, musicVolume: 0.6, sfxVolume: 0.8, muted: false, sensitivity: 1, fov: 66,
  keys: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    turnLeft: 'ArrowLeft', turnRight: 'ArrowRight', fire: 'Space',
  },
};

const RESERVED_KEYS = ['Escape', 'KeyM', 'KeyR', 'KeyE', 'KeyF', 'KeyH', 'KeyZ', 'KeyX', 'Enter'];
const STORE_KEY = 'gliwice-raid-settings';
const copySettings = s => ({ ...s, keys: { ...s.keys } });

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) return { ...copySettings(DEFAULT_SETTINGS), ...saved, keys: { ...DEFAULT_SETTINGS.keys, ...saved.keys } };
  } catch (_) {}
  return copySettings(DEFAULT_SETTINGS);
}

function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (_) {}
}

function resetSettings() {
  Object.assign(settings, copySettings(DEFAULT_SETTINGS));
  saveSettings();
}

const KEY_NAMES = {
  Space: 'Spacja', ArrowLeft: 'Strzałka ←', ArrowRight: 'Strzałka →', ArrowUp: 'Strzałka ↑', ArrowDown: 'Strzałka ↓',
  ShiftLeft: 'Lewy Shift', ShiftRight: 'Prawy Shift', ControlLeft: 'Lewy Ctrl', Enter: 'Enter', Tab: 'Tab',
};

function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return KEY_NAMES[code] || code;
}

const settings = loadSettings();
