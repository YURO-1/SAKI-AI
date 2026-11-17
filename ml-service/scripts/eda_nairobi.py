"""Exploratory analysis of the cleaned Nairobi data + benchmark tables.
Usage (from ml-service/):  python scripts/eda_nairobi.py
Outputs: docs/figures/*.png, docs/eda_report.txt, data/processed/sector_benchmarks.csv
"""
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed" / "nairobi_clean.csv"
FIG = ROOT / "docs" / "figures"
REPORT = ROOT / "docs" / "eda_report.txt"
BENCH = ROOT / "data" / "processed" / "sector_benchmarks.csv"
MIN_N = 30  # cells smaller than this are flagged unreliable

log = []
def say(msg=""):
    print(msg)
    log.append(msg)

df = pd.read_csv(DATA)
m = df[df["model_eligible"] == 1].copy()
m["log_revenue"] = np.log10(m["monthly_revenue_ksh"])
m["log_capital"] = np.log10(m["initial_capital_ksh"])
order = ["Low", "Medium", "High"]
m["revenue_tier"] = pd.Categorical(m["revenue_tier"], categories=order, ordered=True)
say(f"Eligible Nairobi rows: {len(m):,}\n")

# 1. Revenue distribution (log scale)
plt.figure(figsize=(7, 4))
plt.hist(m["log_revenue"], bins=30, color="#047857")
plt.axvline(np.log10(15_000), color="#f59e0b", ls="--", label="Low/Medium: KSh 15,000")
plt.axvline(np.log10(100_000), color="#b91c1c", ls="--", label="Medium/High: KSh 100,000")
plt.xlabel("log10 monthly revenue (KSh)"); plt.ylabel("Establishments")
plt.title("Monthly revenue, Nairobi MSMEs (KNBS 2016)"); plt.legend()
plt.tight_layout(); plt.savefig(FIG / "01_revenue_distribution.png", dpi=150); plt.close()

# 2. Capital vs revenue
rho = m["initial_capital_ksh"].corr(m["monthly_revenue_ksh"], method="spearman")
say(f"Spearman correlation, initial capital vs monthly revenue: {rho:.2f}")
plt.figure(figsize=(6, 5))
plt.scatter(m["log_capital"], m["log_revenue"], s=10, alpha=0.4, color="#047857")
plt.xlabel("log10 initial capital (KSh)"); plt.ylabel("log10 monthly revenue (KSh)")
plt.title(f"Capital vs revenue (Spearman = {rho:.2f})")
plt.tight_layout(); plt.savefig(FIG / "02_capital_vs_revenue.png", dpi=150); plt.close()

# 3. Tier share by sector
share = pd.crosstab(m["sector_group"], m["revenue_tier"], normalize="index")[order] * 100
share = share.sort_values("High")
share.plot(kind="barh", stacked=True, figsize=(8, 5), color=["#fbbf24", "#34d399", "#047857"])
plt.xlabel("% of establishments"); plt.title("Revenue tier by sector"); plt.legend(title="Tier")
plt.tight_layout(); plt.savefig(FIG / "03_tier_by_sector.png", dpi=150); plt.close()

# 4. Tier share by premises type
share2 = pd.crosstab(m["premises_group"], m["revenue_tier"], normalize="index")[order] * 100
share2.sort_values("High").plot(kind="barh", stacked=True, figsize=(8, 4),
                                color=["#fbbf24", "#34d399", "#047857"])
plt.xlabel("% of establishments"); plt.title("Revenue tier by premises type")
plt.tight_layout(); plt.savefig(FIG / "04_tier_by_premises.png", dpi=150); plt.close()

# 5. Tier by capital band
bands = [0, 50_000, 200_000, 1_000_000, np.inf]
labels = ["<50k", "50k-200k", "200k-1M", ">1M"]
m["capital_band"] = pd.cut(m["initial_capital_ksh"], bins=bands, labels=labels, right=False)
cb = pd.crosstab(m["capital_band"], m["revenue_tier"], normalize="index")[order] * 100
say("\nRevenue tier (%) by initial capital band:")
say(cb.round(1).to_string())
say("\nCounts per capital band:")
say(m["capital_band"].value_counts().reindex(labels).to_string())
cb.plot(kind="bar", stacked=True, figsize=(7, 4), color=["#fbbf24", "#34d399", "#047857"])
plt.ylabel("% of establishments"); plt.xticks(rotation=0); plt.title("Revenue tier by initial capital")
plt.tight_layout(); plt.savefig(FIG / "05_tier_by_capital.png", dpi=150); plt.close()

# 6. Registered vs not
say("\nRevenue tier (%) by registration:")
say((pd.crosstab(m["registered"], m["revenue_tier"], normalize="index")[order] * 100).round(1).to_string())

# 7. Sector benchmark table (this feeds the analysis engine later)
def q(s, p): return s.quantile(p)
rows = []
for sector, g in m.groupby("sector_group"):
    rows.append({
        "sector_group": sector,
        "n_establishments": len(g),
        "median_monthly_revenue_ksh": g["monthly_revenue_ksh"].median(),
        "p25_monthly_revenue_ksh": q(g["monthly_revenue_ksh"], 0.25),
        "p75_monthly_revenue_ksh": q(g["monthly_revenue_ksh"], 0.75),
        "median_initial_capital_ksh": g["initial_capital_ksh"].median(),
        "p25_initial_capital_ksh": q(g["initial_capital_ksh"], 0.25),
        "p75_initial_capital_ksh": q(g["initial_capital_ksh"], 0.75),
        "median_founding_employees": g["founding_employees"].median(),
        "pct_registered": g["registered"].mean() * 100,
        "pct_low": (g["revenue_tier"] == "Low").mean() * 100,
        "pct_medium": (g["revenue_tier"] == "Medium").mean() * 100,
        "pct_high": (g["revenue_tier"] == "High").mean() * 100,
        "reliable": int(len(g) >= MIN_N),
    })
bench = pd.DataFrame(rows).sort_values("n_establishments", ascending=False).round(1)
bench.to_csv(BENCH, index=False)
say("\nSector benchmarks (reliable = at least 30 establishments):")
say(bench[["sector_group", "n_establishments", "median_monthly_revenue_ksh",
           "median_initial_capital_ksh", "pct_high", "reliable"]].to_string(index=False))

# 8. Density proxy for competition: share of ALL Nairobi survey rows per sector
all_n = pd.read_csv(DATA)["sector_group"].value_counts()
say("\nSurveyed Nairobi establishments per sector (all rows, a density PROXY only):")
say(all_n.to_string())

REPORT.write_text("\n".join(log), encoding="utf-8")
say(f"\nFigures saved in: {FIG}\nReport: {REPORT}\nBenchmarks: {BENCH}")