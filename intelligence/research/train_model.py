"""Offline baseline only; no probabilities are served by the bot."""
import argparse
import json
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
from build_dataset import FEATURES


def evaluate(frame, target, cutoff):
    frame = frame.dropna(subset=[*FEATURES, target]).sort_values("snapshotAt")
    # Keep one snapshot per token; purge labels crossing train/test boundary.
    frame = frame.drop_duplicates("mintAddress", keep="first")
    dates = pd.to_datetime(frame.snapshotAt, utc=True)
    matured = pd.to_datetime(frame.availableAt, utc=True)
    split = pd.Timestamp(cutoff)
    train = frame[(dates < split) & (matured < split)]
    test = frame[dates >= split]
    if len(train) < 1000 or len(test) < 300:
        raise ValueError("Need >=1000 training and >=300 later test tokens with complete features")
    if train[target].nunique() < 2 or test[target].nunique() < 2:
        raise ValueError("Both classes required in each period")
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    model.fit(train[FEATURES], train[target].astype(int))
    probabilities = model.predict_proba(test[FEATURES])[:, 1]
    return {"train_n": len(train), "test_n": len(test),
            "roc_auc": roc_auc_score(test[target].astype(int), probabilities),
            "pr_auc": average_precision_score(test[target].astype(int), probabilities),
            "brier": brier_score_loss(test[target].astype(int), probabilities),
            "calibrated": False, "production_enabled": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset")
    parser.add_argument("--target", default="twoXBeforeMinus50")
    parser.add_argument("--cutoff", required=True, help="ISO timestamp with timezone")
    args = parser.parse_args()
    print(json.dumps(evaluate(pd.read_csv(args.dataset), args.target, args.cutoff)))
