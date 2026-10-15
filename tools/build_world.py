#!/usr/bin/env python3
"""Buduje js/world-data.js z mapa/mapa.json.

Gra dziala bez serwera i bez fetch, wiec dane swiata sa osadzone w klasycznym skrypcie.
Zostawiamy tylko to, czego potrzebuje gra: siatki, sale (strefy typu room), drzwi, schody, sloty NPC, wejscie.

Uzycie: python3 tools/build_world.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


import re

BAND = 4                       # szerokosc korytarza po zwezeniu (komorki)


def reserved_points(f):
    """Punkty, ktorych nie wolno zablokowac filarami: sloty NPC oraz jedzenie i przedmioty z js/content.js."""
    pts = [(n["x"] + 0.5, n["y"] + 0.5) for n in f["npc_slots"]]
    text = (ROOT / "js" / "content.js").read_text(encoding="utf-8")
    for fl, x, y in re.findall(r"\[(\d), ([\d.]+), ([\d.]+)\]", text.split("FOOD_PLACE =")[1].split("\n")[0]):
        if int(fl) == f["level"]:
            pts.append((float(x), float(y)))
    for m in re.finditer(r"floor: (\d), x: ([\d.]+), y: ([\d.]+)", text.split("ITEM_PLACE =")[1].split("\n")[0]):
        if int(m.group(1)) == f["level"]:
            pts.append((float(m.group(2)), float(m.group(3))))
    return pts


def in_rect(z, x, y):
    return z["x"] <= x < z["x"] + z["w"] and z["y"] <= y < z["y"] + z["h"]


def shape_floor(f):
    """Zwezenie korytarza do wzoru ze zdjec (waski, dlugi, wneki przy drzwiach), okna i tablice w scianach, laweczki jako dekor.

    Siatka z mapa.json ma korytarz szerokosci 8. Na zdjeciach korytarze maja ok. 4 komorki, drzwi siedza we wnekach,
    nad nimi male okna, na scianach tablice korkowe i obrazy, a przy scianach stoja laweczki.
    Hole (strefy typu hall poza korytarzem) zostaja szerokie.
    """
    grid = [list(r) for r in f["grid"]]
    for row in grid:                                       # znaczniki z mapy (L, W, B) zastepujemy wlasnym dekorem
        for i, ch in enumerate(row):
            if ch in "LWB":
                row[i] = "."
    corridor = next(z for z in f["zones"] if z["id"].endswith("-corridor"))
    halls = [z for z in f["zones"] if z["type"] == "hall" and z is not corridor]
    cx0, cx1, cy0, ch = corridor["x"], corridor["x"] + corridor["w"] - 1, corridor["y"], corridor["h"]
    side = (ch - BAND) // 2                                # 2 rzedy po kazdej stronie
    top_rows, bot_rows = list(range(cy0, cy0 + side)), list(range(cy0 + ch - side, cy0 + ch))
    top_face, bot_face = cy0 + side - 1, cy0 + ch - side

    alcoves = set()
    for d in f["doors"]:
        xs = [c["x"] for c in d["cells"]]
        dy = d["cells"][0]["y"]
        rows = top_rows if dy == cy0 - 1 else bot_rows if dy == cy0 + ch else []
        for y in rows:
            for x in range(min(xs) - 1, max(xs) + 2):
                alcoves.add((x, y))
    for y in top_rows + bot_rows:
        for x in range(cx0, cx1 + 1):
            if not any(in_rect(z, x, y) for z in halls) and (x, y) not in alcoves:
                grid[y][x] = "#"
    for x in range(cx0, cx1 + 1):                          # okna naswietla i tablice w scianach przy korytarzu
        for face in (top_face, bot_face):
            if grid[face][x] != "#":
                continue
            if x % 7 == 3:
                grid[face][x] = "W"
            elif x % 11 == 9:
                grid[face][x] = "L"

    decor = []
    band_top, band_bot = cy0 + side, cy0 + ch - side - 1
    for x in range(cx0 + 4, cx1 - 3, 13):                  # laweczki przy scianach (nie w holach i wnekach)
        for y, off in ((band_top, 0.34), (band_bot, 0.66)):
            if (x, y - 1) in alcoves or (x, y + 1) in alcoves or any(in_rect(z, x, y) for z in halls):
                continue
            if (x + (0 if y == band_top else 6)) % 2 == 0:
                decor.append({"kind": "bench", "x": x + 0.5, "y": y + off})
    reserved = reserved_points(f)                          # filary co ok. 10 komorek, naprzemiennie z obu stron: lamia dluga linie wzroku
    k = 0
    for x in range(cx0 + 6, cx1 - 4, 10):
        y = band_top if k % 2 == 0 else band_bot
        k += 1
        if any(in_rect(z, x, y) for z in halls) or any((xx, yy) in alcoves for xx in (x - 1, x, x + 1) for yy in (y - 1, y + 1)):
            continue
        if any(abs(px - (x + 0.5)) < 1.6 and abs(py - (y + 0.5)) < 1.6 for px, py in reserved + [(d["x"], d["y"]) for d in decor]):
            continue
        grid[y][x] = "#"
    for z in halls:                                        # kolorowe pufy i rosliny w holach
        mx, my = z["x"] + z["w"] / 2, z["y"] + z["h"] / 2
        for i, color in enumerate(("#f08a1c", "#e0457b", "#2f6fd6", "#d9302c", "#8a4fc0")):
            decor.append({"kind": "pufa", "color": color, "x": mx - 2.5 + i * 1.15, "y": my + (-0.8 if i % 2 else 0.9)})
        decor.append({"kind": "plant", "x": z["x"] + 1.5, "y": z["y"] + 1.5})
        decor.append({"kind": "plant", "x": z["x"] + z["w"] - 1.5, "y": z["y"] + z["h"] - 1.5})
    return ["".join(r) for r in grid], decor


def build():
    m = json.loads((ROOT / "mapa" / "mapa.json").read_text(encoding="utf-8"))
    floors = []
    for f in m["floors"]:
        grid, decor = shape_floor(f)
        floors.append({
            "level": f["level"],
            "name": f["name"],
            "grid": grid,
            "decor": decor,
            "zones": [
                {k: z[k] for k in ("id", "name", "type", "x", "y", "w", "h", "number", "boss_ready") if k in z}
                for z in f["zones"]
            ],
            "doors": [{"id": d["id"], "zone": d["zone"], "number": d.get("number", ""), "cells": [[c["x"], c["y"]] for c in d["cells"]]}
                      for d in f["doors"]],
            "npcSlots": [{"id": n["id"], "x": n["x"], "y": n["y"]} for n in f["npc_slots"]],
        })
    stairs = [{"id": s["id"], "floor": s["floor"], "x": s["x"], "y": s["y"], "to": [s["target"]["floor"], s["target"]["x"], s["target"]["y"]]}
              for s in m["stairs"]]
    world = {"floors": floors, "stairs": stairs, "entrance": m["main_entrance"]}
    out = ROOT / "js" / "world-data.js"
    out.write_text("// wygenerowane przez tools/build_world.py z mapa/mapa.json, nie edytuj recznie\n"
                   "const WORLD_DATA = " + json.dumps(world, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"zapisano {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB), pieter: {len(floors)}")


if __name__ == "__main__":
    build()
