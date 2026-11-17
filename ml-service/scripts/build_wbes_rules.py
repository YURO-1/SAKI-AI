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
LEVELLED = {"obstacle", "bribery"}   # competition indicators are shown as shares only
INVERT = {"e33": "Cannot raise prices without losing customers"}  # risk = 100 - share
NO_DATA = ["Education", "Health", "Personal services"]  # outside the WBES universe
# Replace with the exact citation wording from the WBES download page
SOURCE = "World Bank Enterprise Surveys, Kenya 2025"

def level(x):
    x = min(max(x, 0), 100)
    for cut, name in TIERS:
        if x >= cut:
            return name

df = pd.read_csv(IN)
df["risk_share"] = df.apply(
    lambda r: round(100 - r["pct_weighted"], 1) if r["source_column"] in INVERT
    else r["pct_weighted"], axis=1)
df["indicator"] = df.apply(lambda r: INVERT.get(r["source_column"], r["indicator"]), axis=1)
df["level"] = df.apply(
    lambda r: level(r["risk_share"]) if r["family"] in LEVELLED else "Context only", axis=1)
# level_certain: True only if the whole 95% margin stays inside one tier
df["level_certain"] = df.apply(
    lambda r: level(r["risk_share"] - r["moe_pp"]) == level(r["risk_share"] + r["moe_pp"])
    if r["family"] in LEVELLED else None, axis=1)

rec = {(r["scope"], r["sector_group"], r["source_column"]): r for r in df.to_dict("records")}
cols = df.drop_duplicates("source_column")[["source_column", "indicator", "family"]]
sectors = sorted(df["sector_group"].unique())

out = []
for scope in ["Kenya", "Nairobi"]:
    for sector in sectors + NO_DATA:
        for _, c in cols.iterrows():
            base = {"requested_scope": scope, "requested_sector": sector,
                    "source_column": c["source_column"], "indicator": c["indicator"],
                    "family": c["family"], "source": SOURCE}
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
                        "n_valid": r["n_valid"], "n_eff": r["n_eff"],
                        "level": r["level"], "level_certain": r["level_certain"]})

res = pd.DataFrame(out)
res.to_csv(OUT, index=False, encoding="utf-8")

sys.stdout = open(REPORT, "w", encoding="utf-8")
print("=== Rule tiers (share of firms at risk) ===")
print(TIERS, "| levelled families:", sorted(LEVELLED))

a = df[df["sector_group"] == "All sectors"]
t = a.pivot(index="indicator", columns="scope",
            values=["risk_share", "moe_pp", "level", "level_certain"])
t = t.sort_values(("risk_share", "Kenya"), ascending=False)
print("\n=== All sectors: risk share, margin, level, level_certain ===")
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

print("\n=== Fallback rows in Nairobi / Wholesale (which indicator?) ===")
w = res[(res["requested_scope"] == "Nairobi") & (res["requested_sector"] == "Wholesale & motor trade")
        & (res["status"] != "direct")]
print(w[["indicator", "status", "source_scope", "source_sector", "n_eff"]].to_string())

print("\n=== Direct sector rows: how many levels are certain? ===")
dd = res[(res["status"] == "direct") & (res["family"].isin(LEVELLED))]
print(dd.groupby(["requested_scope", "requested_sector"])["level_certain"]
        .agg(certain="sum", total="count").to_string())

print("\n=== Effective sample sizes, Nairobi sector cells (obstacle rows) ===")
x = df[(df["scope"] == "Nairobi") & (df["family"] == "obstacle")]
print(x.groupby("sector_group")[["n_valid", "n_eff"]].min().to_string())
sys.stdout.close()