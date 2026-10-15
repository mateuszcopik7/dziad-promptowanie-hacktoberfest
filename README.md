# Gliwice Raid

Raycaster w stylu Doom w czystym HTML/JS, bez buildu i bez zależności. Bugi opanowały ZSTI Gliwice, a Ty je naprawiasz. Projekt na Hacktoberfest Hack Day Gliwice 2026 (temat: Automation & Emulation).

## Uruchomienie

Otwórz `index.html` w przeglądarce albo uruchom lokalny serwer:

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

- 3 poziomy: Parter ZSTI, Biblioteka, Stołówka (boss).
- Trzy typy wrogów: zwykły bug, szybki glitch, boss.
- Wrogowie śpią, dopóki nie zobaczą gracza. Ściany blokują strzały i widok.
- XP za każdego buga. Awans daje więcej HP, a co drugi poziom mocniejszy strzał.
- Kanapki leczą, pendrive'y dają amunicję, zabity bug zwraca trochę amunicji.

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
| `tests/game.test.js` | testy logiki w Node |

## Testy

```bash
node tests/game.test.js
```

## Licencja

MIT
