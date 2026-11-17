"""Profile shortlisted columns for Nairobi (read-only).
Usage (from ml-service/):  python scripts/profile_selected.py > ../docs/selected_profile.txt
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "knbs_msme_2016.dta"

df = pd.read_stata(RAW, convert_categoricals=False)
with pd.io.stata.StataReader(RAW) as r:
    var_labels = r.variable_labels()
    val_labels = r.value_labels()

nai = df[df["county11"] == 101].copy()
print(f"Nairobi rows: {len(nai):,}\n")

# ---- Numeric columns ----
numeric = ["eh15_1", "eh01_1", "eh04_1", "el01", "ed01", "ed02",
           "total_emply", "eg16_1", "est_wgt"]
for col in numeric:
    if col not in nai.columns:
        print(f"=== {col}: NOT FOUND ===\n")
        continue
    s = pd.to_numeric(nai[col], errors="coerce")
    print(f"=== {col}: {var_labels.get(col, '')} ===")
    print(f"non-missing: {s.notna().sum():,}   missing: {s.isna().sum():,}   "
          f"zeros: {(s == 0).sum():,}   negatives: {(s < 0).sum():,}")
    print(s.describe(percentiles=[.05, .25, .5, .75, .95, .99]).round(1).to_string())
    print("Most frequent values:", s.value_counts().head(8).to_dict())
    print()

# ---- Business start date ----
if "eb02" in nai.columns:
    d = pd.to_datetime(nai["eb02"], errors="coerce")
    print(f"=== eb02: {var_labels.get('eb02', '')} ===")
    print(f"non-missing: {d.notna().sum():,}   earliest: {d.min()}   latest: {d.max()}")
    print(d.dt.year.value_counts().sort_index().tail(15).to_string())
    print()

# ---- Categorical columns with labels ----
cats = ["eb01_2", "isic_div", "isic_sec", "eb03", "ej15", "ej01", "eb04", "ej19", "el02"]
for col in cats:
    if col not in nai.columns:
        print(f"=== {col}: NOT FOUND ===\n")
        continue
    mapping = val_labels.get(col, {})
    print(f"=== {col}: {var_labels.get(col, '')} ===")
    for code, n in nai[col].value_counts(dropna=False).head(20).items():
        try:
            text = mapping.get(int(code), "")
        except (ValueError, TypeError):
            text = ""
        print(f"  {code}: {text}  -> {n}")
    print()

# ---- How many rows could actually be used? ----
rev = pd.to_numeric(nai["eh15_1"], errors="coerce")
cap = pd.to_numeric(nai["el01"], errors="coerce")
start = pd.to_datetime(nai["eb02"], errors="coerce")
usable = nai[(rev > 0) & (cap > 0) & start.notna()]
print(f"Nairobi rows with revenue > 0, capital > 0 and a start date: {len(usable):,}")