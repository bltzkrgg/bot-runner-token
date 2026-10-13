"""Export explicit numeric features and mature labels from real observations."""
import argparse
import json
import pandas as pd

FEATURES = ["ageMinutes", "marketCapUsd", "liquidityUsd", "volume5m", "holderCount",
            "top10Pct", "bundlerPct", "insiderPct", "sniperPct", "devHoldingPct", "smartMoneyCount"]
TARGETS = ["hit2x6h", "hit3x24h", "twoXBeforeMinus50", "minus50BeforePlus50", "rugLike6h"]


def build(rows):
    output = []
    for row in rows:
        snapshot, outcomes = row["snapshot"], row.get("outcomes", {})
        if snapshot["source"] != "gmgn" or snapshot.get("chain", "solana") != "solana":
            continue
        observed = pd.Timestamp(snapshot["snapshotAt"])
        available = pd.Timestamp(outcomes.get("availableAt"))
        if pd.isna(available) or available < observed + pd.Timedelta(hours=24):
            continue
        output.append({"mintAddress": snapshot["mintAddress"], "snapshotAt": observed.isoformat(),
                       "availableAt": available.isoformat(),
                       **{f: snapshot.get(f) for f in FEATURES}, **{t: outcomes.get(t) for t in TARGETS}})
    return pd.DataFrame(output, columns=["mintAddress", "snapshotAt", "availableAt", *FEATURES, *TARGETS])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    args = parser.parse_args()
    with open(args.input) as source:
        frame = build([json.loads(line) for line in source if line.strip()])
    frame.to_csv(args.output, index=False)
    print(frame[FEATURES].isna().mean().to_json())
