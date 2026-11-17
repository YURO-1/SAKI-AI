"""Create a Nairobi-only subset of the KNBS MSME 2016 data (nothing is dropped except non-Nairobi rows).
Usage (from ml-service/):  python scripts/make_nairobi_subset.py
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "knbs_msme_2016.dta"
OUT = ROOT / "data" / "processed" / "nairobi_msme_2016.csv"

NAIROBI_CODE = 101  # verified from the file's value labels (county11 = NAIROBI)

df = pd.read_stata(RAW, convert_categoricals=False)
nairobi = df[df["county11"] == NAIROBI_CODE].copy()

print(f"All rows:      {len(df):,}")
print(f"Nairobi rows:  {len(nairobi):,}  ({len(nairobi) / len(df):.1%})")
print(f"Columns:       {nairobi.shape[1]}")

all_missing = [c for c in nairobi.columns if nairobi[c].isna().all()]
print(f"Columns completely empty for Nairobi: {len(all_missing)}")

high_missing = (nairobi.isna().mean() > 0.5).sum()
print(f"Columns more than 50% missing in Nairobi: {high_missing}")

# Survey weight columns (needed later for fair benchmarks)
weights = [c for c in nairobi.columns if "weight" in c.lower() or c.lower().startswith("wt")]
print(f"Possible weight columns: {weights}")

nairobi.to_csv(OUT, index=False)
print(f"\nSaved to: {OUT}")