#!/usr/bin/env python3
"""Bot grajacy w Gliwice Raid od startu do finalu.

Steruje gra w przegladarce przez Playwright. Czyta stan z window.raid.state() i window.raid.world(),
planuje trase (BFS po siatce pietra, schody miedzy pietrami), strzela przez window.raid.setIntent(),
dialogi i walki obsluguje prawdziwymi klawiszami (Z / X / strzalki).

Przebieg: 4 questy po kolei (bugi, pieczatka, liscik, klucz), potem aula i walka z Dyrektorem Bugow.
Walka: ACT zwieksza nastroj, przy pelnym MERCY oszczedza bossa. Pociski omija planerem (plan_dodge).
"""
import argparse
import math
import random
import time
from collections import deque
from pathlib import Path

DEFAULT_URL = (Path(__file__).resolve().parent.parent / "index.html").as_uri()
TICK_S = 1 / 40
GAME_SPEED = 3                                   # mnoznik tempa gry podczas chodzenia i dialogow
LOW_HP = 25
TALK_RANGE = 1.5
KEEP_DISTANCE = 2.2
FIRE_RANGE = 9
AIM_TOLERANCE = 0.06
FACE_TOLERANCE = 0.12
MAX_TURN = 0.05
TURN_GAIN = 0.3
NPC_CLEARANCE = 0.9
STUCK_SECONDS = 0.6
IDLE = {"move": 0, "strafe": 0, "turn": 0, "fire": False}
FINAL_ZONE = "f1-aula"
# w walce: stale z js/battle.js
BOX_W, BOX_H = 240, 120
HEART_R, HEART_SPEED = 5, 2.2
DODGE_HORIZON = 50
DODGE_MARGIN = 3
MAIN_MENU = ["fight", "act", "item", "mercy"]


def norm_angle(a):
    while a > math.pi:
        a -= 2 * math.pi
    while a < -math.pi:
        a += 2 * math.pi
    return a


def find_path(grid, start, goal, blocked=frozenset()):
    """Najkrotsza trasa po wolnych komorkach (BFS), albo None. blocked = dodatkowe zajete komorki."""
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
            if 0 <= nx < w and 0 <= ny < h and not grid[ny][nx] and nxt not in prev and (nxt not in blocked or nxt == goal):
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


def cell_of(p):
    return int(p["x"]), int(p["y"])


def npc_cells(state, skip=None):
    """Komorki zajete przez NPC (obchodzimy je, NPC blokuja ruch)."""
    out = set()
    for n in state["npcs"]:
        if n["id"] == skip:
            continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                cx, cy = int(n["x"]) + dx, int(n["y"]) + dy
                if math.hypot(cx + 0.5 - n["x"], cy + 0.5 - n["y"]) < NPC_CLEARANCE:
                    out.add((cx, cy))
    return out


def clear_line(grid, a, b):
    """Widocznosc z zapasem na promien gracza: trzy rownolegle promienie (srodek i boki)."""
    d = math.hypot(b["x"] - a["x"], b["y"] - a["y"]) or 1
    nx, ny = -(b["y"] - a["y"]) / d * 0.3, (b["x"] - a["x"]) / d * 0.3
    return all(has_los(grid, a["x"] + nx * k, a["y"] + ny * k, b["x"] + nx * k, b["y"] + ny * k) for k in (-1, 0, 1))


def segment_free(a, b, blocked):
    """Czy prosty odcinek nie wchodzi w komorki zajete przez NPC."""
    steps = max(1, math.ceil(math.hypot(b["x"] - a["x"], b["y"] - a["y"]) / 0.25))
    for i in range(steps + 1):
        x = a["x"] + (b["x"] - a["x"]) * i / steps
        y = a["y"] + (b["y"] - a["y"]) * i / steps
        if (int(x), int(y)) in blocked:
            return False
    return True


def next_waypoint(state, target, skip=None):
    """Srodek nastepnej komorki trasy do celu; sam cel, gdy go widac i droga nie wchodzi w NPC."""
    p, grid = state["player"], state["grid"]
    blocked = npc_cells(state, skip)
    if clear_line(grid, p, target) and segment_free(p, target, blocked):
        return target["x"], target["y"]
    path = find_path(grid, cell_of(p), (int(target["x"]), int(target["y"])), blocked)
    if path and len(path) > 1:
        return path[1][0] + 0.5, path[1][1] + 0.5
    return target["x"], target["y"]


def turn_toward(p, wx, wy):
    err = norm_angle(math.atan2(wy - p["y"], wx - p["x"]) - p["angle"])
    return err, max(-MAX_TURN, min(MAX_TURN, err * TURN_GAIN))


def walk_to(state, target, reach, skip=None):
    """Intent: idz do punktu target az do odleglosci reach."""
    p = state["player"]
    wx, wy = next_waypoint(state, target, skip)
    err, turn = turn_toward(p, wx, wy)
    return {"move": 1 if abs(err) < 0.5 and dist_to(p, target) > reach else 0, "strafe": 0, "turn": turn, "fire": False}


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


def face_and_talk(state, npc):
    """Podejdz do NPC na tym pietrze, spojrz na niego, nacisnij E."""
    p = state["player"]
    dist = dist_to(p, npc)
    wx, wy = next_waypoint(state, npc, npc["id"]) if dist > TALK_RANGE else (npc["x"], npc["y"])
    err, turn = turn_toward(p, wx, wy)
    close = dist < TALK_RANGE
    return {
        "move": 1 if abs(err) < 0.5 and not close else 0,
        "strafe": 0,
        "turn": turn,
        "fire": False,
        "interact": bool(close and abs(err) < FACE_TOLERANCE),
    }


# --- nawigacja miedzy pietrami ---------------------------------------------------------------------

def free_neighbors(grid, cell):
    x, y = cell
    return [(nx, ny) for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if 0 <= ny < len(grid) and 0 <= nx < len(grid[0]) and not grid[ny][nx]]


def stairs_step(state, world, want_floor):
    """Intent w strone schodow na sasiednie pietro (po jednym pietrze naraz)."""
    cur = state["floor"]
    nxt = cur + (1 if want_floor > cur else -1)
    p, grid = state["player"], state["grid"]
    blocked = npc_cells(state)
    best = None
    for s in world["stairs"]:
        if s["floor"] != cur or s["to"][0] != nxt:
            continue
        path = find_path(grid, cell_of(p), (s["x"], s["y"]), blocked)
        if path and (best is None or len(path) < len(best[0])):
            best = (path, s)
    if best is None:
        return IDLE
    path, s = best
    if state.get("stairLock"):                      # po zejsciu schody sa zablokowane: wyjdz z klatki i wejdz znowu
        out = 9.5 if s["x"] < 42 else 72.5
        return walk_to(state, {"x": out, "y": s["y"] + 0.5}, 0.3)
    return walk_to(state, {"x": s["x"] + 0.5, "y": s["y"] + 0.5}, 0.1)


def stairs_option(state, world, want_floor):
    """Id opcji 'go:i' w oknie schodow prowadzacej na pietro want_floor (kolejnosc jak w stairsNear gry)."""
    cur, letter = state["floor"], "A" if state["player"]["x"] < 42 else "B"
    options = [s for s in world["stairs"] if s["floor"] == cur and f"-{letter}-" in s["id"]]
    nxt = cur + (1 if want_floor > cur else -1)
    for i, s in enumerate(options):
        if s["to"][0] == nxt:
            return f"go:{i}"
    return "stay"


def door_step(state, world, zone):
    """Intent: podejdz do drzwi sali zone, stan przed nimi i wejdz w drzwi (uderzenie uruchamia walke)."""
    grid, p = state["grid"], state["player"]
    door = next(d for d in world["doors"][state["floor"]] if d["zone"] == zone)
    blocked = npc_cells(state)
    options = [(tuple(c), n, find_path(grid, cell_of(p), n, blocked)) for c in door["cells"] for n in free_neighbors(grid, tuple(c))]
    options = [o for o in options if o[2]]
    if not options:
        return IDLE
    (cx, cy), (nx, ny), _ = min(options, key=lambda o: len(o[2]))
    stand = {"x": nx + 0.5, "y": ny + 0.5}
    if dist_to(p, stand) > 0.35:
        return walk_to(state, stand, 0.2)
    err, turn = turn_toward(p, cx + 0.5, cy + 0.5)
    return {"move": 1 if abs(err) < 0.15 else 0, "strafe": 0, "turn": turn, "fire": False}


# --- cel misji ---------------------------------------------------------------------------------------

def quest_status(state, quest):
    return state["quests"].get(quest, {}).get("status", "available")


def current_goal(state, world):
    """Fabula: bezpieczniki, alarm ucznia, ratowanie sal, na koncu aula."""
    npcs = {n["id"]: n for n in world["npcs"]}

    def s(q):
        return quest_status(state, q)

    def npc(i):
        return {"kind": "npc", "npc": i, "floor": npcs[i]["floor"]}

    if s("zasilanie") != "done":
        obj = next(i for i in world["interactables"] if i["id"] == "glowne-bezpieczniki")
        return {"kind": "interact", **obj}
    if s("ratunek") != "done":
        if s("ratunek") != "active":
            return npc("uczen")
        rooms = [r for r in world["rescueRooms"] if r["id"] not in state["cleared"]]
        here = [r for r in rooms if r["floor"] == state["floor"]]
        if rooms:
            room = (here or rooms)[0]
            return {"kind": "door", "zone": room["id"], "floor": room["floor"]}
        return npc("uczen")
    if FINAL_ZONE in state["cleared"]:
        return {"kind": "done", "floor": state["floor"]}
    return {"kind": "door", "zone": FINAL_ZONE, "floor": 1}


def decide(state, world):
    """Intent dla sceny 'play'; None gdy nic wiecej do zrobienia."""
    goal = current_goal(state, world)
    if goal["kind"] == "done":
        return None
    p = state["player"]
    if goal["floor"] != state["floor"]:
        intent = stairs_step(state, world, goal["floor"])
    elif goal["kind"] == "hunt":
        intent = hunt(state) or IDLE
    elif goal["kind"] == "npc":
        npc = next((n for n in state["npcs"] if n["id"] == goal["npc"]), None)
        intent = face_and_talk(state, npc) if npc else IDLE
    elif goal["kind"] == "interact":
        intent = face_and_talk(state, goal)
    elif goal["kind"] == "item":
        intent = walk_to(state, goal, 0.3)
    else:
        intent = door_step(state, world, goal["zone"])
    if p["hp"] < LOW_HP and state["food"] > 0:
        intent = {**intent, "heal": True}
    return intent


# --- dialogi -------------------------------------------------------------------------------------------

def dialogue_key(d, prefer=()):
    """Klawisz w dialogu wg fazy (pisanie: X pomija, czekanie: Z, wybor: strzalki + Z na wybranej opcji)."""
    if d["phase"] == "type":
        return "KeyX"
    if d["phase"] == "wait":
        return "KeyZ"
    if d["phase"] == "choice":
        want = next((c for c in [*prefer, "accept", "turnin", "deliver", "close", "ok"] if c in d["options"]), d["options"][0])
        idx = d["options"].index(want)
        if d["cursor"] == idx:
            return "KeyZ"
        return "ArrowDown" if d["cursor"] < idx else "ArrowUp"
    return None


# --- walka -------------------------------------------------------------------------------------------

def bullet_tracks(bullets, horizon):
    """Pozycje pociskow w kolejnych klatkach: lista [(x, y, promien)] na kazda klatke 1..horizon."""
    return [[(k["x"] + k["vx"] * t, k["y"] + k["vy"] * t, k["r"] + HEART_R + DODGE_MARGIN) for k in bullets]
            for t in range(1, horizon + 1)]


def survive_ticks(heart, target, tracks, invuln):
    """Po ilu klatkach serce jadace do target dostaje trafienie (len(tracks) + 1 = bez trafienia)."""
    x, y = heart["x"], heart["y"]
    for t, bullets in enumerate(tracks, start=1):
        x += max(-HEART_SPEED, min(HEART_SPEED, target[0] - x))
        y += max(-HEART_SPEED, min(HEART_SPEED, target[1] - y))
        if t <= invuln:
            continue
        for bx, by, r in bullets:
            if (bx - x) ** 2 + (by - y) ** 2 < r * r:
                return t
    return len(tracks) + 1


def plan_dodge(battle):
    """Wybiera bezpieczny punkt w pudelku i zwraca klawisze do trzymania: zbior strzalek."""
    heart = battle["heart"]
    tracks = bullet_tracks(battle["bullets"], DODGE_HORIZON)
    best, best_key = (heart["x"], heart["y"]), None
    for tx in range(10, BOX_W - 9, 16):
        for ty in range(10, BOX_H - 9, 16):
            travel = max(abs(tx - heart["x"]), abs(ty - heart["y"])) / HEART_SPEED
            key = (survive_ticks(heart, (tx, ty), tracks, battle["invuln"]), -travel)
            if best_key is None or key > best_key:
                best, best_key = (tx, ty), key
    keys = set()
    dx, dy = best[0] - heart["x"], best[1] - heart["y"]
    if dx > HEART_SPEED / 2:
        keys.add("ArrowRight")
    elif dx < -HEART_SPEED / 2:
        keys.add("ArrowLeft")
    if dy > HEART_SPEED / 2:
        keys.add("ArrowDown")
    elif dy < -HEART_SPEED / 2:
        keys.add("ArrowUp")
    return keys


def menu_key(cursor, target, n):
    """Strzalka do przesuniecia kursora na target w menu z zawijaniem, albo Z gdy jest na miejscu."""
    if cursor == target:
        return "KeyZ"
    return "ArrowRight" if (target - cursor) % n <= n // 2 else "ArrowLeft"


def battle_key(b):
    """Klawisz w fazach tekstu i menu walki (None: nic; faza uniku to plan_dodge)."""
    if b["phase"] in ("text", "bar"):
        return "KeyZ"
    if b["phase"] != "menu":
        return None
    if b["menu"] == "main":
        if b["mercy"] >= 100:
            return menu_key(b["cursor"], MAIN_MENU.index("mercy"), len(MAIN_MENU))
        if b["hp"] < 0.45 * b["maxHp"] and any(b["items"]):
            return menu_key(b["cursor"], MAIN_MENU.index("item"), len(MAIN_MENU))
        return menu_key(b["cursor"], MAIN_MENU.index("act"), len(MAIN_MENU))
    if b["menu"] == "act":
        best = max(range(len(b["acts"])), key=lambda i: (b["acts"][i]["mercy"], -i))
        return menu_key(b["cursor"], best, len(b["acts"]))
    return "KeyZ"


# --- sterowanie przegladarka -----------------------------------------------------------------------

def log(t0, msg):
    print(f"[{time.time() - t0:6.1f}s] {msg}")


class Keys:
    """Trzyma stan wcisnietych klawiszy w przegladarce i wysyla tylko zmiany."""

    def __init__(self, page):
        self.page, self.down = page, set()

    def hold(self, wanted):
        for k in self.down - wanted:
            self.page.keyboard.up(k)
        for k in wanted - self.down:
            self.page.keyboard.down(k)
        self.down = set(wanted)

    def tap(self, key):
        self.hold(set())
        self.page.keyboard.press(key)


def handle_scene(page, keys, s, world, goal, speed):
    """Obsluga scen poza 'play': dialog, spotkanie w sali, pauza, smierc."""
    scene = s["scene"]
    if scene == "dialogue" and s["dialogue"]:
        prefer = [stairs_option(s, world, goal["floor"])] if s["dialogue"]["npc"] == "Klatka schodowa" else []
        k = dialogue_key(s["dialogue"], prefer)
        if k:
            keys.tap(k)
        time.sleep(0.12)
    elif scene == "encounter" and s["enc"]:
        e = s["enc"]
        b = e["battle"] if e["phase"] == "battle" else None
        if e["phase"] in ("intro", "outro") and e["dialogue"]:
            k = dialogue_key(e["dialogue"])
            if k:
                keys.tap(k)
            time.sleep(0.12)
        elif b and b["phase"] == "dodge":
            page.evaluate("raid.setSpeed(1)")                      # unik w czasie rzeczywistym
            keys.hold(plan_dodge(b))
            time.sleep(0.01)
        elif b and battle_key(b):
            page.evaluate("n => raid.setSpeed(n)", speed)
            keys.tap(battle_key(b))
            time.sleep(0.12)
        else:
            keys.hold(set())
            time.sleep(0.05)
    elif scene == "paused":
        page.click("[data-a=resume]")
    elif scene == "dead":
        page.click("[data-a=retry]")
    else:
        time.sleep(0.2)


def unstick(intent, s, still):
    """Gdy gracz stoi mimo ruchu (np. za NPC), dorzuca unik w bok. Zwraca (intent, still)."""
    pos = (round(s["player"]["x"], 1), round(s["player"]["y"], 1))
    if pos != still[0]:
        return intent, (pos, time.time())
    if time.time() - still[1] > STUCK_SECONDS:
        return {**intent, "strafe": random.choice([-1, 1])}, (pos, time.time() - STUCK_SECONDS / 2)
    return intent, still


def read_state(page, grids):
    """Stan gry; siatke pietra pobiera tylko raz na pietro (jest duza)."""
    s = page.evaluate("raid.state(true)")
    if s["floor"] not in grids:
        grids[s["floor"]] = page.evaluate("raid.state()")["grid"]
    s["grid"] = grids[s["floor"]]
    return s


def play(page, timeout, speed=GAME_SPEED):
    page.click("[data-a=play]")
    world = page.evaluate("raid.world()")
    keys, grids = Keys(page), {}
    page.evaluate("n => raid.setSpeed(n)", speed)
    t0, last, still = time.time(), None, (None, time.time())
    while time.time() - t0 < timeout:
        s = read_state(page, grids)
        scene, goal = s["scene"], current_goal(s, world)
        quests = {q: v["status"] for q, v in s["quests"].items()}
        mark = (scene, s["floor"], goal["kind"], goal.get("npc") or goal.get("zone"), tuple(quests.items()))
        if mark != last:
            log(t0, f"scena={scene} pietro={s['floor']} cel={mark[2]}:{mark[3]} hp={s['player']['hp']} lvl={s['player']['level']} questy={quests}")
            last = mark
        if scene == "victory":
            keys.hold(set())
            return True
        if scene != "play":
            page.evaluate("raid.setIntent(null)")
            handle_scene(page, keys, s, world, goal, speed)
            continue
        intent = decide(s, world)
        if intent is None:
            return True
        if intent["move"]:
            intent, still = unstick(intent, s, still)
        page.evaluate("it => raid.setIntent(it)", intent)
        time.sleep(TICK_S)
    return False


def main():
    ap = argparse.ArgumentParser(description="Bot grajacy w Gliwice Raid: 4 questy i walka z finalowym bossem")
    ap.add_argument("--url", default=DEFAULT_URL, help="adres gry (domyslnie lokalny index.html)")
    ap.add_argument("--headless", action="store_true", help="bez okna przegladarki")
    ap.add_argument("--speed", type=float, default=GAME_SPEED, help="mnoznik tempa gry (1 = normalne)")
    ap.add_argument("--timeout", type=int, default=900, help="limit czasu w sekundach")
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        page = browser.new_page(viewport={"width": 1100, "height": 700})
        page.on("pageerror", lambda e: print("blad strony:", e))
        page.goto(args.url)
        ok = False
        try:
            ok = play(page, args.timeout, args.speed)
        except KeyboardInterrupt:
            pass
        finally:
            browser.close()
    print("Gra przejsta." if ok else "Gra nieukonczona (limit czasu albo przerwanie).")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
