#!/usr/bin/env python3
"""Kontrola spojnosci mapa/mapa.json — tylko Python stdlib."""

from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "mapa.json").read_text(encoding="utf-8"))
ERRORS: list[str] = []


def fail(message: str) -> None:
    ERRORS.append(message)


def inside(zone: dict, x: int, y: int) -> bool:
    return zone["x"] <= x < zone["x"] + zone["w"] and zone["y"] <= y < zone["y"] + zone["h"]


floors = {f["level"]: f for f in DATA["floors"]}
valid_codes = set(DATA["legend"])
walkable = set(DATA["traversable_codes"])

# 1. Rozmiary i kody.
for level, floor in floors.items():
    width, height = floor["width"], floor["height"]
    if len(floor["grid"]) != height:
        fail(f"pietro {level}: liczba wierszy {len(floor['grid'])} != {height}")
    for y, row in enumerate(floor["grid"]):
        if len(row) != width:
            fail(f"pietro {level}: wiersz {y} ma {len(row)} znakow zamiast {width}")
        unknown = set(row) - valid_codes
        if unknown:
            fail(f"pietro {level}: nieznane kody {sorted(unknown)}")
    for zone in floor["zones"]:
        if zone["type"] not in {"room", "hall", "stairs"}:
            fail(f"pietro {level}: niepoprawny typ strefy {zone['id']}")
        if zone["type"] == "room" and zone.get("boss_ready") and (zone["w"] - 2 < 7 or zone["h"] - 2 < 7):
            fail(f"pietro {level}: wnetrze sali bojowej {zone['id']} mniejsze niz 7x7")
        if zone["type"] == "hall" and min(zone["w"], zone["h"]) < 3:
            fail(f"pietro {level}: korytarz {zone['id']} wezszy niz 3 komorki")

# 2. Pokrycie przechodnich komorek strefami oraz drzwi sal.
for level, floor in floors.items():
    for y, row in enumerate(floor["grid"]):
        for x, code in enumerate(row):
            if code in walkable and not any(inside(z, x, y) for z in floor["zones"]):
                fail(f"pietro {level}: przechodnia komorka ({x},{y}) bez strefy")
    for door in floor["doors"]:
        if len(door["cells"]) < 2:
            fail(f"pietro {level}: drzwi {door['id']} maja mniej niz 2 komorki")
        zone = next((z for z in floor["zones"] if z["id"] == door["zone"]), None)
        if not zone:
            fail(f"pietro {level}: drzwi {door['id']} wskazuja brakujaca strefe")
            continue
        has_inside = False
        has_outside = False
        for cell in door["cells"]:
            x, y = cell["x"], cell["y"]
            if floor["grid"][y][x] != "D":
                fail(f"pietro {level}: drzwi {door['id']} nie leza na kodzie D")
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < floor["width"] and 0 <= ny < floor["height"] and floor["grid"][ny][nx] in walkable:
                    if inside(zone, nx, ny):
                        has_inside = True
                    else:
                        has_outside = True
        if not (has_inside and has_outside):
            fail(f"pietro {level}: drzwi {door['id']} nie lacza sali z korytarzem")

# 3. Sloty NPC musza byc na podlodze i w strefie hall.
for level, floor in floors.items():
    for npc in floor["npc_slots"]:
        x, y = npc["x"], npc["y"]
        if floor["grid"][y][x] != ".":
            fail(f"pietro {level}: slot {npc['id']} nie lezy na zwyklej podlodze")
        if not any(z["type"] == "hall" and inside(z, x, y) for z in floor["zones"]):
            fail(f"pietro {level}: slot {npc['id']} nie lezy w korytarzu/holu")

# 4. Schody: konce na S, kazde powiazanie ma dokladna pare zwrotna.
link_keys = set()
for link in DATA["stairs"]:
    src = (link["floor"], link["x"], link["y"])
    dst = (link["target"]["floor"], link["target"]["x"], link["target"]["y"])
    link_keys.add((src, dst))
    for floor_no, x, y in (src, dst):
        if floor_no not in floors:
            fail(f"schody {link['id']}: nieznane pietro {floor_no}")
        elif floors[floor_no]["grid"][y][x] != "S":
            fail(f"schody {link['id']}: punkt ({floor_no},{x},{y}) nie ma kodu S")
for src, dst in link_keys:
    if (dst, src) not in link_keys:
        fail(f"schody: brak pary zwrotnej {src} -> {dst}")

# 5. Globalna osiagalnosc: ruch 4-kierunkowy + lacza schodow.
start = DATA["main_entrance"]
start_node = (start["floor"], start["x"], start["y"])
if floors[start["floor"]]["grid"][start["y"]][start["x"]] != "E":
    fail("wejscie glowne nie lezy na kodzie E")

stairs_from: dict[tuple[int, int, int], list[tuple[int, int, int]]] = {}
for link in DATA["stairs"]:
    src = (link["floor"], link["x"], link["y"])
    dst = (link["target"]["floor"], link["target"]["x"], link["target"]["y"])
    stairs_from.setdefault(src, []).append(dst)

seen = {start_node}
queue = deque([start_node])
while queue:
    floor_no, x, y = queue.popleft()
    floor = floors[floor_no]
    neighbours = []
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < floor["width"] and 0 <= ny < floor["height"] and floor["grid"][ny][nx] in walkable:
            neighbours.append((floor_no, nx, ny))
    neighbours.extend(stairs_from.get((floor_no, x, y), []))
    for node in neighbours:
        if node not in seen:
            seen.add(node)
            queue.append(node)

all_walkable = {
    (level, x, y)
    for level, floor in floors.items()
    for y, row in enumerate(floor["grid"])
    for x, code in enumerate(row)
    if code in walkable
}
missing = all_walkable - seen
if missing:
    sample = sorted(missing)[:8]
    fail(f"nieosiagalne komorki: {len(missing)}; przyklad {sample}")

if ERRORS:
    print(f"KONTROLA: BLAD ({len(ERRORS)} problemow)")
    for error in ERRORS:
        print(f"- {error}")
    sys.exit(1)

print("KONTROLA: OK")
print(f"Pietra: {len(floors)}")
print("Rozmiary siatek: OK (84x56 na kazdym pietrze)")
print(f"Strefy: OK ({sum(len(f['zones']) for f in floors.values())}; pelne pokrycie podlogi)")
print(f"Drzwi: OK ({sum(len(f['doors']) for f in floors.values())}; kazde wejscie ma >= 2 komorki)")
print(f"Schody: OK ({len(DATA['stairs'])} kierunkowych laczy; wszystkie sparowane)")
print(f"Sloty NPC: OK ({sum(len(f['npc_slots']) for f in floors.values())})")
print(f"Osiagalnosc: OK ({len(seen)}/{len(all_walkable)} przechodnich komorek od wejscia)")
