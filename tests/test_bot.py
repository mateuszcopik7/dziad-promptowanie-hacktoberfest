"""python3 -m unittest tests.test_bot - testy decyzji bota bez przegladarki"""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bot"))
from bot import decide, dialogue_key, find_path, has_los  # noqa: E402

GRID = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
]


def state(px, py, angle, quest=None, enemies=(), npc=(4.5, 1.5), **player):
    p = {"x": px, "y": py, "angle": angle, "hp": 100, **player}
    quests = {"bugi": {"status": quest}} if quest else {}
    return {"player": p, "grid": GRID, "food": 0, "quests": quests,
            "npcs": [{"id": "woznik", "x": npc[0], "y": npc[1]}],
            "enemies": [{"x": e[0], "y": e[1]} for e in enemies]}


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
    def test_walks_to_giver_before_quest(self):
        it = decide(state(1.5, 1.5, math.pi))
        self.assertNotEqual(it["turn"], 0)
        self.assertFalse(it["interact"])

    def test_interacts_when_close_and_facing(self):
        it = decide(state(3.8, 1.5, 0, npc=(4.5, 1.5)))
        self.assertTrue(it["interact"])
        self.assertEqual(it["move"], 0)

    def test_fires_at_visible_bug(self):
        it = decide(state(1.5, 1.5, 0, quest="active", enemies=[(2.9, 1.5)]))
        self.assertTrue(it["fire"])

    def test_no_fire_through_wall(self):
        it = decide(state(2.5, 1.5, 0, quest="active", enemies=[(4.5, 1.5)]))
        self.assertFalse(it["fire"])

    def test_returns_to_giver_when_ready(self):
        it = decide(state(1.5, 1.5, 0, quest="ready"))
        self.assertIn("interact", it)

    def test_done_ends_mission(self):
        self.assertIsNone(decide(state(1.5, 1.5, 0, quest="done")))


class DialogueTest(unittest.TestCase):
    def test_keys_by_phase(self):
        self.assertEqual(dialogue_key({"phase": "type", "options": [], "cursor": 0}), "KeyX")
        self.assertEqual(dialogue_key({"phase": "wait", "options": [], "cursor": 0}), "KeyZ")
        self.assertIsNone(dialogue_key({"phase": "done", "options": [], "cursor": 0}))

    def test_choice_moves_cursor_to_accept(self):
        d = {"phase": "choice", "options": ["decline", "accept"], "cursor": 0}
        self.assertEqual(dialogue_key(d), "ArrowDown")
        self.assertEqual(dialogue_key({**d, "cursor": 1}), "KeyZ")


if __name__ == "__main__":
    unittest.main()
