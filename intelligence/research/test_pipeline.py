import unittest
import numpy as np
import pandas as pd
from build_dataset import build, FEATURES
from train_model import evaluate


class PipelineTests(unittest.TestCase):
    def test_dataset_excludes_mock_and_immature_labels(self):
        row = {"snapshot": {"source": "gmgn", "mintAddress": "test", "snapshotAt": "2026-01-01T00:00:00Z"},
               "outcomes": {"availableAt": "2026-01-02T00:00:00Z", "hit2x6h": True}}
        frame = build([row, {**row, "snapshot": {**row["snapshot"], "source": "mock"}},
                       {**row, "outcomes": {"availableAt": "2026-01-01T01:00:00Z"}}])
        self.assertEqual(len(frame), 1)
        self.assertTrue(frame["bundlerPct"].isna().all())

    def test_baseline_time_split_and_minimum_data(self):
        rng = np.random.default_rng(42)
        dates = pd.date_range("2026-01-01", periods=1600, freq="h", tz="UTC")
        frame = pd.DataFrame({f: rng.normal(size=len(dates)) for f in FEATURES})
        frame["mintAddress"] = [f"synthetic-{i}" for i in range(len(dates))]
        frame["snapshotAt"] = dates.astype(str)
        frame["availableAt"] = (dates + pd.Timedelta(hours=24)).astype(str)
        frame["twoXBeforeMinus50"] = (np.arange(len(dates)) % 2 == 0)
        cutoff = dates[1200].isoformat()
        result = evaluate(frame, "twoXBeforeMinus50", cutoff)
        self.assertEqual(result["test_n"], 400)
        self.assertLess(result["train_n"], 1200)
        self.assertFalse(result["production_enabled"])
        self.assertFalse(result["calibrated"])
        with self.assertRaises(ValueError):
            evaluate(frame.iloc[:10], "twoXBeforeMinus50", cutoff)


if __name__ == "__main__":
    unittest.main()
