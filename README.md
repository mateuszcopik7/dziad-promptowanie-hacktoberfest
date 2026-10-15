# Gliwice Raid

Raycaster w stylu Doom w czystym HTML/JS, bez buildu i bez zależności. Bugi opanowały ZSTI Gliwice, a Ty je naprawiasz. Projekt na Hacktoberfest Hack Day Gliwice 2026 (temat: Automation & Emulation).

## Uruchomienie

Gra online: https://mateuszcopik7.github.io/dziad-promptowanie-hacktoberfest/

Lokalnie otwórz `index.html` w przeglądarce albo uruchom lokalny serwer:

```bash
python3 -m http.server 8000
```

## Sterowanie

| Akcja | Domyślnie |
| --- | --- |
| Ruch | W / S / A / D |
| Obrót | mysz albo strzałki |
| Strzał | mysz albo spacja |
| Pauza | Esc |
| Minimapa | M |
| Restart poziomu | R |

Klawisze, głośność, czułość myszy i FOV zmienisz w menu (Ustawienia). Zapis w `localStorage`.

## Mechanika

- 4 poziomy: Parter ZSTI, Biblioteka, Korytarze II piętra, Stołówka (boss).
- Trzy typy wrogów: zwykły bug, szybki glitch, boss.
- Wrogowie śpią, dopóki nie zobaczą gracza. Ściany blokują strzały i widok.
- XP za każdego buga. Awans daje więcej HP, a co drugi poziom mocniejszy strzał.
- Kanapki leczą, pendrive'y dają amunicję, zabity bug zwraca trochę amunicji.

## Bot w Pythonie (Automation & Emulation)

`bot/bot.py` gra za Ciebie. Uruchamia Chromium przez Playwright, klika menu, czyta stan gry z `window.raid.state()`, planuje trasę (BFS po siatce mapy), celuje i strzela. Sam zbiera pendrive'y, gdy brakuje amunicji, i kanapki, gdy brakuje zdrowia.

```bash
python3 -m venv .venv
.venv/bin/pip install -r bot/requirements.txt
.venv/bin/playwright install chromium
.venv/bin/python bot/bot.py                      # lokalny index.html
.venv/bin/python bot/bot.py --url https://mateuszcopik7.github.io/dziad-promptowanie-hacktoberfest/
```

Opcje: `--headless` (bez okna), `--rounds N` (ile razy przejść grę).

## Struktura

| Plik | Zawartość |
| --- | --- |
| `js/game.js` | logika: poziomy, wrogowie, strzelanie, awanse (bez DOM) |
| `js/render.js` | raycaster, sprite'y, HUD, minimapa |
| `js/assets.js` | tekstury i sprite'y generowane w kodzie |
| `js/audio.js` | dźwięki w WebAudio |
| `js/settings.js` | ustawienia i klawisze |
| `js/ui.js` | menu, ustawienia, pauza, ekrany końca poziomu |
| `js/main.js` | pętla gry, wejście, `window.raid` (API dla bota) |
| `bot/bot.py` | bot: Playwright, BFS, celowanie |
| `tests/game.test.js` | testy logiki gry w Node |
| `tests/test_bot.py` | testy decyzji bota |

## Testy

```bash
node tests/game.test.js
.venv/bin/python -m unittest tests.test_bot
```

## Licencja

MIT
