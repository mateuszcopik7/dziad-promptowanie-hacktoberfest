"""python3 -m unittest tests.test_bot - testy decyzji bota bez przegladarki"""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bot"))
from bot import decide, find_path, has_los  # noqa: E402

GRID = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
]


def state(px, py, angle, enemy, **player):
    p = {"x": px, "y": py, "angle": angle, "hp": 100, "ammo": 30, **player}
    return {"player": p, "grid": GRID, "pickups": [], "enemies": [{"x": enemy[0], "y": enemy[1]}]}


class BotTest(unittest.TestCase):
    def test_path_goes_around_wall(self):
        path = find_path(GRID, (1, 1), (4, 1))
        self.assertEqual(path[0], (1, 1))
        self.assertEqual(path[-1], (4, 1))
        self.assertIn((3, 3), path)

    def test_no_path_to_wall(self):
        self.assertIsNone(find_path(GRID, (1, 1), (3, 1)))

    def test_los_blocked_by_wall(self):
        self.assertFalse(has_los(GRID, 2.5, 1.5, 4.5, 1.5))
        self.assertTrue(has_los(GRID, 1.5, 1.5, 2.5, 2.5))

    def test_fires_when_aligned_and_visible(self):
        it = decide(state(1.5, 2.5, 0, (2.5 + 0.0, 2.5)))
        self.assertTrue(it["fire"] or it["move"] == 0)
        it = decide(state(1.5, 1.5, 0, (2.9, 1.5)))
        self.assertTrue(it["fire"])

    def test_turns_toward_target(self):
        it = decide(state(1.5, 1.5, math.pi, (2.9, 1.5)))
        self.assertNotEqual(it["turn"], 0)
        self.assertFalse(it["fire"])

    def test_does_not_fire_through_wall(self):
        it = decide(state(2.5, 1.5, 0, (4.5, 1.5)))
        self.assertFalse(it["fire"])

    def test_goes_for_ammo_when_low(self):
        s = state(1.5, 1.5, 0, (4.5, 1.5), ammo=2)
        s["pickups"] = [{"kind": "usb", "x": 1.5, "y": 3.5}]
        it = decide(s)
        self.assertFalse(it["fire"])
        self.assertNotEqual(it["turn"], 0)


if __name__ == "__main__":
    unittest.main()
