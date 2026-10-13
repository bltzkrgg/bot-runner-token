"""Label timestamped price samples. Incomplete/gapped horizons remain unknown."""
import argparse
import json
import math
from datetime import datetime, timezone


def label(snapshot, points):
    start = int(datetime.fromisoformat(snapshot["snapshotAt"].replace("Z", "+00:00")).timestamp())
    entry = snapshot.get("priceUsd")
    if not isinstance(entry, (int, float)) or isinstance(entry, bool) or not math.isfinite(entry) or entry <= 0:
        raise ValueError("Positive entry price required")
    ordered = sorted(points, key=lambda p: p["time"])
    if any(not math.isfinite(p["priceUsd"]) or p["priceUsd"] <= 0 for p in ordered):
        raise ValueError("Positive sampled prices required")
    if len({p["time"] for p in ordered}) != len(ordered):
        raise ValueError("Duplicate sample timestamps")
    result = {}
    for hours in (6, 24):
        window = [p for p in ordered if start <= p["time"] <= start + hours * 3600]
        # Strict one-minute price sample coverage. No candles/intrabar ordering guesses.
        expected = list(range(start, start + hours * 3600 + 1, 60))
        complete = [p["time"] for p in window] == expected
        ratios = [p["priceUsd"] / entry for p in window] if complete else []
        if hours == 6:
            result["hit2x6h"] = max(ratios) >= 2 if complete else None
            result["maxReturn6h"] = max(ratios) - 1 if complete else None
            result["maxDrawdown6h"] = min(ratios) - 1 if complete else None
            def first(predicate):
                return next((i for i, v in enumerate(ratios) if predicate(v)), None)
            def before(up, down):
                if not complete:
                    return None
                a, b = first(up), first(down)
                # Both thresholds not hit: event did not occur within the horizon.
                return a is not None and (b is None or a < b)
            result["twoXBeforeMinus50"] = before(lambda v: v >= 2, lambda v: v <= .5)
            result["minus50BeforePlus50"] = before(lambda v: v <= .5, lambda v: v >= 1.5)
        else:
            result["hit3x24h"] = max(ratios) >= 3 if complete else None
            result["hit5x24h"] = max(ratios) >= 5 if complete else None
    # Price samples alone cannot establish liquidity collapse or dead-token volume.
    result.update(rugLike6h=None, dead24h=None)
    result["availableAt"] = datetime.fromtimestamp(start + 86400, timezone.utc).isoformat().replace("+00:00", "Z")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="JSONL rows with id, snapshot, priceSamples")
    parser.add_argument("output")
    args = parser.parse_args()
    with open(args.input) as source, open(args.output, "w") as target:
        for line in source:
            row = json.loads(line)
            target.write(json.dumps({"id": row["id"], "snapshot": row["snapshot"],
                                     "outcomes": label(row["snapshot"], row["priceSamples"])}) + "\n")
