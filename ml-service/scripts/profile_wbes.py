"""Profile the WBES Kenya 2025 file: region labels, obstacle answer codes, sectors, weights.
Usage (from ml-service/):  python scripts/profile_wbes.py
Output: docs/wbes_profile.txt
"""
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wbes_kenya_2025.dta"
OUT = ROOT / "docs" / "wbes_profile.txt"
sys.stdout = open(OUT, "w", encoding="utf-8")

raw = pd.read_stata(RAW, convert_categoricals=False)

OBST = ["k30", "g30a", "j30c", "j30f", "h30", "i30", "d30b", "c30a", "l30b",
        "l30a", "j30e", "e30", "j30b", "j30a", "d30a", "l30d", "l30c", "m1a"]
OTHER = ["e11", "e2b", "e32", "e33", "j3", "j5", "j15", "c5", "g4"]

# 1. Region codes next to their labels (if the file has labels)
print("=== Region codes vs labels ===")
try:
    lab = pd.read_stata(RAW, convert_categoricals=True, columns=["a2", "a3a", "a6a"])
    for c in ["a2", "a3a", "a6a"]:
        print(f"\n{c}:")
        print(pd.crosstab(raw[c], lab[c]).to_string())
except Exception as e:
    print("Could not read labels:", e)

# 2. All short value-label sets (reveals answer scales)
print("\n=== Value label sets with 12 or fewer entries ===")
with pd.io.stata.StataReader(RAW) as r:
    for name, mp in r.value_labels().items():
        if len(mp) <= 12:
            print(f"{name}: {mp}")

# 3. Raw answer codes for each obstacle question
print("\n=== Raw answer counts, obstacle questions ===")
for c in OBST:
    print(f"{c}: {raw[c].value_counts(dropna=False).sort_index().to_dict()}")

# 4. Competition, inspection and payment questions
print("\n=== Raw answer counts, competition / inspections / payments ===")
for c in OTHER:
    print(f"{c}: {raw[c].value_counts(dropna=False).sort_index().to_dict()}")
print("\nj7a (% of sales paid in informal payments):")
print(raw["j7a"].describe().to_string())

# 5. Sectors: ISIC Rev 4 division = first two digits of d1a2_v4
d = pd.to_numeric(raw["d1a2_v4"], errors="coerce")
print("\n=== ISIC Rev 4 divisions (first two digits of d1a2_v4) ===")
print((d // 100).value_counts(dropna=False).sort_index().to_string())

# 6. Weights
print("\n=== wmedian ===")
print(raw["wmedian"].describe().to_string())

sys.stdout.close()