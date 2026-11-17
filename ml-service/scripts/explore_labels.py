"""Print value labels for location columns and find candidate columns by keyword.
Usage (from ml-service/):  python scripts/explore_labels.py ../data/raw/knbs_msme_2016.dta
"""
import sys
from pathlib import Path
import pandas as pd

path = Path(sys.argv[1])

# 1. Location columns with their value labels applied
try:
    loc = pd.read_stata(path, columns=["county11", "eb03"], convert_categoricals=True)
    for c in ["county11", "eb03"]:
        print(f"\n=== {c} (with labels) ===")
        print(loc[c].value_counts(dropna=False).to_string())
except Exception as e:
    print("Could not apply labels automatically:", e)

# 2. Raw label tables stored in the file
with pd.io.stata.StataReader(path) as reader:
    tables = reader.value_labels()
print("\n=== Label sets stored in the file ===")
print(list(tables.keys()))
for name, mapping in tables.items():
    if "count" in name.lower():
        print(f"\nLabel set '{name}':")
        for code, text in mapping.items():
            print(f"  {code}: {text}")

# 3. Candidate columns by keyword in the label text
d = pd.read_csv(Path(__file__).resolve().parents[2] / "docs" / "column_dictionary.csv")
d["label"] = d["label"].fillna("")
keywords = ["revenue", "sales", "profit", "income", "turnover", "capital",
            "start", "employ", "age", "year", "isic", "licen", "register",
            "competi", "customer", "challeng", "problem", "weight", "expan", "loan"]
for k in keywords:
    hits = d[d["label"].str.lower().str.contains(k)]
    print(f"\n--- '{k}': {len(hits)} columns ---")
    print(hits[["column", "label", "pct_missing"]].head(12).to_string(index=False))