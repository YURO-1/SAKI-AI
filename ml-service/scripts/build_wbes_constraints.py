"""Build the WBES Kenya 2025 constraints layer: weighted shares by scope and sector.
Usage (from ml-service/):  python scripts/build_wbes_constraints.py
Outputs: data/processed/wbes_constraints.csv, docs/wbes_constraints_report.txt
"""
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wbes_kenya_2025.dta"
OUT = ROOT / "data" / "processed" / "wbes_constraints.csv"
REPORT = ROOT / "docs" / "wbes_constraints_report.txt"
NAIROBI = 4   # a2 code for Nairobi
MIN_N = 30    # cells smaller than this are flagged unreliable

# Folders must exist before the report file is opened
OUT.parent.mkdir(parents=True, exist_ok=True)
REPORT.parent.mkdir(parents=True, exist_ok=True)
sys.stdout = open(REPORT, "w", encoding="utf-8")

df = pd.read_stata(RAW, convert_categoricals=False)
with pd.io.stata.StataReader(RAW) as r:
    labels = r.variable_labels()

def sector_group(code):
    if pd.isna(code): return "Unknown"
    d = int(code) // 100   # ISIC Rev. 4 division
    if d == 47: return "Retail trade"
    if d in (45, 46): return "Wholesale & motor trade"
    if d in (55, 56): return "Food & accommodation"
    if 10 <= d <= 33: return "Manufacturing"
    if 41 <= d <= 43: return "Construction"
    if 49 <= d <= 53: return "Transport & storage"
    if 58 <= d <= 66 or 68 <= d <= 75 or 77 <= d <= 82: return "Business & financial services"
    return "Other"

df["sector_group"] = df["d1a2_v4"].apply(sector_group)

OBST = {
    "k30": "Access to finance", "g30a": "Access to land",
    "j30c": "Business licensing and permits", "j30f": "Corruption", "h30": "Courts",
    "i30": "Crime, theft and disorder", "d30b": "Customs and trade regulations",
    "c30a": "Electricity", "l30b": "Inadequately educated workforce",
    "l30a": "Labour regulations", "j30e": "Political instability",
    "e30": "Practices of informal-sector competitors", "j30b": "Tax administration",
    "j30a": "Tax rates", "d30a": "Transport",
    "l30d": "Regulation of dismissing workers", "l30c": "Cost of hiring new workers",
}
# (column, label, family, valid answer codes, codes counted as "yes / high")
INDICATORS = [(c, f"Obstacle: {n}", "obstacle", {0, 1, 2, 3, 4}, {3, 4}) for c, n in OBST.items()]
INDICATORS += [
    ("e11", "Competes with unregistered or informal firms", "competition", {1, 2}, {1}),
    ("e32", "Competition increased in the last year", "competition", {1, 2, 3}, {1}),
    ("e33", "Can raise prices without losing customers", "competition", {1, 2}, {1}),
    ("j5", "Gift/payment requested during an inspection", "bribery", {1, 2}, {1}),
    ("j15", "Gift/payment requested for an operating licence", "bribery", {1, 2}, {1}),
]

scopes = {"Kenya": df, "Nairobi": df[df["a2"] == NAIROBI]}
rows = []
for scope, d in scopes.items():
    groups = [("All sectors", d)] + [(s, g) for s, g in d.groupby("sector_group")]
    for sector, g in groups:
        for col, label, family, valid, pos in INDICATORS:
            s = pd.to_numeric(g[col], errors="coerce")
            ok = s.isin(valid)          # -7 / -9 / blank are dropped here
            n = int(ok.sum())
            if n == 0:
                continue
            w = g.loc[ok, "wmedian"]
            hit = s[ok].isin(pos)
            rows.append({
                "scope": scope, "sector_group": sector, "indicator": label,
                "family": family, "source_column": col,
                "pct_weighted": round(float((w * hit).sum() / w.sum() * 100), 1),
                "pct_unweighted": round(float(hit.mean() * 100), 1),
                "n_valid": n, "reliable": int(n >= MIN_N),
            })

res = pd.DataFrame(rows)
res.to_csv(OUT, index=False, encoding="utf-8")

print("=== Firms per sector group ===")
cnt = pd.DataFrame({
    "Kenya": df["sector_group"].value_counts(),
    "Nairobi": df.loc[df["a2"] == NAIROBI, "sector_group"].value_counts(),
}).fillna(0).astype(int)
print(cnt.to_string())

print("\n=== Code vs label check (m1a and the yes/no indicators) ===")
CHECK = ["m1a", "e11", "e32", "e33", "j5", "j15"]
for c in CHECK:
    print(f"\n{c}  |  {labels.get(c, '')}")
    try:
        lab = pd.read_stata(RAW, convert_categoricals=True, columns=[c])
        pair = pd.DataFrame({"code": df[c], "label": lab[c].astype(str)})
        print(pair.value_counts(dropna=False).sort_index().to_string())
    except Exception as e:
        print("  Could not read labels:", e)
        print("  Raw codes:", df[c].value_counts(dropna=False).sort_index().to_dict())

print("\n=== Columns starting with e31 (market structure?) ===")
for c in df.columns:
    if c.lower().startswith("e31"):
        print(c, "|", labels.get(c, ""), "|",
              df[c].value_counts(dropna=False).sort_index().to_dict())

print("\n=== All sectors: weighted %, unweighted % and valid n (obstacle = major or very severe) ===")
a = res[res["sector_group"] == "All sectors"]
tab = a.pivot_table(index=["family", "indicator"], columns="scope",
                    values=["pct_weighted", "pct_unweighted", "n_valid"])
print(tab.to_string())

print("\n=== Reliable obstacle cells per scope and sector (of 17) ===")
ob = res[res["family"] == "obstacle"]
print(ob.groupby(["scope", "sector_group"])["reliable"].sum().to_string())

sys.stdout.close()