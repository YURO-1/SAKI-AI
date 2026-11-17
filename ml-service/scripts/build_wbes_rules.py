"""Turn WBES shares into transparent rule-based levels, with explicit fallbacks.
Usage (from ml-service/), after build_wbes_constraints.py:  python scripts/build_wbes_rules.py
Outputs: data/processed/wbes_rules.csv, docs/wbes_rules_report.txt
"""
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
IN = ROOT / "data" / "processed" / "wbes_constraints.csv"
OUT = ROOT / "data" / "processed" / "wbes_rules.csv"
REPORT = ROOT / "docs" / "wbes_rules_report.txt"

# RULES: edit here. A level is set by the share of firms at risk (%).
TIERS = [(50, "High"), (30, "Elevated"), (15, "Moderate"), (0, "Low")]
INVERT = {"e33": "Cannot raise prices without losing customers"}  # risk = 100 - share
NO_DATA = ["Education", "Health", "Personal services"]  # outside the WBES universe

def level(x):
    for cut, name in TIERS:
        if x >= cut:
            return name

df = pd.read_csv(IN)
df["risk_share"] = df.apply(
    lambda r: round(100 - r["pct_weighted"], 1) if r["source_column"] in INVERT
    else r["pct_weighted"], axis=1)
df["indicator"] = df.apply(lambda r: INVERT.get(r["source_column"], r["indicator"]), axis=1)
df["level"] = df["risk_share"].map(level)

rec = {(r["scope"], r["sector_group"], r["source_column"]): r for r in df.to_dict("records")}
cols = df.drop_duplicates("source_column")[["source_column", "indicator", "family"]]
sectors = sorted(df["sector_group"].unique())

out = []
for scope in ["Kenya", "Nairobi"]:
    for sector in sectors + NO_DATA:
        for _, c in cols.iterrows():
            base = {"requested_scope": scope, "requested_sector": sector,
                    "source_column": c["source_column"], "indicator": c["indicator"],
                    "family": c["family"]}
            if sector in NO_DATA:
                out.append({**base, "status": "no WBES data"})
                continue
            chain = [(scope, sector), ("Kenya", sector), ("Kenya", "All sectors")]
            hit = None
            for sc, se in chain:
                r = rec.get((sc, se, c["source_column"]))
                if r is not None and r["reliable"] == 1:
                    hit = (sc, se, r)
                    break
            if hit is None:
                out.append({**base, "status": "limited data"})
                continue
            sc, se, r = hit
            direct = (sc, se) == (scope, sector)
            out.append({**base, "source_scope": sc, "source_sector": se,
                        "status": "direct" if direct else "fallback",
                        "risk_share": r["risk_share"], "moe_pp": r["moe_pp"],
                        "n_valid": r["n_valid"], "n_eff": r["n_eff"], "level": r["level"]})

res = pd.DataFrame(out)
res.to_csv(OUT, index=False, encoding="utf-8")

sys.stdout = open(REPORT, "w", encoding="utf-8")
print("=== Rule tiers (share of firms at risk) ===")
print(TIERS)

a = df[df["sector_group"] == "All sectors"]
t = a.pivot(index="indicator", columns="scope", values=["risk_share", "level"])
t = t.sort_values(("risk_share", "Kenya"), ascending=False)
print("\n=== All sectors: risk share and level ===")
print(t.to_string())

print("\n=== Nairobi vs Kenya (all sectors); beyond_margin = gap exceeds Nairobi 95% margin ===")
k = a[a["scope"] == "Kenya"].set_index("indicator")
n = a[a["scope"] == "Nairobi"].set_index("indicator")
d = pd.DataFrame({"kenya": k["risk_share"], "nairobi": n["risk_share"],
                  "gap": (n["risk_share"] - k["risk_share"]).round(1),
                  "nairobi_moe": n["moe_pp"]})
d["beyond_margin"] = d["gap"].abs() > d["nairobi_moe"]
print(d.sort_values("gap").to_string())

print("\n=== Resolution status by requested scope and sector ===")
print(res.groupby(["requested_scope", "requested_sector", "status"]).size().to_string())

print("\n=== Effective sample sizes, Nairobi sector cells (obstacle rows) ===")
x = df[(df["scope"] == "Nairobi") & (df["family"] == "obstacle")]
print(x.groupby("sector_group")[["n_valid", "n_eff"]].min().to_string())
sys.stdout.close()