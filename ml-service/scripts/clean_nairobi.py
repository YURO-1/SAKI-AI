"""Clean the KNBS MSME 2016 Nairobi subset. Every step is counted in docs/cleaning_report.txt.
Usage (from ml-service/):  python scripts/clean_nairobi.py
Output: data/processed/nairobi_clean.csv  (local only, git-ignored)
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "knbs_msme_2016.dta"
OUT = ROOT / "data" / "processed" / "nairobi_clean.csv"
REPORT = ROOT / "docs" / "cleaning_report.txt"

NAIROBI = 101
SURVEY_YEAR = 2016
LOW_MAX, MED_MAX = 15_000, 100_000  # KSh per month

log = []
def say(msg=""):
    print(msg)
    log.append(msg)

def sector_group(div):
    if pd.isna(div): return "Unknown"
    d = int(div)
    if d == 47: return "Retail trade"
    if d in (45, 46): return "Wholesale & motor trade"
    if d in (55, 56): return "Food & accommodation"
    if d == 96: return "Personal services"
    if d in (85, 86): return "Education & health"
    if 10 <= d <= 33: return "Manufacturing"
    if d in (49, 50, 51, 52, 53): return "Transport & storage"
    if d in (58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73, 74, 75, 77, 78, 79, 80, 81, 82):
        return "Business & financial services"
    return "Other"

def premises_group(code):
    if pd.isna(code): return "Unknown"
    c = int(code)
    if c == 1: return "Commercial premises"
    if c in (12, 13): return "Residential"
    if c in (3, 5, 6): return "Market stall / kiosk"
    if c in (2, 9): return "Industrial / jua kali"
    return "Open-air / mobile / other"

df = pd.read_stata(RAW, convert_categoricals=False)
nai = df[df["county11"] == NAIROBI].copy()
say(f"Nairobi rows: {len(nai):,}")

out = pd.DataFrame(index=nai.index)
if "key2" in nai.columns:
    out["establishment_id"] = nai["key2"]
out["est_wgt"] = nai["est_wgt"]

# --- target source: normal monthly revenue ---
rev = pd.to_numeric(nai["eh15_1"], errors="coerce")
say(f"Revenue negatives (treated as missing special codes): {(rev < 0).sum():,}")
say(f"Revenue zeros (kept in file, excluded from modelling): {(rev == 0).sum():,}")
say(f"Revenue already missing: {rev.isna().sum():,}")
rev = rev.where(rev >= 0)
out["monthly_revenue_ksh"] = rev

# --- initial capital ---
cap = pd.to_numeric(nai["el01"], errors="coerce")
say(f"Capital negatives (-98/-99 codes, treated as missing): {(cap < 0).sum():,}")
say(f"Capital zeros: {(cap == 0).sum():,}")
cap = cap.where(cap >= 0)
out["initial_capital_ksh"] = cap
out["capital_known"] = cap.notna().astype(int)

# --- start date and age (age is for EDA only, not a model feature) ---
start = pd.to_datetime(nai["eb02"], errors="coerce")
out["start_year"] = start.dt.year
out["business_age_years"] = SURVEY_YEAR - start.dt.year

# --- size at start ---
out["founding_employees"] = (
    pd.to_numeric(nai["ed01"], errors="coerce") + pd.to_numeric(nai["ed02"], errors="coerce")
)

# --- categoricals (original codes kept beside the grouped labels) ---
out["isic_division"] = pd.to_numeric(nai["eb01_2"], errors="coerce")
out["sector_group"] = out["isic_division"].apply(sector_group)
out["premises_code"] = pd.to_numeric(nai["eb03"], errors="coerce")
out["premises_group"] = out["premises_code"].apply(premises_group)
out["registered"] = pd.to_numeric(nai["ej15"], errors="coerce")
out["main_buyer_code"] = pd.to_numeric(nai["ej19"], errors="coerce")
out["capital_source_code"] = pd.to_numeric(nai["el02"], errors="coerce")

# --- target: revenue tier ---
tier = pd.cut(out["monthly_revenue_ksh"], bins=[0, LOW_MAX, MED_MAX, np.inf],
              labels=["Low", "Medium", "High"], right=False)
# exactly 0 revenue falls outside (0, ...] so it becomes missing:
tier[out["monthly_revenue_ksh"] <= 0] = np.nan
out["revenue_tier"] = tier

# --- modelling eligibility (nothing is deleted, only flagged) ---
out["model_eligible"] = (
    out["revenue_tier"].notna() & out["capital_known"].eq(1)
    & (out["initial_capital_ksh"] > 0) & out["start_year"].notna()
).astype(int)

say(f"\nRows with a valid revenue tier: {out['revenue_tier'].notna().sum():,}")
say(f"Rows flagged model_eligible: {out['model_eligible'].sum():,} of {len(out):,}")
say("\nRevenue tier counts (eligible rows):")
say(out.loc[out.model_eligible == 1, "revenue_tier"].value_counts().to_string())
say("\nSector group counts (eligible rows):")
say(out.loc[out.model_eligible == 1, "sector_group"].value_counts().to_string())
say("\nPremises group counts (eligible rows):")
say(out.loc[out.model_eligible == 1, "premises_group"].value_counts().to_string())
say("\nMissing values in key columns (all Nairobi rows):")
say(out[["monthly_revenue_ksh", "initial_capital_ksh", "start_year",
         "founding_employees", "registered"]].isna().sum().to_string())
say("\nRevenue by tier thresholds: Low < 15,000; Medium 15,000-99,999; High >= 100,000 (KSh/month)")

out.to_csv(OUT, index=False)
REPORT.write_text("\n".join(log), encoding="utf-8")
say(f"\nSaved: {OUT}\nReport: {REPORT}")