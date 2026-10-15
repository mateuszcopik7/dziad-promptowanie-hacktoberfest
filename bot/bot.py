#!/usr/bin/env python3
"""Bot grajacy w Gliwice Raid.

Steruje gra w przegladarce przez Playwright. Czyta stan z window.raid.state(),
planuje trase (BFS po siatce pietra), celuje i strzela przez window.raid.setIntent().
Dialogi obsluguje prawdziwymi klawiszami (Z / X / strzalki), menu klikajac przyciski.

Misja: quest "Bugi w korytarzu" od Woznego Heńka (parter) od poczatku do konca:
idz do NPC, rozmowa, przyjmij quest, zabij 5 bugow, wroc, odbierz nagrode.
"""
import argparse
import math
import time
from collections import deque
from pathlib import Path

DEFAULT_URL = (Path(__file__).resolve().parent.parent / "index.html").as_uri()
TICK_S = 1 / 40
LOW_HP = 25
TALK_RANGE = 1.5
KEEP_DISTANCE = 2.2
FIRE_RANGE = 9
AIM_TOLERANCE = 0.06
FACE_TOLERANCE = 0.12
MAX_TURN = 0.05
TURN_GAIN = 0.3
IDLE = {"move": 0, "strafe": 0, "turn": 0, "fire": False}
MISSION_GIVER = "woznik"
MISSION_QUEST = "bugi"
CHOICE_ORDER = ["accept", "turnin", "deliver", "close"]     # ktora opcja dialogu ma pierwszenstwo


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


def dist_to(p, t):
    return math.hypot(t["x"] - p["x"], t["y"] - p["y"])


def next_waypoint(state, target):
    """Srodek nastepnej komorki trasy do celu; sam cel, gdy go widac albo brak trasy."""
    p, grid = state["player"], state["grid"]
    if has_los(grid, p["x"], p["y"], target["x"], target["y"]):
        return target["x"], target["y"]
    path = find_path(grid, (int(p["x"]), int(p["y"])), (int(target["x"]), int(target["y"])))
    if path and len(path) > 1:
        return path[1][0] + 0.5, path[1][1] + 0.5
    return target["x"], target["y"]


def turn_toward(p, wx, wy):
    err = norm_angle(math.atan2(wy - p["y"], wx - p["x"]) - p["angle"])
    return err, max(-MAX_TURN, min(MAX_TURN, err * TURN_GAIN))


def hunt(state):
    """Najblizszy wrog: podejdz, wycelu, strzelaj. Intent albo None gdy brak wrogow."""
    p, grid = state["player"], state["grid"]
    if not state["enemies"]:
        return None
    target = min(state["enemies"], key=lambda t: dist_to(p, t))
    dist = dist_to(p, target)
    seen = has_los(grid, p["x"], p["y"], target["x"], target["y"])
    wx, wy = next_waypoint(state, target)
    err, turn = turn_toward(p, wx, wy)
    return {
        "move": 1 if abs(err) < 0.5 and not (seen and dist < KEEP_DISTANCE) else 0,
        "strafe": 0,
        "turn": turn,
        "fire": bool(seen and abs(err) < AIM_TOLERANCE and dist < FIRE_RANGE),
    }


def visit(state, npc_id):
    """Podejdz do NPC, spojrz na niego, nacisnij E. Intent albo None gdy NPC nie na pietrze."""
    npc = next((n for n in state["npcs"] if n["id"] == npc_id), None)
    if npc is None:
        return None
    p = state["player"]
    dist = dist_to(p, npc)
    wx, wy = next_waypoint(state, npc) if dist > TALK_RANGE else (npc["x"], npc["y"])
    err, turn = turn_toward(p, wx, wy)
    close = dist < TALK_RANGE
    return {
        "move": 1 if abs(err) < 0.5 and not close else 0,
        "strafe": 0,
        "turn": turn,
        "fire": False,
        "interact": bool(close and abs(err) < FACE_TOLERANCE),
    }


def mission_status(state):
    return state["quests"].get(MISSION_QUEST, {}).get("status", "available")


def decide(state):
    """Intent dla sceny 'play' wg misji; None gdy misja skonczona."""
    status = mission_status(state)
    if status == "done":
        return None
    p = state["player"]
    intent = None
    if status == "active":
        intent = hunt(state) or IDLE
    else:                                       # available (idz po quest) albo ready (idz po nagrode)
        intent = visit(state, MISSION_GIVER) or IDLE
    if p["hp"] < LOW_HP and state["food"] > 0:
        intent = {**intent, "heal": True}
    return intent


def dialogue_key(d):
    """Klawisz do nacisniecia w dialogu wg fazy (pisanie: X pomija, czekanie: Z, wybor: strzalki+Z)."""
    if d["phase"] == "type":
        return "KeyX"
    if d["phase"] == "wait":
        return "KeyZ"
    if d["phase"] == "choice":
        want = next((c for c in CHOICE_ORDER if c in d["options"]), d["options"][0])
        idx = d["options"].index(want)
        if d["cursor"] == idx:
            return "KeyZ"
        return "ArrowDown" if d["cursor"] < idx else "ArrowUp"
    return None


def log(t0, msg):
    print(f"[{time.time() - t0:6.1f}s] {msg}")


def play(page, timeout):
    page.click("[data-a=play]")
    t0, last = time.time(), None
    while time.time() - t0 < timeout:
        s = page.evaluate("raid.state()")
        scene = s["scene"]
        key = (scene, mission_status(s), len(s["enemies"]))
        if key != last:
            log(t0, f"scena={scene} quest={key[1]} bugi_zywe={key[2]} hp={s['player']['hp']} xp={s['player']['xp']} lvl={s['player']['level']}")
            last = key
        if scene == "play":
            intent = decide(s)
            if intent is None:
                page.evaluate("raid.setIntent(null)")
                return True
            page.evaluate("it => raid.setIntent(it)", intent)
            time.sleep(TICK_S)
            continue
        page.evaluate("raid.setIntent(null)")
        if scene == "dialogue" and s["dialogue"]:
            k = dialogue_key(s["dialogue"])
            if k:
                page.keyboard.press(k)
            time.sleep(0.12)
        elif scene == "encounter":
            page.keyboard.press("KeyZ")
            time.sleep(0.12)
        elif scene == "paused":
            page.click("[data-a=resume]")
        elif scene == "dead":
            page.click("[data-a=retry]")
        else:
            time.sleep(0.3)
    return False


def main():
    ap = argparse.ArgumentParser(description="Bot grajacy w Gliwice Raid (misja: Bugi w korytarzu)")
    ap.add_argument("--url", default=DEFAULT_URL, help="adres gry (domyslnie lokalny index.html)")
    ap.add_argument("--headless", action="store_true", help="bez okna przegladarki")
    ap.add_argument("--timeout", type=int, default=300, help="limit czasu misji w sekundach")
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        page = browser.new_page(viewport={"width": 1100, "height": 700})
        page.on("pageerror", lambda e: print("blad strony:", e))
        page.goto(args.url)
        ok = False
        try:
            ok = play(page, args.timeout)
        except KeyboardInterrupt:
            pass
        finally:
            browser.close()
    print("Misja ukonczona." if ok else "Misja nieukonczona (limit czasu albo przerwanie).")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
