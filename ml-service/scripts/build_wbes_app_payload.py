"""Build the app-facing WBES payload from the rules output.
Usage (from ml-service/), after build_wbes_rules.py:  python scripts/build_wbes_app_payload.py
Output: data/processed/wbes_app.json
"""
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
IN = ROOT / "data" / "processed" / "wbes_rules.csv"
OUT = ROOT / "data" / "processed" / "wbes_app.json"
TOP_N = 5
# Replace with the exact citation wording from the WBES download page
SOURCE = ("The World Bank Group. Republic of Kenya - World Bank Enterprise Survey (WBES) 2025, "
          "Ref. KEN_2025_WBES_v01_M. Dataset downloaded from "
          "https://www.enterprisesurveys.org/en/data on [11/17/2026].")

df = pd.read_csv(IN).astype(object)
df = df.where(pd.notna(df), None)

def display_level(r):
    if r["status"] in ("no WBES data", "limited data"):
        return None
    if r["family"] not in ("obstacle", "bribery"):
        return "Context only"
    return r["level"] if r["level_certain"] in (True, "True") else f"{r['level']} (uncertain)"

def note(r):
    if r["status"] == "no WBES data":
        return "This sector is outside the survey's coverage."
    if r["status"] == "limited data":
        return "Too few firms to report."
    if r["status"] == "fallback":
        return (f"Sample too small for {r['requested_scope']} / {r['requested_sector']}; "
                f"showing {r['source_scope']} / {r['source_sector']} instead.")
    return None

records = []
for r in df.to_dict("records"):
    records.append({
        "scope": r["requested_scope"], "sector": r["requested_sector"],
        "indicator": r["indicator"], "family": r["family"], "status": r["status"],
        "share_pct": r["risk_share"], "margin_pp": r["moe_pp"],
        "level": display_level(r), "note": note(r),
        "source_scope": r.get("source_scope"), "source_sector": r.get("source_sector"),
        "n_valid": r["n_valid"], "n_eff": r["n_eff"],
    })

# Top obstacles per requested scope and sector, by share
top = {}
for (sc, se), g in pd.DataFrame(records).groupby(["scope", "sector"]):
    g = g[(g["family"] == "obstacle") & g["share_pct"].notna()]
    g = g.sort_values("share_pct", ascending=False).head(TOP_N)
    top[f"{sc}|{se}"] = g[["indicator", "share_pct", "margin_pp", "status"]].to_dict("records")

payload = {
    "meta": {
        "source": SOURCE,
        "survey": "2025 survey of 1,024 formal establishments",
        "obstacle_definition": "Share of firms rating the item a major or very severe obstacle",
        "coverage_note": "Education, health and personal services are outside the survey's coverage.",
        "nairobi_note": "Nairobi differs from Kenya by less than its margin of error on every indicator.",
        "margin_note": "Margins are 95% and use the effective sample size after weighting.",
    },
    "records": records,
    "top_obstacles": top,
}
OUT.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
print(f"Wrote {OUT} with {len(records)} records and {len(top)} top-obstacle lists")