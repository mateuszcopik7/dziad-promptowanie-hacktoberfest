// menu i ekrany nakladki (DOM nad canvasem)
const uiEl = document.getElementById('ui');
const ui = { current: null, from: 'main', onAction: () => {} };
let capturing = null;

const fmtTime = ticks => {
  const s = Math.floor(ticks / 60);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

const FORMAT = {
  volume: v => Math.round(v * 100) + '%',
  sensitivity: v => v.toFixed(1) + 'x',
  fov: v => v + '°',
};

const slider = (label, key, min, max, step) => `
  <label class="row"><span>${label}</span>
    <input type="range" data-s="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}">
    <output>${FORMAT[key](settings[key])}</output></label>`;

const stats = d => `
  <p class="stats">${d.name}<br>Czas ${d.time} · Bugi ${d.kills}/${d.total} · Poziom gracza ${d.level}</p>`;

const SCREENS = {
  main: () => `
    <h1>GLIWICE RAID</h1>
    <p class="sub">Bugi opanowały ZSTI. Napraw je wszystkie.</p>
    <button data-a="play">Graj</button>
    <button data-a="howto">Jak grać</button>
    <button data-a="settings">Ustawienia</button>
    <p class="foot">Hacktoberfest Hack Day Gliwice 2026</p>`,

  howto: () => `
    <h2>Jak grać</h2>
    <p class="text">Na każdym poziomie zniszcz wszystkie bugi. Zielone to zwykłe, fioletowe są szybkie, czerwony boss czeka w stołówce.</p>
    <p class="text">Za każdego buga dostajesz XP. Nowy poziom daje więcej zdrowia, a co drugi także mocniejszy strzał.</p>
    <p class="text">Zbieraj kanapki (+25 HP) i pendrive'y (+10 amunicji). Amunicja się kończy.</p>
    <p class="text keys">${ACTIONS.map(([id, label]) => `${label}: <b>${keyLabel(settings.keys[id])}</b>`).join(' · ')}<br>
      Mysz: obrót i strzał · Esc: pauza · M: minimapa · R: restart poziomu</p>
    <button data-a="back">Wstecz</button>`,

  settings: () => `
    <h2>Ustawienia</h2>
    ${slider('Głośność', 'volume', 0, 1, 0.05)}
    <label class="row"><span>Wycisz dźwięk</span><input type="checkbox" data-s="muted" ${settings.muted ? 'checked' : ''}></label>
    ${slider('Czułość myszy', 'sensitivity', 0.3, 2.5, 0.1)}
    ${slider('Pole widzenia (FOV)', 'fov', 50, 100, 1)}
    <h3>Sterowanie</h3>
    ${ACTIONS.map(([id, label]) => `
      <div class="row"><span>${label}</span>
        <button class="key" data-k="${id}">${capturing === id ? 'naciśnij klawisz…' : keyLabel(settings.keys[id])}</button></div>`).join('')}
    <p class="hint">Zajęty klawisz zamienia się miejscami. Zarezerwowane: Esc, M, R.</p>
    <button data-a="resetSettings">Przywróć domyślne</button>
    <button data-a="back">Wstecz</button>`,

  pause: () => `
    <h2>Pauza</h2>
    <button data-a="resume">Wznów</button>
    <button data-a="settings">Ustawienia</button>
    <button data-a="menu">Wyjdź do menu</button>`,

  levelDone: d => `
    <h2 class="good">Poziom ukończony</h2>${stats(d)}
    <button data-a="next">Następny poziom</button>
    <button data-a="menu">Menu</button>`,

  dead: d => `
    <h2 class="bad">Zawieszenie systemu</h2>${stats(d)}
    <button data-a="retry">Spróbuj ponownie</button>
    <button data-a="menu">Menu</button>`,

  victory: d => `
    <h2 class="good">Wszystkie bugi naprawione</h2>${stats(d)}
    <button data-a="play">Zagraj od nowa</button>
    <button data-a="menu">Menu</button>`,
};

function showScreen(name, data) {
  ui.current = name;
  uiEl.innerHTML = `<div class="panel">${SCREENS[name](data)}</div>`;
  uiEl.hidden = false;
}

function hideScreen() {
  ui.current = null;
  uiEl.hidden = true;
  uiEl.innerHTML = '';
}

function onCaptureKey(e) {
  e.preventDefault(); e.stopImmediatePropagation();
  removeEventListener('keydown', onCaptureKey, true);
  const id = capturing;
  capturing = null;
  if (!RESERVED_KEYS.includes(e.code)) {
    const other = Object.keys(settings.keys).find(a => a !== id && settings.keys[a] === e.code);
    if (other) settings.keys[other] = settings.keys[id];
    settings.keys[id] = e.code;
    saveSettings();
  }
  showScreen('settings');
}

function beginCapture(id) {
  capturing = id;
  showScreen('settings');
  addEventListener('keydown', onCaptureKey, true);
}

uiEl.addEventListener('click', e => {
  const k = e.target.closest('[data-k]');
  if (k) return beginCapture(k.dataset.k);
  const b = e.target.closest('[data-a]');
  if (!b) return;
  if (b.dataset.a === 'resetSettings') { resetSettings(); applyVolume(); showScreen('settings'); }
  else ui.onAction(b.dataset.a);
});

uiEl.addEventListener('input', e => {
  const key = e.target.dataset.s;
  if (!key) return;
  settings[key] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
  const out = e.target.parentElement.querySelector('output');
  if (out) out.textContent = FORMAT[key](settings[key]);
  saveSettings();
  applyVolume();
});

uiEl.addEventListener('change', e => {
  if (e.target.dataset.s === 'volume') { audioInit(); playSfx('pickup'); }
});
