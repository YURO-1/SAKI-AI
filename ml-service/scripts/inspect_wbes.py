"""Inspect the WBES Kenya 2025 file: regions, obstacle-type questions, weights.
Usage (from ml-service/):  python scripts/inspect_wbes.py > ../docs/wbes_inspection.txt
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wbes_kenya_2025.dta"

import sys
OUT = ROOT / "docs" / "wbes_inspection.txt"
sys.stdout = open(OUT, "w", encoding="utf-8")

df = pd.read_stata(RAW, convert_categoricals=False)
with pd.io.stata.StataReader(RAW) as r:
    labels = r.variable_labels()
    vals = r.value_labels()

print(f"Rows: {len(df):,}   Columns: {df.shape[1]}")

# 1. Regions and their labels
for col in ["a2", "a3a", "a4a", "a4b"]:
    if col in df.columns:
        print(f"\n=== {col}: {labels.get(col, '')} ===")
        mapping = vals.get(col, {})
        for code, n in df[col].value_counts(dropna=False).items():
            try:
                txt = mapping.get(int(code), "")
            except (ValueError, TypeError):
                txt = ""
            print(f"  {code}: {txt} -> {n}")

# 2. Weight columns
print("\n=== Weight columns ===")
for c in df.columns:
    if c.lower() in ("wweak", "wmedian", "wstrong", "wt", "weight"):
        print(f"  {c}: {labels.get(c, '')}  (missing: {df[c].isna().sum()})")

# 3. Keyword search of variable labels, with valid counts
keywords = ["obstacle", "constraint", "bribe", "informal", "licen", "permit", "tax",
            "electric", "crime", "theft", "competi", "land", "trade", "customs",
            "corrupt", "finance", "access to", "political", "workforce", "sector", "industry"]
for k in keywords:
    hits = [(c, labels.get(c, "")) for c in df.columns if k in labels.get(c, "").lower()]
    print(f"\n--- '{k}': {len(hits)} columns ---")
    for c, lab in hits[:20]:
        print(f"{c:12s} valid={df[c].notna().sum():5d}  {lab[:105]}")

# 4. Sector and sampling variables
print("\n=== Sector and sampling columns ===")
for c in df.columns:
    if c.lower() in ("a6a", "a4a", "d1a2_v4", "strata", "a2", "panel"):
        print(f"  {c}: {labels.get(c, '')}  (valid: {df[c].notna().sum()})")

sys.stdout.close()