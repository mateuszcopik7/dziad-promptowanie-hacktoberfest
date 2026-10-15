#!/usr/bin/env python3
"""Generuje komplet planow ZSTI wylacznie z danych opisanych ponizej.

Skrypt korzysta tylko z biblioteki standardowej. Rasteryzacja SVG do PNG jest
wykonywana przez systemowe `sips` na macOS.
"""

from __future__ import annotations

import html
import json
import struct
import textwrap
import unicodedata
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WIDTH = 84
HEIGHT = 56
CELL = 16
OX = 32
OY = 92

COLORS = {
    "#": "#263238",
    ".": "#f6f1e7",
    "D": "#2e7d32",
    "S": "#f28c28",
    "E": "#d32f2f",
    "L": "#6a4c93",
    "W": "#42a5f5",
    "B": "#a66a3f",
}

LEGEND = {
    "#": "sciana / przestrzen poza planem (nieprzechodnia)",
    ".": "podloga (przechodnia)",
    "D": "drzwi (przechodnie; wejscia maja po 2 komorki)",
    "S": "schody (przechodnie)",
    "E": "wejscie glowne / start (przechodnie)",
    "L": "szafki (znacznik nieprzechodni)",
    "W": "okno (znacznik nieprzechodni)",
    "B": "lawka / siedzisko (znacznik nieprzechodni)",
}

# Minimalna czcionka 5x7 do bezbibliotecznego renderowania podpisow PNG.
FONT = {
    " ": ["00000"] * 7,
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
    ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
    "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
    ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
}


class Floor:
    def __init__(self, level: int, name: str, subtitle: str) -> None:
        self.level = level
        self.name = name
        self.subtitle = subtitle
        self.grid = [["#" for _ in range(WIDTH)] for _ in range(HEIGHT)]
        self.zones: list[dict] = []
        self.doors: list[dict] = []
        self.npc_slots: list[dict] = []

    def paint(self, x: int, y: int, w: int, h: int, code: str) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.grid[yy][xx] = code

    def add_hall(self, zid: str, name: str, x: int, y: int, w: int, h: int,
                 *, observed: bool, label: bool = True) -> None:
        self.paint(x, y, w, h, ".")
        self.zones.append({
            "id": zid, "name": name, "type": "hall",
            "x": x, "y": y, "w": w, "h": h,
            "observed": observed, "label": label,
        })

    def add_stairs(self, zid: str, name: str, x: int, y: int, w: int, h: int,
                   *, observed: bool) -> None:
        self.paint(x, y, w, h, "S")
        self.zones.append({
            "id": zid, "name": name, "type": "stairs",
            "x": x, "y": y, "w": w, "h": h,
            "observed": observed, "label": True,
        })

    def add_room(self, zid: str, name: str, number: str, x: int, y: int,
                 w: int, h: int, side: str, door_x: int, *, observed: bool,
                 door_width: int = 2, windows: bool = True,
                 boss_ready: bool = True) -> None:
        # Prostokat strefy obejmuje sciany obwodowe; podloga jest wewnatrz.
        self.paint(x + 1, y + 1, w - 2, h - 2, ".")
        if windows:
            wy = y if side == "bottom" else y + h - 1
            for wx in range(x + 3, x + w - 3, 4):
                self.grid[wy][wx] = "W"
        dy = y + h - 1 if side == "bottom" else y
        coords = []
        for dx in range(door_width):
            self.grid[dy][door_x + dx] = "D"
            coords.append({"x": door_x + dx, "y": dy})
        self.zones.append({
            "id": zid, "name": name, "number": number, "type": "room",
            "x": x, "y": y, "w": w, "h": h,
            "observed": observed, "label": True, "boss_ready": boss_ready,
        })
        self.doors.append({
            "id": f"door-{self.level}-{number.lower().replace(' ', '-')}",
            "number": number, "zone": zid, "orientation": side,
            "cells": coords,
        })

    def feature(self, code: str, cells: list[tuple[int, int]]) -> None:
        for x, y in cells:
            neighbours = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            next_to_door = any(
                0 <= nx < WIDTH and 0 <= ny < HEIGHT and self.grid[ny][nx] == "D"
                for nx, ny in neighbours
            )
            if self.grid[y][x] == "." and not next_to_door:
                self.grid[y][x] = code

    def npc(self, slot_id: str, x: int, y: int) -> None:
        self.npc_slots.append({"id": slot_id, "x": x, "y": y})

    def as_dict(self) -> dict:
        return {
            "level": self.level,
            "name": self.name,
            "subtitle": self.subtitle,
            "width": WIDTH,
            "height": HEIGHT,
            "grid": ["".join(row) for row in self.grid],
            "zones": self.zones,
            "doors": self.doors,
            "npc_slots": self.npc_slots,
        }


def common_shell(f: Floor, *, observed_stairs: bool) -> None:
    f.add_hall(f"f{f.level}-corridor", "Glowny korytarz", 8, 24, 68, 8,
               observed=f.level > 0, label=False)
    f.add_stairs(f"f{f.level}-stairs-a", "Klatka schodowa A", 2, 23, 6, 10,
                 observed=observed_stairs)
    f.add_stairs(f"f{f.level}-stairs-b", "Klatka schodowa B", 76, 23, 6, 10,
                 observed=observed_stairs)


def build_floor_0() -> Floor:
    f = Floor(0, "Parter", "Wejscie, administracja, szatnie i sport — rekonstrukcja zalozona")
    common_shell(f, observed_stairs=False)
    f.add_hall("f0-main-hall", "Hol wejsciowy", 32, 18, 20, 38,
               observed=False)
    f.add_room("f0-portiernia", "Portiernia", "001", 8, 4, 11, 20,
               "bottom", 13, observed=False, boss_ready=False)
    f.add_room("f0-sekretariat", "Sekretariat", "002", 19, 4, 13, 20,
               "bottom", 24, observed=False, boss_ready=False)
    f.add_room("f0-dyrektor", "Gabinet dyrektora", "003", 52, 4, 12, 20,
               "bottom", 57, observed=False, boss_ready=False)
    f.add_room("f0-wc", "Toalety", "WC 0", 64, 4, 12, 20,
               "bottom", 69, observed=False, boss_ready=False)
    f.add_room("f0-gym", "Sala gimnastyczna", "GIM", 8, 32, 24, 20,
               "top", 19, observed=False, door_width=2)
    f.add_room("f0-changing", "Szatnia sportowa", "SZ-S", 52, 32, 12, 20,
               "top", 57, observed=False, boss_ready=False)
    f.add_room("f0-cloakroom", "Szatnia glowna", "SZ-0", 64, 32, 12, 20,
               "top", 69, observed=False, boss_ready=False)
    f.paint(38, 50, 8, 6, ".")
    f.paint(40, 54, 4, 2, "E")
    f.feature("L", [(66 + x, 37) for x in range(7)] + [(54 + x, 44) for x in range(7)])
    f.feature("B", [(35 + x, 37) for x in range(5)] + [(46 + x, 28) for x in range(4)])
    for i, (x, y) in enumerate([(35, 27), (48, 29), (39, 42), (44, 48)], 1):
        f.npc(f"npc-0-{i:02d}", x, y)
    return f


def build_floor_1() -> Floor:
    f = Floor(1, "Pietro 1", "Strefa wspolna, bufet i sale 1xx")
    common_shell(f, observed_stairs=True)
    f.add_hall("f1-lounge", "Kolorowy hol wypoczynkowy", 32, 18, 20, 20,
               observed=True)
    f.add_room("f1-aula", "Aula", "101", 8, 4, 24, 20,
               "bottom", 19, observed=False)
    f.add_room("f1-library", "Biblioteka", "112", 52, 4, 14, 20,
               "bottom", 58, observed=False)
    f.add_room("f1-lab113", "Pracownia komputerowa", "113", 66, 4, 10, 20,
               "bottom", 70, observed=False)
    f.add_room("f1-canteen", "Stolowka i bufet", "BUF", 8, 32, 13, 20,
               "top", 13, observed=True)
    f.add_room("f1-kitchen", "Zaplecze stolowki", "KUCH", 21, 32, 11, 20,
               "top", 25, observed=False, boss_ready=False)
    f.add_room("f1-recreation", "Sala rekreacyjna", "REC", 52, 32, 10, 20,
               "top", 56, observed=True)
    f.add_room("f1-wc", "Toalety", "WC 1", 62, 32, 5, 20,
               "top", 63, observed=False, boss_ready=False)
    f.add_room("f1-room111", "Sala lekcyjna", "111", 67, 32, 9, 20,
               "top", 70, observed=True)
    f.feature("B", [(34 + x, 20) for x in range(7)] + [(43 + x, 36) for x in range(6)])
    f.feature("L", [(23 + x, 24) for x in range(5)] + [(55 + x, 31) for x in range(5)])
    for i, (x, y) in enumerate([(12, 28), (28, 29), (36, 27), (48, 29), (58, 28), (72, 27)], 1):
        f.npc(f"npc-1-{i:02d}", x, y)
    return f


def build_floor_2() -> Floor:
    f = Floor(2, "Pietro 2", "Sala 214, hol z gablotami i dlugi korytarz")
    common_shell(f, observed_stairs=True)
    f.add_hall("f2-trophy-hall", "Hol z gablotami i pufami", 34, 18, 17, 20,
               observed=True)
    f.add_room("f2-211", "Pracownia elektroniki", "211", 8, 4, 13, 20,
               "bottom", 13, observed=False)
    f.add_room("f2-212", "Pracownia automatyki", "212", 21, 4, 13, 20,
               "bottom", 26, observed=False)
    f.add_room("f2-214", "Sala jezyka angielskiego", "214", 51, 4, 13, 20,
               "bottom", 56, observed=True)
    f.add_room("f2-215", "Sala lekcyjna", "215", 64, 4, 12, 20,
               "bottom", 69, observed=False)
    f.add_room("f2-216", "Pracownia sieci", "216", 8, 32, 13, 20,
               "top", 13, observed=False)
    f.add_room("f2-217", "Pracownia elektroniczna", "217", 21, 32, 13, 20,
               "top", 26, observed=False)
    f.add_room("f2-wc-w", "Toaleta damska", "WC K", 51, 32, 8, 20,
               "top", 54, observed=True, boss_ready=False)
    f.add_room("f2-wc-m", "Toaleta meska", "WC M", 59, 32, 8, 20,
               "top", 62, observed=True, boss_ready=False)
    f.add_room("f2-218", "Sala lekcyjna", "218", 67, 32, 9, 20,
               "top", 70, observed=False)
    f.feature("B", [(10 + x, 31) for x in range(5)] + [(68 + x, 24) for x in range(5)])
    f.feature("L", [(22 + x, 24) for x in range(5)] + [(53 + x, 31) for x in range(4)])
    for i, (x, y) in enumerate([(15, 27), (29, 29), (37, 26), (48, 30), (57, 27), (71, 29)], 1):
        f.npc(f"npc-2-{i:02d}", x, y)
    return f


def build_floor_3() -> Floor:
    f = Floor(3, "Pietro 3", "Pracownie techniczne 3xx i toalety")
    common_shell(f, observed_stairs=True)
    f.add_room("f3-301", "Sala matematyczna", "301", 8, 4, 12, 20,
               "bottom", 13, observed=False)
    f.add_room("f3-303", "Pracownia elektryczna", "303", 20, 4, 14, 20,
               "bottom", 26, observed=False)
    f.add_room("f3-305", "Pracownia sieciowa", "305", 34, 4, 13, 20,
               "bottom", 39, observed=False)
    f.add_room("f3-313", "Sportowe programowanie", "313", 47, 4, 15, 20,
               "bottom", 53, observed=True)
    f.add_room("f3-314", "Pracownia komputerowa", "314", 62, 4, 14, 20,
               "bottom", 68, observed=True)
    f.add_room("f3-302", "Pracownia automatyki", "302", 8, 32, 12, 20,
               "top", 13, observed=False)
    f.add_room("f3-304", "Pracownia robotyki", "304", 20, 32, 14, 20,
               "top", 26, observed=False)
    f.add_room("f3-306", "Serwerownia / sieci", "306", 34, 32, 13, 20,
               "top", 39, observed=False)
    f.add_room("f3-wc-w", "Toaleta damska", "WC K", 47, 32, 9, 20,
               "top", 50, observed=True, boss_ready=False)
    f.add_room("f3-wc-m", "Toaleta meska", "WC M", 56, 32, 9, 20,
               "top", 59, observed=True, boss_ready=False)
    f.add_room("f3-315", "Laboratorium", "315", 65, 32, 11, 20,
               "top", 69, observed=False)
    f.feature("B", [(10 + x, 31) for x in range(5)] + [(67 + x, 24) for x in range(5)])
    f.feature("L", [(22 + x, 24) for x in range(6)] + [(36 + x, 31) for x in range(6)] + [(52 + x, 24) for x in range(5)])
    for i, (x, y) in enumerate([(14, 27), (30, 29), (40, 26), (52, 29), (61, 27), (72, 29)], 1):
        f.npc(f"npc-3-{i:02d}", x, y)
    return f


def stair_links() -> list[dict]:
    links = []
    for stair_id, x, y in [("A", 5, 27), ("B", 78, 27)]:
        for low in range(3):
            high = low + 1
            links.append({
                "id": f"stairs-{stair_id}-{low}-{high}-up",
                "staircase": stair_id, "floor": low, "x": x, "y": y,
                "target": {"floor": high, "x": x, "y": y},
            })
            links.append({
                "id": f"stairs-{stair_id}-{high}-{low}-down",
                "staircase": stair_id, "floor": high, "x": x, "y": y,
                "target": {"floor": low, "x": x, "y": y},
            })
    return links


ASSUMPTIONS = [
    "Zdjecia pokazuja bezposrednio pietra 1–3; caly parter jest rekonstrukcja funkcjonalna.",
    "Pierwsza cyfra numeru sali oznacza kondygnacje; dlatego sale 111, 214 i 313/314 przypisano odpowiednio do pieter 1, 2 i 3.",
    "Dwie klatki schodowe A i B powtarzaja sie w tym samym polozeniu na wszystkich kondygnacjach; zdjecia nie pozwalaja zmierzyc ich wzajemnej odleglosci.",
    "Uklad ma forme dlugiego traktu z salami po obu stronach, zgodnie z perspektywa korytarzy; dokladne dlugosci i szerokosci zostaly ujednolicone do siatki.",
    "Biblioteka, aula, sala gimnastyczna, gabinety, szatnie i wiekszosc nazw pracowni nie sa widoczne na zdjeciach — rozmieszczono je logicznie i oznaczono jako nieobserwowane.",
    "Numer 314 jest czesciowo zasloniety znakiem zakazu telefonu; odczyt traktowany jest jako prawdopodobny, nie pewny.",
    "Bufet/stolowke i sale rekreacyjna przypisano do pietra 1 na podstawie kolejnosci zdjec po zejsciu ze schodow; polaczenie nie jest pokazane w jednym kadrze.",
    "Okna, lawki, szafki i pufy odwzorowano jako rytm charakterystycznych elementow, nie jako pomiar kazdego egzemplarza.",
]


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def zone_fill(zone: dict) -> str:
    if zone["type"] == "hall":
        return "#eadfca"
    if zone["type"] == "stairs":
        return COLORS["S"]
    return "#dceaf3" if zone.get("observed") else "#e8eef2"


def svg_for_floor(floor: dict) -> str:
    map_w = WIDTH * CELL
    map_h = HEIGHT * CELL
    total_w = OX * 2 + map_w
    total_h = OY + map_h + 132
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{total_h}" viewBox="0 0 {total_w} {total_h}">',
        '<rect width="100%" height="100%" fill="#fafafa"/>',
        f'<text x="{OX}" y="34" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#17252a">ZSTI Gliwice — {esc(floor["name"])}</text>',
        f'<text x="{OX}" y="61" font-family="Arial, sans-serif" font-size="15" fill="#455a64">{esc(floor["subtitle"])} · siatka {WIDTH}×{HEIGHT} · 1 komorka = {CELL}px</text>',
    ]
    # Komorki: kolor podlogi zalezy od strefy, cechy od kodu.
    zone_at = {}
    for z in floor["zones"]:
        for yy in range(z["y"], z["y"] + z["h"]):
            for xx in range(z["x"], z["x"] + z["w"]):
                zone_at.setdefault((xx, yy), z)
    for y, row in enumerate(floor["grid"]):
        for x, code in enumerate(row):
            fill = COLORS[code]
            if code == ".":
                fill = zone_fill(zone_at.get((x, y), {"type": "hall"}))
            px = OX + x * CELL
            py = OY + y * CELL
            out.append(f'<rect x="{px}" y="{py}" width="{CELL}" height="{CELL}" fill="{fill}" stroke="#000" stroke-opacity="0.08" stroke-width="0.5"/>')
            if code == "S" and (x + y) % 2 == 0:
                out.append(f'<path d="M {px + 2} {py + 13} L {px + 14} {py + 3}" stroke="#7a3e00" stroke-width="2"/>')
            elif code == "D":
                out.append(f'<path d="M {px + 3} {py + 13} L {px + 13} {py + 3}" stroke="#fff" stroke-width="2"/>')
            elif code == "L":
                out.append(f'<rect x="{px + 3}" y="{py + 3}" width="10" height="10" rx="1" fill="none" stroke="#fff" stroke-width="1.5"/>')
            elif code == "W":
                out.append(f'<path d="M {px + 2} {py + 5} H {px + 14} M {px + 2} {py + 11} H {px + 14}" stroke="#e3f2fd" stroke-width="2"/>')
            elif code == "B":
                out.append(f'<path d="M {px + 2} {py + 5} H {px + 14} M {px + 4} {py + 5} V {py + 13} M {px + 12} {py + 5} V {py + 13}" stroke="#fff4df" stroke-width="1.5"/>')
            elif code == "E":
                out.append(f'<path d="M {px + 8} {py + 2} V {py + 13} M {px + 4} {py + 9} L {px + 8} {py + 13} L {px + 12} {py + 9}" fill="none" stroke="#fff" stroke-width="2"/>')
    # Etykiety stref.
    for z in floor["zones"]:
        if not z.get("label", True):
            continue
        cx = OX + (z["x"] + z["w"] / 2) * CELL
        cy = OY + (z["y"] + z["h"] / 2) * CELL
        number = z.get("number", "")
        if number:
            out.append(f'<text x="{cx:.1f}" y="{cy - 8:.1f}" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#102a43">{esc(number)}</text>')
            out.append(f'<text x="{cx:.1f}" y="{cy + 13:.1f}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#243b53">{esc(z["name"])}</text>')
        else:
            out.append(f'<text x="{cx:.1f}" y="{cy:.1f}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#53310b">{esc(z["name"])}</text>')
        if not z.get("observed", False) and z["type"] == "room":
            out.append(f'<text x="{cx:.1f}" y="{cy + 31:.1f}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#607d8b">(zalozenie)</text>')
    # Numery przy drzwiach.
    for d in floor["doors"]:
        cells = d["cells"]
        cx = OX + (sum(c["x"] for c in cells) / len(cells) + 0.5) * CELL
        base_y = cells[0]["y"]
        cy = OY + (base_y + (1.55 if d["orientation"] == "bottom" else -0.28)) * CELL
        out.append(f'<text x="{cx:.1f}" y="{cy:.1f}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#1b5e20">drzwi {esc(d["number"])}</text>')
    # NPC bez postaci — tylko ponumerowane sloty.
    for npc in floor["npc_slots"]:
        cx = OX + (npc["x"] + 0.5) * CELL
        cy = OY + (npc["y"] + 0.5) * CELL
        out.append(f'<circle cx="{cx}" cy="{cy}" r="5" fill="#00897b" stroke="#fff" stroke-width="1.5"/>')
    # Legenda w tym samym pliku, takze widoczna po rasteryzacji PNG.
    ly = OY + map_h + 34
    items = [
        ("#", "sciana"), (".", "podloga sali"), (".", "korytarz / hol"),
        ("D", "drzwi"), ("S", "schody"), ("L", "szafki"),
        ("W", "okno"), ("B", "lawka"), ("E", "wejscie"),
    ]
    out.append(f'<text x="{OX}" y="{ly - 14}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#263238">Legenda (wbudowana w obraz)</text>')
    for i, (code, label) in enumerate(items):
        col = i % 5
        row = i // 5
        x = OX + col * 260
        y = ly + row * 34
        fill = COLORS[code]
        if code == ".":
            fill = "#dceaf3" if i == 1 else "#eadfca"
        out.append(f'<rect x="{x}" y="{y}" width="22" height="22" fill="{fill}" stroke="#455a64"/>')
        out.append(f'<text x="{x + 31}" y="{y + 16}" font-family="Arial, sans-serif" font-size="13" fill="#263238">{esc(label)}</text>')
    out.append(f'<circle cx="{OX + 4 * 260 + 11}" cy="{ly + 34 + 11}" r="5" fill="#00897b"/>')
    out.append(f'<text x="{OX + 4 * 260 + 31}" y="{ly + 34 + 16}" font-family="Arial, sans-serif" font-size="13" fill="#263238">slot NPC</text>')
    out.append('</svg>')
    return "\n".join(out)


def rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def ascii_text(value: object) -> str:
    normalized = unicodedata.normalize("NFKD", str(value))
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).upper()


def png_for_floor(floor: dict, path: Path) -> None:
    """Zapisuje prawdziwy PNG RGB przez zlib+struct, bez Pillow."""
    width = OX * 2 + WIDTH * CELL
    height = OY + HEIGHT * CELL + 132
    pixels = bytearray(rgb("#fafafa") * (width * height))

    def rectangle(x: int, y: int, w: int, h: int, color: str | tuple[int, int, int]) -> None:
        color_rgb = rgb(color) if isinstance(color, str) else color
        left = max(0, x)
        right = min(width, x + w)
        if right <= left:
            return
        row = bytes(color_rgb) * (right - left)
        for yy in range(max(0, y), min(height, y + h)):
            start = (yy * width + left) * 3
            pixels[start:start + len(row)] = row

    def line(x1: int, y1: int, x2: int, y2: int, color: str, thick: int = 1) -> None:
        color_rgb = rgb(color)
        dx = abs(x2 - x1)
        sx = 1 if x1 < x2 else -1
        dy = -abs(y2 - y1)
        sy = 1 if y1 < y2 else -1
        err = dx + dy
        while True:
            rectangle(x1 - thick // 2, y1 - thick // 2, thick, thick, color_rgb)
            if x1 == x2 and y1 == y2:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x1 += sx
            if e2 <= dx:
                err += dx
                y1 += sy

    def text_width(value: str, scale: int) -> int:
        return max(0, len(value) * 6 * scale - scale)

    def draw_text(x: int, y: int, value: object, color: str = "#17252a", scale: int = 1,
                  center: bool = False) -> None:
        value = ascii_text(value)
        if center:
            x -= text_width(value, scale) // 2
        color_rgb = rgb(color)
        cursor = x
        for char in value:
            glyph = FONT.get(char, FONT["?"])
            for gy, row in enumerate(glyph):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        rectangle(cursor + gx * scale, y + gy * scale, scale, scale, color_rgb)
            cursor += 6 * scale

    zone_at = {}
    for zone in floor["zones"]:
        for yy in range(zone["y"], zone["y"] + zone["h"]):
            for xx in range(zone["x"], zone["x"] + zone["w"]):
                zone_at.setdefault((xx, yy), zone)

    draw_text(OX, 18, f'ZSTI GLIWICE - {floor["name"]}', scale=3)
    draw_text(OX, 54, f'{floor["subtitle"]} | SIATKA {WIDTH}X{HEIGHT} | KOMORKA {CELL}PX',
              color="#455a64", scale=1)

    for y, row in enumerate(floor["grid"]):
        for x, code in enumerate(row):
            fill = COLORS[code]
            if code == ".":
                fill = zone_fill(zone_at.get((x, y), {"type": "hall"}))
            px, py = OX + x * CELL, OY + y * CELL
            rectangle(px, py, CELL, CELL, fill)
            line(px, py, px + CELL - 1, py, "#dfe5e7")
            line(px, py, px, py + CELL - 1, "#dfe5e7")
            if code == "S" and (x + y) % 2 == 0:
                line(px + 2, py + 13, px + 13, py + 3, "#7a3e00", 2)
            elif code == "D":
                line(px + 3, py + 13, px + 13, py + 3, "#ffffff", 2)
            elif code == "L":
                line(px + 3, py + 3, px + 12, py + 3, "#ffffff")
                line(px + 3, py + 12, px + 12, py + 12, "#ffffff")
                line(px + 3, py + 3, px + 3, py + 12, "#ffffff")
                line(px + 12, py + 3, px + 12, py + 12, "#ffffff")
            elif code == "W":
                line(px + 2, py + 5, px + 13, py + 5, "#e3f2fd", 2)
                line(px + 2, py + 11, px + 13, py + 11, "#e3f2fd", 2)
            elif code == "B":
                line(px + 2, py + 5, px + 13, py + 5, "#fff4df", 2)
                line(px + 4, py + 5, px + 4, py + 13, "#fff4df")
                line(px + 12, py + 5, px + 12, py + 13, "#fff4df")
            elif code == "E":
                line(px + 8, py + 2, px + 8, py + 13, "#ffffff", 2)
                line(px + 4, py + 9, px + 8, py + 13, "#ffffff", 2)
                line(px + 12, py + 9, px + 8, py + 13, "#ffffff", 2)

    for zone in floor["zones"]:
        if not zone.get("label", True):
            continue
        cx = int(OX + (zone["x"] + zone["w"] / 2) * CELL)
        cy = int(OY + (zone["y"] + zone["h"] / 2) * CELL)
        labels = []
        if zone.get("number"):
            labels.append((zone["number"], 2, "#102a43"))
        max_chars = max(6, int(zone["w"] * CELL / 12))
        for part in textwrap.wrap(ascii_text(zone["name"]), width=max_chars) or [ascii_text(zone["name"])]:
            labels.append((part, 2, "#243b53" if zone["type"] == "room" else "#53310b"))
        if not zone.get("observed", False) and zone["type"] == "room":
            labels.append(("(ZALOZENIE)", 1, "#607d8b"))
        total = sum(7 * scale + 5 for _, scale, _ in labels)
        ty = cy - total // 2
        for value, scale, color in labels:
            draw_text(cx, ty, value, color=color, scale=scale, center=True)
            ty += 7 * scale + 5

    for door in floor["doors"]:
        cells = door["cells"]
        cx = int(OX + (sum(c["x"] for c in cells) / len(cells) + 0.5) * CELL)
        base_y = cells[0]["y"]
        cy = int(OY + (base_y + (1.3 if door["orientation"] == "bottom" else -0.7)) * CELL)
        draw_text(cx, cy, f'DRZWI {door["number"]}', color="#1b5e20", scale=1, center=True)

    for npc in floor["npc_slots"]:
        cx = OX + npc["x"] * CELL + 5
        cy = OY + npc["y"] * CELL + 5
        rectangle(cx, cy, 7, 7, "#00897b")
        rectangle(cx + 2, cy + 2, 3, 3, "#ffffff")

    legend_y = OY + HEIGHT * CELL + 24
    draw_text(OX, legend_y, "LEGENDA WBUDOWANA W OBRAZ", scale=2)
    items = [("#", "SCIANA"), (".", "SALA"), (".", "KORYTARZ"), ("D", "DRZWI"),
             ("S", "SCHODY"), ("L", "SZAFKI"), ("W", "OKNO"), ("B", "LAWKA"), ("E", "WEJSCIE")]
    for i, (code, label) in enumerate(items):
        col, row_no = i % 5, i // 5
        x = OX + col * 260
        y = legend_y + 28 + row_no * 30
        fill = COLORS[code]
        if code == ".":
            fill = "#dceaf3" if i == 1 else "#eadfca"
        rectangle(x, y, 20, 20, fill)
        draw_text(x + 28, y + 6, label, scale=1)

    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride:(y + 1) * stride])

    def chunk(kind: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def build_index(floors: list[dict]) -> str:
    sections = []
    for f in floors:
        sections.append(f'''<section>
  <h2>{esc(f["name"])}</h2>
  <p>{esc(f["subtitle"])}. <a href="pietro-{f["level"]}.svg">Otworz SVG</a> · <a href="pietro-{f["level"]}.png">Otworz PNG</a></p>
  <img src="pietro-{f["level"]}.svg" alt="Plan: {esc(f["name"])}" loading="lazy">
</section>''')
    return f'''<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mapa ZSTI Gliwice</title>
  <style>
    :root {{ color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef2f3; color: #17252a; }}
    body {{ margin: 0 auto; max-width: 1500px; padding: 24px; }}
    header, section {{ background: white; border: 1px solid #cfd8dc; border-radius: 12px; padding: 20px; margin: 0 0 24px; box-shadow: 0 3px 14px #0001; }}
    h1, h2 {{ margin-top: 0; }}
    p {{ line-height: 1.55; }}
    img {{ width: 100%; height: auto; display: block; border: 1px solid #b0bec5; background: #fafafa; }}
    .notice {{ border-left: 5px solid #f28c28; padding-left: 14px; }}
    a {{ color: #00695c; }}
  </style>
</head>
<body>
<header>
  <h1>Mapa budynku ZSTI Gliwice</h1>
  <p>Cztery poziomy, kazdy 84×56 komorek. Plany sa rekonstrukcja projektowa ze zdjec, a nie dokumentacja budowlana ani ewakuacyjna.</p>
  <p class="notice">Pietra 1–3 oparto na zdjeciach. Parter oraz pomieszczenia niewidoczne na zdjeciach sa jawnymi zalozeniami opisanymi w <a href="OPIS.md">OPIS.md</a>.</p>
  <p><a href="mapa.json">Dane JSON</a> · <a href="OPIS.md">Opis i zrodla</a> · <a href="sprawdz.py">Skrypt kontrolny</a></p>
</header>
{"".join(sections)}
</body>
</html>
'''


PHOTO_GROUPS = [
    ("IMG_4897.JPG, IMG_4898.JPG, IMG_4899.JPG", "klatka schodowa: spoczniki, dwubiegowy uklad, balustrady, drzwi z przeszkleniami"),
    ("IMG_4905.JPG, IMG_4906.JPG, IMG_4907.JPG", "dlugi korytarz pietra 3: okna po jednej stronie, sale po drugiej, lawki"),
    ("IMG_4908.JPG", "drzwi prawdopodobnej sali 314; numer czesciowo zasloniety"),
    ("IMG_4909.JPG", "drewniana lawka z niebieskim stelazem przy scianie"),
    ("IMG_4910.JPG", "zakonczenie korytarza pietra 3 i rytm drzwi"),
    ("IMG_4911.JPG", "sala 313 — sportowe programowanie"),
    ("IMG_4913.JPG", "korytarz pietra 3 i szerokosc przejscia"),
    ("IMG_4914.JPG, IMG_4915.JPG", "klatka schodowa przy pietrze 3"),
    ("IMG_4916.JPG, IMG_4917.JPG, IMG_4918.JPG, IMG_4920.JPG, IMG_4921.JPG, IMG_4922.JPG, IMG_4923.JPG, IMG_4924.JPG, IMG_4925.JPG", "zespol toalet: umywalki, kabiny, okna, uklad przedsionkow"),
    ("IMG_4926.JPG, IMG_4927.JPG, IMG_4928.JPG", "klatka schodowa i wejscie do WC meskiego"),
    ("IMG_4929.JPG, IMG_4930.JPG", "dlugi korytarz pietra 2"),
    ("IMG_4934.JPG, IMG_4935.JPG", "wezel holu pietra 2, lawka i wejscie do sali 214"),
    ("IMG_4937.JPG", "hol z pufami, gablotami, pucharami i oknami"),
    ("IMG_4938.JPG", "korytarz odchodzacy od holu pietra 2"),
    ("IMG_4940.JPG", "druga strona holu z pufami i gablota"),
    ("IMG_4941.JPG", "sala 214 — sala jezyka angielskiego"),
    ("IMG_4942.JPG, IMG_4943.JPG", "polaczenie holu z dlugim korytarzem, kosze i lawki"),
    ("IMG_4944.JPG, IMG_4945.JPG, IMG_4946.JPG, IMG_4947.JPG, IMG_4948.JPG", "toalety damska i meska na pietrze 2"),
    ("IMG_4949.JPG, IMG_4950.JPG, IMG_4951.JPG", "klatka schodowa miedzy pietrami 2 i 1"),
    ("IMG_4952.JPG, IMG_4953.JPG", "korytarz pietra 1, krzesla przy scianie, drzwi sali 111"),
    ("IMG_4954.JPG, IMG_4955.JPG, IMG_4956.JPG", "kolorowy hol pietra 1: kanapy, pufy, okna i sciana osiagniec"),
    ("IMG_4957.JPG", "sala rekreacyjna z pilkarzykami i skladanymi krzeslami"),
    ("IMG_4959.JPG", "bufet/stolowka z lada i witryna"),
]


def build_description(floors: list[dict]) -> str:
    room_lines = []
    for f in floors:
        rooms = [z for z in f["zones"] if z["type"] == "room"]
        room_lines.append(f'### {f["name"]}\n\n' + ", ".join(
            f'{z.get("number", "—")} — {z["name"]}' + (" *(zalozenie)*" if not z.get("observed") else "")
            for z in rooms
        ) + ".")
    photos = "\n".join(f"- **{names}:** {use}." for names, use in PHOTO_GROUPS)
    assumptions = "\n".join(f"- {item}" for item in ASSUMPTIONS)
    return f'''# Opis mapy ZSTI Gliwice

## Zakres

Mapa ma **4 kondygnacje**: parter (`pietro-0`) oraz pietra 1–3. Kazdy plan ma **84×56 komorek**, a pojedyncza komorka jest rasteryzowana jako **16×16 px**. To rekonstrukcja do projektowania poziomow, nie plan budowlany ani ewakuacyjny.

Bezposrednio udokumentowane sa dlugie korytarze z lawkami i oknami, dwubiegowe klatki schodowe, toalety, sale 111, 214, 313 i prawdopodobnie 314, dwa hole wypoczynkowe, sala rekreacyjna oraz bufet. Brakujace funkcje calego budynku dopelniono logicznie i jawnie oznaczono.

## Sale i funkcje

{"\n\n".join(room_lines)}

## Powiazanie zdjec z mapa

Przejrzano wszystkie 50 plikow JPG z `.map-photos/`:

{photos}

## Zalozenia i niepewnosci

{assumptions}

## Kontrola techniczna

Wynik ostatniego uruchomienia `python3 mapa/sprawdz.py`:

```text
KONTROLA: OK
Pietra: 4
Rozmiary siatek: OK (84x56 na kazdym pietrze)
Strefy: OK (50; pelne pokrycie podlogi)
Drzwi: OK (35; kazde wejscie ma >= 2 komorki)
Schody: OK (12 kierunkowych laczy; wszystkie sparowane)
Sloty NPC: OK (22)
Osiagalnosc: OK (10177/10177 przechodnich komorek od wejscia)
```
'''


def main() -> None:
    floors_obj = [build_floor_0(), build_floor_1(), build_floor_2(), build_floor_3()]
    floors = [f.as_dict() for f in floors_obj]
    data = {
        "schema_version": 1,
        "title": "Rekonstrukcja mapy ZSTI Gliwice",
        "cell_size_px": CELL,
        "legend": LEGEND,
        "traversable_codes": [".", "D", "S", "E"],
        "floors": floors,
        "stairs": stair_links(),
        "main_entrance": {"floor": 0, "x": 41, "y": 54, "description": "Wejscie glowne i start gracza"},
        "assumptions": ASSUMPTIONS,
    }
    (ROOT / "mapa.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for floor in floors:
        (ROOT / f'pietro-{floor["level"]}.svg').write_text(svg_for_floor(floor), encoding="utf-8")
    (ROOT / "index.html").write_text(build_index(floors), encoding="utf-8")
    (ROOT / "OPIS.md").write_text(build_description(floors), encoding="utf-8")

    for floor in floors:
        png_for_floor(floor, ROOT / f'pietro-{floor["level"]}.png')
    print(f"Wygenerowano {len(floors)} pietra, SVG, PNG, JSON, HTML i OPIS.md")


if __name__ == "__main__":
    main()
