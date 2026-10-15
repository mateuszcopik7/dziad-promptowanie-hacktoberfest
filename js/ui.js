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
  musicVolume: v => Math.round(v * 100) + '%',
  sfxVolume: v => Math.round(v * 100) + '%',
  sensitivity: v => v.toFixed(1) + 'x',
  fov: v => v + '°',
};

const slider = (label, key, min, max, step) => `
  <label class="row"><span>${label}</span>
    <input type="range" data-s="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}">
    <output>${FORMAT[key](settings[key])}</output></label>`;

const stats = d => `
  <p class="stats">Czas ${d.time} · Poziom gracza ${d.level} · Sale pokonane ${d.rooms}${d.secret ? ' · SEKRET 404 ODKRYTY' : ''}</p>`;

const SCREENS = {
  loading: () => `
    <h2>Ładowanie szkoły…</h2>
    <p class="text">Przygotowuję sylwetki i portrety nauczycieli.</p>`,

  main: () => `
    <p class="eyebrow">ZSTI // PROTOKÓŁ AWARYJNY</p>
    <h1>ZSTI ADVENTURE</h1>
    <div class="logo-line"></div>
    <p class="sub">Przywróć prąd. Uwolnij nauczycieli. Ocal ZSTI.</p>
    <div class="feature-grid"><span>4 PIĘTRA</span><span>QUESTY</span><span>BOSSOWIE</span></div>
    <button data-a="play">▶ ROZPOCZNIJ MISJĘ</button>
    <button data-a="bot">Bot przechodzi grę</button>
    <button data-a="howto">Jak grać</button>
    <button data-a="settings">Ustawienia</button>
    <p class="foot">Hacktoberfest Hack Day Gliwice 2026<br>© 2026 Mateusz Copik, Dominik Świątkowski, Maciej Klich, Tomasz Kostka</p>`,

  howto: () => `
    <h2>Jak grać</h2>
    <p class="text">Katarzyna Pietrzyk-Piotrowska przeprowadzi Cię przez tutorial jako mentorka. Potem przywróć zasilanie w szkole i porozmawiaj z uczniem na parterze.</p>
    <p class="text">Potwory uwięziły nauczycieli w salach. Żółta strzałka i mapa prowadzą do aktualnego celu; obiekty i rozmowy obsługujesz klawiszem E.</p>
    <p class="text">Wejdź w drzwi wskazanej sali: nauczyciel prosi o ratunek, a potem zaczyna się walka turowa: FIGHT, ACT, ITEM, MERCY. Potwora można pokonać albo oszczędzić.</p>
    <p class="text">Cel: uwolnij nauczycieli, zatrzymaj źródło ataku w auli, zdobądź klucz i opuść szkołę głównym wyjściem.</p>
    <p class="text">Znaczniki nad NPC prowadzą też do opcjonalnych zadań pobocznych. Ukończenie całego łańcucha odkrywa ukrytą walkę i wyjątkową nagrodę.</p>
    <p class="text keys">${ACTIONS.map(([id, label]) => `${label}: <b>${keyLabel(settings.keys[id])}</b>`).join(' · ')}<br>
      E: rozmowa · F: latarka · H: kanapka · Esc: pauza · M: minimapa<br>
      W rozmowie i walce: strzałki, Z / Enter: potwierdź, X: wstecz</p>
    <button data-a="back">Wstecz</button>`,

  settings: () => `
    <h2>Ustawienia</h2>
    ${slider('Głośność ogólna', 'volume', 0, 1, 0.05)}
    ${slider('Głośność muzyki', 'musicVolume', 0, 1, 0.05)}
    ${slider('Głośność efektów', 'sfxVolume', 0, 1, 0.05)}
    <label class="row"><span>Wycisz dźwięk</span><input type="checkbox" data-s="muted" ${settings.muted ? 'checked' : ''}></label>
    ${slider('Czułość myszy', 'sensitivity', 0.3, 2.5, 0.1)}
    ${slider('Pole widzenia (FOV)', 'fov', 50, 100, 1)}
    <h3>Sterowanie</h3>
    ${ACTIONS.map(([id, label]) => `
      <div class="row"><span>${label}</span>
        <button class="key" data-k="${id}">${capturing === id ? 'naciśnij klawisz…' : keyLabel(settings.keys[id])}</button></div>`).join('')}
    <p class="hint">Zajęty klawisz zamienia się miejscami. Zarezerwowane: Esc, M, R, E, F, H, Z, X, Enter.</p>
    <button data-a="fullscreen">Pełny ekran (włącz / wyłącz)</button>
    <button data-a="resetSettings">Przywróć domyślne</button>
    <button data-a="back">Wstecz</button>`,

  pause: () => `
    <h2>Pauza</h2>
    <p class="text"><b>Cel:</b> ${objectiveOf(game).text}</p>
    ${trackedQuests(game.qs, QUEST_DEFS, game.npcDefs).map(t => `<p class="text">${t.ready ? '[ok]' : '[ ]'} ${t.title}: ${t.text}</p>`).join('')}
    <button data-a="resume">Wznów</button>
    <button data-a="settings">Ustawienia</button>
    <button data-a="menu">Wyjdź do menu</button>`,

  dead: d => `
    <h2 class="bad">Zawieszenie systemu</h2>${stats(d)}
    <button data-a="retry">Wróć do gry</button>
    <button data-a="menu">Menu</button>`,

  victory: d => `
    <h2 class="good">Szkoła uratowana — udało Ci się wyjść!</h2>${stats(d)}
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
  if (e.target.dataset.s === 'volume' || e.target.dataset.s === 'sfxVolume') { audioInit(); playSfx('pickup'); }
  else if (e.target.dataset.s === 'musicVolume') { audioInit(); }
});
