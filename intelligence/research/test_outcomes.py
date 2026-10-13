import unittest
from datetime import datetime
from label_outcomes import label


class OutcomeTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {"snapshotAt": "2026-01-01T00:00:00Z", "priceUsd": 1}
        self.start = int(datetime.fromisoformat(self.snapshot["snapshotAt"].replace("Z", "+00:00")).timestamp())
        self.points = [{"time": self.start + i * 60, "priceUsd": 1} for i in range(1441)]

    def test_order_and_unknown_rug(self):
        self.points[10]["priceUsd"] = 2
        self.points[20]["priceUsd"] = .4
        result = label(self.snapshot, self.points)
        self.assertTrue(result["twoXBeforeMinus50"])
        self.assertFalse(result["minus50BeforePlus50"])
        self.assertIsNone(result["rugLike6h"])

    def test_gaps_stay_unknown(self):
        self.points.pop(100)
        result = label(self.snapshot, self.points)
        self.assertIsNone(result["hit2x6h"])
        self.assertIsNone(result["hit3x24h"])

    def test_future_extreme_does_not_leak_into_horizon(self):
        self.points.append({"time": self.start + 86460, "priceUsd": 100})
        self.assertFalse(label(self.snapshot, self.points)["hit5x24h"])


if __name__ == "__main__":
    unittest.main()
