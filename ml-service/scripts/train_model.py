"""Train and evaluate revenue-tier models on cleaned Nairobi KNBS data.
Usage (from ml-service/):  python scripts/train_model.py
Outputs: models/saki_tier_model.joblib, models/model_metadata.json,
         docs/ml_report.txt, docs/figures/06_confusion_matrix.png
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib
import numpy as np
import pandas as pd
import sklearn

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (ConfusionMatrixDisplay, accuracy_score,
                             classification_report, confusion_matrix, f1_score)
from sklearn.model_selection import (RepeatedStratifiedKFold, cross_validate,
                                     train_test_split)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

SEED = 42
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed" / "nairobi_clean.csv"
MODELS = ROOT / "ml-service" / "models"
REPORT = ROOT / "docs" / "ml_report.txt"
FIG = ROOT / "docs" / "figures"
ORDER = ["Low", "Medium", "High"]

log = []
def say(msg=""):
    print(msg)
    log.append(str(msg))

# ---------- 1. Data ----------
df = pd.read_csv(DATA)
df = df[df["model_eligible"] == 1].reset_index(drop=True)

CAT = ["sector_group", "premises_group", "registered", "main_buyer_code", "capital_source_code"]
NUM = ["initial_capital_ksh", "founding_employees"]
FEATURES = CAT + NUM

X = df[FEATURES].copy()
for c in CAT:  # store categories as plain text so training and the API agree
    X[c] = pd.to_numeric(X[c], errors="coerce").astype("Int64").astype("string").fillna("missing")
    X[c] = X[c].astype(str)
    if c in ("sector_group", "premises_group"):
        X[c] = df[c].astype(str)
y = df["revenue_tier"]
say(f"Rows used: {len(X):,}")
say(f"Features: {FEATURES}")
say("Class distribution:\n" + y.value_counts(normalize=True).round(3).to_string())

# ---------- 2. Hold-out split (test set used once, at the end) ----------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=SEED)
say(f"\nTrain: {len(X_train):,}   Test: {len(X_test):,}")

# ---------- 3. Preprocessing inside the pipeline (prevents leakage) ----------
def make_pre():
    return ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=10), CAT),
        ("num", Pipeline([("log", FunctionTransformer(np.log1p)),
                          ("scale", StandardScaler())]), NUM),
    ])

candidates = {
    "Baseline (most frequent)": DummyClassifier(strategy="most_frequent"),
    "Logistic Regression": LogisticRegression(max_iter=2000, class_weight="balanced"),
    "Random Forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=5,
                                            class_weight="balanced", random_state=SEED),
    "Gradient Boosting": GradientBoostingClassifier(random_state=SEED),
}

# ---------- 4. Cross-validation on the training set ----------
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
scoring = {"accuracy": "accuracy", "f1_macro": "f1_macro",
           "precision_macro": "precision_macro", "recall_macro": "recall_macro"}
say("\n=== 5-fold x 3 repeats cross-validation (training data only) ===")
cv_results = {}
for name, est in candidates.items():
    pipe = Pipeline([("pre", make_pre()), ("model", est)])
    r = cross_validate(pipe, X_train, y_train, cv=cv, scoring=scoring)
    cv_results[name] = {k: (float(r[f"test_{k}"].mean()), float(r[f"test_{k}"].std())) for k in scoring}
    say(f"{name:26s} acc {cv_results[name]['accuracy'][0]:.3f}±{cv_results[name]['accuracy'][1]:.3f} | "
        f"F1 {cv_results[name]['f1_macro'][0]:.3f}±{cv_results[name]['f1_macro'][1]:.3f} | "
        f"prec {cv_results[name]['precision_macro'][0]:.3f} | rec {cv_results[name]['recall_macro'][0]:.3f}")

real = {k: v for k, v in cv_results.items() if not k.startswith("Baseline")}
best_name = max(real, key=lambda k: real[k]["f1_macro"][0])
say(f"\nBest by cross-validated macro-F1: {best_name}")

# ---------- 5. Final evaluation on the untouched test set ----------
best_pipe = Pipeline([("pre", make_pre()), ("model", candidates[best_name])])
best_pipe.fit(X_train, y_train)
pred = best_pipe.predict(X_test)

base_pipe = Pipeline([("pre", make_pre()), ("model", candidates["Baseline (most frequent)"])])
base_pipe.fit(X_train, y_train)
base_pred = base_pipe.predict(X_test)

rank = {t: i for i, t in enumerate(ORDER)}
within1 = float(np.mean([abs(rank[a] - rank[b]) <= 1 for a, b in zip(y_test, pred)]))
acc = accuracy_score(y_test, pred)
f1m = f1_score(y_test, pred, average="macro")
say("\n=== Test-set results (evaluated once) ===")
say(f"Baseline accuracy: {accuracy_score(y_test, base_pred):.3f}   macro-F1: "
    f"{f1_score(y_test, base_pred, average='macro'):.3f}")
say(f"{best_name} accuracy: {acc:.3f}   macro-F1: {f1m:.3f}   within one tier: {within1:.3f}")
say("\n" + classification_report(y_test, pred, labels=ORDER, digits=3))
cm = confusion_matrix(y_test, pred, labels=ORDER)
say("Confusion matrix (rows = true, columns = predicted; order Low, Medium, High):\n" + str(cm))

ConfusionMatrixDisplay(cm, display_labels=ORDER).plot(cmap="Greens")
plt.title(f"{best_name}: test-set confusion matrix")
plt.tight_layout(); plt.savefig(FIG / "06_confusion_matrix.png", dpi=150); plt.close()

# ---------- 6. Which inputs matter? (permutation importance on the test set) ----------
imp = permutation_importance(best_pipe, X_test, y_test, scoring="f1_macro",
                             n_repeats=20, random_state=SEED)
imp_df = pd.DataFrame({"feature": FEATURES, "importance": imp.importances_mean,
                       "std": imp.importances_std}).sort_values("importance", ascending=False)
say("\nPermutation importance (drop in macro-F1 when the feature is shuffled):")
say(imp_df.round(4).to_string(index=False))

# ---------- 7. Refit on ALL eligible data and save ----------
final_pipe = Pipeline([("pre", make_pre()), ("model", candidates[best_name])])
final_pipe.fit(X, y)
MODELS.mkdir(exist_ok=True)
joblib.dump(final_pipe, MODELS / "saki_tier_model.joblib")
meta = {
    "model_name": best_name,
    "version": "0.1.0",
    "trained_at_utc": datetime.now(timezone.utc).isoformat(),
    "sklearn_version": sklearn.__version__,
    "target": "revenue_tier (monthly revenue: Low <15,000; Medium 15,000-99,999; High >=100,000 KSh)",
    "classes": ORDER,
    "features": FEATURES,
    "categorical_features": CAT,
    "numeric_features": NUM,
    "n_rows_total": int(len(X)),
    "data_source": "KNBS MSME Survey 2016, Nairobi establishments",
    "cv_results_train_only": cv_results,
    "test_accuracy": float(acc),
    "test_macro_f1": float(f1m),
    "test_within_one_tier": within1,
    "baseline_test_accuracy": float(accuracy_score(y_test, base_pred)),
    "limitations": "Snapshot of surviving businesses; cannot predict survival or failure.",
}
(MODELS / "model_metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
REPORT.write_text("\n".join(log), encoding="utf-8")
say(f"\nSaved model + metadata in {MODELS}\nReport: {REPORT}")