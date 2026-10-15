# Gliwice Raid

Gra w stylu Doom (raycaster w czystym HTML/JS, bez buildu i bez zależności), której akcja dzieje się w ZSTI Gliwice. Jeden wielki budynek z czterema piętrami, odtworzony ze zdjęć. Rozmowy z NPC i walki z bossami w salach są w stylu Undertale. Projekt na Hacktoberfest Hack Day Gliwice 2026 (temat: Automation & Emulation).

## Uruchomienie

Gra online: https://mateuszcopik7.github.io/dziad-promptowanie-hacktoberfest/

Lokalnie otwórz `index.html` w przeglądarce albo uruchom serwer:

```bash
python3 -m http.server 8000
```

## Przebieg gry

- Zaczynasz w holu głównym z samymi rękami i latarką pod `F`.
- Na korytarzach stoją NPC (fikcyjni uczniowie i pracownicy). Rozmowa pod `E`, nad głową mają `!` (nowy quest) albo `?` (do oddania).
- Quest ze strzelaniem daje pistolet i wypuszcza bugi na korytarz. Po oddaniu questa broń znika.
- Piętra łączą klatki schodowe. Wejście na schody otwiera wybór: dokąd idziesz.
- Wejście w drzwi sali: ekran gaśnie, nauczyciel prosi o pomoc, potem walka turowa jak w Undertale: `FIGHT` (pasek timingu), `ACT`, `ITEM`, `MERCY`. Boss ginie albo można go oszczędzić, gdy nastrój dojdzie do 100.
- Cel: odblokować aulę (łańcuch questów) i pokonać Dyrektora Bugów.

## Sterowanie

| Akcja | Domyślnie |
| --- | --- |
| Ruch | W / S / A / D |
| Obrót | mysz albo strzałki |
| Strzał (gdy masz broń) | mysz albo spacja |
| Rozmowa | E |
| Latarka | F |
| Zjedz kanapkę | H |
| Pauza | Esc |
| Minimapa | M |
| W rozmowie i walce | strzałki, Z / Enter potwierdź, X wstecz |

Klawisze ruchu, głośność, czułość myszy i FOV zmienisz w menu (Ustawienia). Zapis w `localStorage`.

## Mapa

Plan budynku jest w `mapa/` (PNG, SVG, `mapa.json`, opis i źródła w `mapa/OPIS.md`). `tools/build_world.py` zamienia `mapa/mapa.json` w `js/world-data.js` wczytywany przez grę. Parter to rekonstrukcja założona, piętra 1–3 oparto na zdjęciach.

```bash
python3 tools/build_world.py
python3 mapa/sprawdz.py
```

## Struktura

| Plik | Zawartość |
| --- | --- |
| `js/game.js` | logika świata: ruch, NPC, strzelanie, wrogowie, drzwi, schody (bez DOM) |
| `js/world.js`, `js/world-data.js` | świat z mapy: siatki pięter, drzwi, schody |
| `js/content.js` | NPC, questy, bossowie sal |
| `js/quests.js` | silnik questów (kill, fetch, talk, nagrody, odblokowania) |
| `js/dialogue.js` | dialogi w stylu Undertale: pisanie literami, znaczniki, wybory |
| `js/battle.js` | walka turowa: FIGHT, ACT, ITEM, MERCY, unikanie pocisków |
| `js/encounter.js` | spotkanie w sali: zaciemnienie, scenka, walka, wynik |
| `js/scenes.js` | rysowanie dialogów i walki |
| `js/render.js` | raycaster, sprite'y, latarka, HUD, minimapa |
| `js/weapon-art.js` | ręce, pistolet i latarka (pixel art) |
| `js/assets.js`, `js/audio.js`, `js/settings.js`, `js/ui.js`, `js/main.js` | tekstury, dźwięki, ustawienia, menu, pętla gry |
| `bot/bot.py` | bot w Pythonie (Playwright), do dostosowania do nowej gry |
| `tests/` | testy w Node (`*.test.js`) i Pythonie |

## Testy

```bash
for t in game quests battle dialogue encounter; do node tests/$t.test.js; done
```

Strony testowe: `battle-test.html`, `dialogue-test.html`, `room-test.html`, `weapon-art-test.html`.

## Licencja

MIT
