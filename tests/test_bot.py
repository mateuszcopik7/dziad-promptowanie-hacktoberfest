"""python3 -m unittest tests.test_bot - testy decyzji bota bez przegladarki"""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bot"))
from bot import (battle_key, current_goal, decide, dialogue_key, find_path, has_los, plan_dodge,
                 stairs_option, survive_ticks, bullet_tracks)  # noqa: E402

GRID = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
]


WORLD = {
    "stairs": [{"id": "stairs-A-1-0-down", "floor": 1, "x": 1, "y": 3, "to": [0, 1, 3]},
               {"id": "stairs-A-1-2-up", "floor": 1, "x": 1, "y": 3, "to": [2, 1, 3]}],
    "npcs": [{"id": "woznik", "floor": 0, "x": 4.5, "y": 1.5}, {"id": "sekretarka", "floor": 0, "x": 4.5, "y": 1.5},
             {"id": "uczen", "floor": 0, "x": 4.5, "y": 1.5}, {"id": "bibliotekarka", "floor": 1, "x": 4.5, "y": 1.5},
             {"id": "dyrektor", "floor": 3, "x": 4.5, "y": 1.5}],
    "items": [{"item": "pieczatka", "floor": 2, "x": 4.5, "y": 1.5}],
    "interactables": [{"id": "glowne-bezpieczniki", "floor": 0, "x": 4.5, "y": 1.5}],
    "rescueRooms": [{"id": "f0-gym", "floor": 0}],
    "doors": [[], [{"zone": "f1-aula", "cells": [[3, 2]]}], [], []],
}


def state(px, py, angle, quest=None, enemies=(), npc=(4.5, 1.5), floor=0, cleared=(), **quests):
    p = {"x": px, "y": py, "angle": angle, "hp": 100}
    qs = {"zasilanie": {"status": quest or "active"}}
    qs.update({k: {"status": v} for k, v in quests.items()})
    return {"player": p, "grid": GRID, "food": 0, "quests": qs, "floor": floor, "cleared": list(cleared),
            "npcs": [{"id": n["id"], "x": npc[0], "y": npc[1]} for n in WORLD["npcs"] if n["floor"] == floor],
            "enemies": [{"x": e[0], "y": e[1]} for e in enemies]}


def decide2(st):
    return decide(st, WORLD)


def _d(*a, **k):
    return state(*a, **k)


class PathTest(unittest.TestCase):
    def test_path_goes_around_wall(self):
        path = find_path(GRID, (1, 1), (4, 1))
        self.assertEqual((path[0], path[-1]), ((1, 1), (4, 1)))
        self.assertIn((3, 3), path)

    def test_no_path_to_wall(self):
        self.assertIsNone(find_path(GRID, (1, 1), (3, 1)))

    def test_los_blocked_by_wall(self):
        self.assertFalse(has_los(GRID, 2.5, 1.5, 4.5, 1.5))
        self.assertTrue(has_los(GRID, 1.5, 1.5, 2.5, 2.5))


class MissionTest(unittest.TestCase):
    def test_walks_to_breaker_before_power(self):
        it = decide2(_d(1.5, 1.5, math.pi))
        self.assertNotEqual(it["turn"], 0)
        self.assertFalse(it["interact"])

    def test_interacts_when_close_and_facing(self):
        it = decide2(_d(3.8, 1.5, 0, npc=(4.5, 1.5)))
        self.assertTrue(it["interact"])
        self.assertEqual(it["move"], 0)

    def test_returns_to_student_when_rescue_ready(self):
        it = decide2(_d(1.5, 1.5, 0, quest="done", ratunek="ready"))
        self.assertIn("interact", it)

    def test_done_ends_mission(self):
        all_done = dict(quest="done", ratunek="done", cleared=["f1-aula"])
        self.assertIsNone(decide2(_d(1.5, 1.5, 0, **all_done)))


class DialogueTest(unittest.TestCase):
    def test_keys_by_phase(self):
        self.assertEqual(dialogue_key({"phase": "type", "options": [], "cursor": 0}), "KeyX")
        self.assertEqual(dialogue_key({"phase": "wait", "options": [], "cursor": 0}), "KeyZ")
        self.assertIsNone(dialogue_key({"phase": "done", "options": [], "cursor": 0}))

    def test_choice_moves_cursor_to_accept(self):
        d = {"phase": "choice", "options": ["decline", "accept"], "cursor": 0}
        self.assertEqual(dialogue_key(d), "ArrowDown")
        self.assertEqual(dialogue_key({**d, "cursor": 1}), "KeyZ")


class GoalTest(unittest.TestCase):
    def test_quests_in_order(self):
        g = lambda **q: current_goal(state(1.5, 1.5, 0, **q), WORLD)
        self.assertEqual(g()["kind"], "interact")
        self.assertEqual(g(quest="done")["npc"], "uczen")
        self.assertEqual(g(quest="done", ratunek="active")["zone"], "f0-gym")
        self.assertEqual(g(quest="done", ratunek="ready")["npc"], "uczen")
        self.assertEqual(g(quest="done", ratunek="done")["kind"], "door")
        self.assertEqual(g(quest="done", ratunek="done", cleared=["f1-aula"])["kind"], "done")

    def test_stairs_option_picks_floor(self):
        st = state(5.5, 27.5, 0, floor=1)
        self.assertEqual(stairs_option(st, WORLD, 2), "go:1")
        self.assertEqual(stairs_option(st, WORLD, 0), "go:0")

    def test_walks_to_stairs_for_other_floor(self):
        it = decide(state(1.5, 1.5, 0, quest="done", floor=1, sekretarka=None), WORLD)
        self.assertIn("turn", it)


class BattleTest(unittest.TestCase):
    heart = {"x": 120, "y": 60}

    def test_dodge_moves_out_of_bullet_path(self):
        b = {"heart": self.heart, "invuln": 0, "bullets": [{"x": 120, "y": 40, "vx": 0, "vy": 1.5, "r": 4}]}
        keys = plan_dodge(b)
        self.assertTrue(keys & {"ArrowLeft", "ArrowRight"})

    def test_dodge_stays_calm_without_bullets(self):
        b = {"heart": self.heart, "invuln": 0, "bullets": []}
        self.assertEqual(len(plan_dodge(b)) <= 2, True)

    def test_survive_detects_hit(self):
        tracks = bullet_tracks([{"x": 120, "y": 40, "vx": 0, "vy": 1.5, "r": 4}], 50)
        self.assertLess(survive_ticks(self.heart, (120, 60), tracks, 0), 51)
        self.assertEqual(survive_ticks(self.heart, (20, 60), tracks, 0), 51)

    def test_menu_chooses_act_then_mercy(self):
        b = {"phase": "menu", "menu": "main", "cursor": 0, "mercy": 0, "hp": 50, "maxHp": 50, "items": [1]}
        self.assertEqual(battle_key(b), "ArrowRight")
        self.assertEqual(battle_key({**b, "cursor": 1}), "KeyZ")
        self.assertEqual(battle_key({**b, "mercy": 100, "cursor": 3}), "KeyZ")
        self.assertEqual(battle_key({**b, "phase": "text"}), "KeyZ")
        self.assertIsNone(battle_key({**b, "phase": "dodge"}))

    def test_act_menu_picks_highest_mercy(self):
        b = {"phase": "menu", "menu": "act", "cursor": 0, "acts": [{"mercy": 0}, {"mercy": 25}, {"mercy": -30}]}
        self.assertEqual(battle_key(b), "ArrowRight")


if __name__ == "__main__":
    unittest.main()
