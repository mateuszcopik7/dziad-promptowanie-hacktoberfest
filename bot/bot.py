#!/usr/bin/env python3
"""Bot grajacy w Gliwice Raid.

Steruje gra w przegladarce przez Playwright: czyta stan z window.raid.state(),
planuje trase (BFS po siatce mapy), celuje i strzela przez window.raid.setIntent().
Menu obsluguje klikajac prawdziwe przyciski.
"""
import argparse
import math
import time
from collections import deque
from pathlib import Path

from playwright.sync_api import sync_playwright

DEFAULT_URL = (Path(__file__).resolve().parent.parent / "index.html").as_uri()
TICK_S = 1 / 40
LOW_AMMO = 6
LOW_HP = 40
KEEP_DISTANCE = 2.2
FIRE_RANGE = 9
AIM_TOLERANCE = 0.06
MAX_TURN = 0.05
TURN_GAIN = 0.3
IDLE = {"move": 0, "strafe": 0, "turn": 0, "fire": False}


def norm_angle(a):
    while a > math.pi:
        a -= 2 * math.pi
    while a < -math.pi:
        a += 2 * math.pi
    return a


def find_path(grid, start, goal):
    """Najkrotsza trasa po wolnych komorkach (BFS), albo None."""
    h, w = len(grid), len(grid[0])
    prev = {start: None}
    queue = deque([start])
    while queue:
        cur = queue.popleft()
        if cur == goal:
            break
        x, y = cur
        for nxt in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            nx, ny = nxt
            if 0 <= nx < w and 0 <= ny < h and not grid[ny][nx] and nxt not in prev:
                prev[nxt] = cur
                queue.append(nxt)
    if goal not in prev:
        return None
    path, cur = [], goal
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    return path[::-1]


def has_los(grid, x1, y1, x2, y2):
    """Czy miedzy dwoma punktami nie ma sciany (probkowanie co 0.1)."""
    d = math.hypot(x2 - x1, y2 - y1)
    steps = max(1, int(d / 0.1))
    for i in range(1, steps):
        t = i / steps
        if grid[int(y1 + (y2 - y1) * t)][int(x1 + (x2 - x1) * t)]:
            return False
    return True


def pick_target(state):
    """Cel: pendrive gdy brakuje amunicji, jedzenie gdy brakuje HP, inaczej najblizszy wrog."""
    p = state["player"]
    usb = [k for k in state["pickups"] if k["kind"] == "usb"]
    food = [k for k in state["pickups"] if k["kind"] == "food"]
    if p["ammo"] < LOW_AMMO and usb:
        pool = usb
    elif p["hp"] < LOW_HP and food:
        pool = food
    else:
        pool = state["enemies"]
    if not pool:
        return None, False
    target = min(pool, key=lambda t: math.hypot(t["x"] - p["x"], t["y"] - p["y"]))
    return target, pool is state["enemies"]


def decide(state):
    """Zamienia stan gry na intent {move, strafe, turn, fire}."""
    target, is_enemy = pick_target(state)
    if target is None:
        return IDLE
    p, grid = state["player"], state["grid"]
    dist = math.hypot(target["x"] - p["x"], target["y"] - p["y"])
    seen = is_enemy and has_los(grid, p["x"], p["y"], target["x"], target["y"])
    wx, wy = target["x"], target["y"]
    if not seen:
        path = find_path(grid, (int(p["x"]), int(p["y"])), (int(target["x"]), int(target["y"])))
        if path and len(path) > 1:
            wx, wy = path[1][0] + 0.5, path[1][1] + 0.5
    err = norm_angle(math.atan2(wy - p["y"], wx - p["x"]) - p["angle"])
    return {
        "move": 1 if abs(err) < 0.5 and not (seen and dist < KEEP_DISTANCE) else 0,
        "strafe": 0,
        "turn": max(-MAX_TURN, min(MAX_TURN, err * TURN_GAIN)),
        "fire": bool(seen and abs(err) < AIM_TOLERANCE and dist < FIRE_RANGE),
    }


def play(page, rounds):
    page.click("[data-a=play]")
    last_scene, level_started = None, time.time()
    while True:
        s = page.evaluate("raid.state()")
        scene = s["scene"]
        if scene != last_scene:
            print(f"[{time.time() - level_started:6.1f}s] scena={scene} poziom={s['level'] + 1} "
                  f"bugi={s['kills']}/{s['total']} hp={s['player']['hp']} lvl={s['player']['level']}")
            last_scene = scene
        if scene == "play":
            page.evaluate("it => raid.setIntent(it)", decide(s))
            time.sleep(TICK_S)
            continue
        page.evaluate("raid.setIntent(null)")
        time.sleep(0.8)                       # chwila na ekran wyniku
        if scene == "paused":
            page.click("[data-a=resume]")
        elif scene == "levelDone":
            page.click("[data-a=next]")
        elif scene == "dead":
            page.click("[data-a=retry]")
        elif scene == "victory":
            print("Wszystkie bugi naprawione.")
            rounds -= 1
            if rounds <= 0:
                return
            page.click("[data-a=play]")


def main():
    ap = argparse.ArgumentParser(description="Bot grajacy w Gliwice Raid")
    ap.add_argument("--url", default=DEFAULT_URL, help="adres gry (domyslnie lokalny index.html)")
    ap.add_argument("--headless", action="store_true", help="bez okna przegladarki")
    ap.add_argument("--rounds", type=int, default=1, help="ile razy przejsc cala gre")
    args = ap.parse_args()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        page = browser.new_page(viewport={"width": 1100, "height": 700})
        page.on("pageerror", lambda e: print("blad strony:", e))
        page.goto(args.url)
        try:
            play(page, args.rounds)
        except KeyboardInterrupt:
            pass
        finally:
            browser.close()


if __name__ == "__main__":
    main()
