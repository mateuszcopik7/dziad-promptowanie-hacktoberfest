#!/usr/bin/env python3
"""Buduje js/world-data.js z mapa/mapa.json.

Gra dziala bez serwera i bez fetch, wiec dane swiata sa osadzone w klasycznym skrypcie.
Zostawiamy tylko to, czego potrzebuje gra: siatki, sale (strefy typu room), drzwi, schody, sloty NPC, wejscie.

Uzycie: python3 tools/build_world.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build():
    m = json.loads((ROOT / "mapa" / "mapa.json").read_text(encoding="utf-8"))
    floors = []
    for f in m["floors"]:
        floors.append({
            "level": f["level"],
            "name": f["name"],
            "grid": f["grid"],
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
