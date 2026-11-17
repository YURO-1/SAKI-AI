"""Inspect a Stata (.dta) dataset without modifying it.
Usage (from ml-service/):  python scripts/inspect_dataset.py ../data/raw/knbs_msme_2016.dta
Writes a column dictionary to ../docs/column_dictionary.csv
"""
import sys
from pathlib import Path
import pandas as pd


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Give the path to the .dta file.")
    path = Path(sys.argv[1])

    # Read the file twice: once for data, once for the variable labels.
    df = pd.read_stata(path, convert_categoricals=False)
    with pd.io.stata.StataReader(path) as reader:
        labels = reader.variable_labels()

    print(f"\nFILE: {path.name}")
    print(f"Rows: {len(df):,}   Columns: {df.shape[1]:,}")
    print(f"Fully duplicated rows: {df.duplicated().sum():,}")

    print("\n--- Column types ---")
    print(df.dtypes.value_counts())

    # Column dictionary: name, label, type, % missing, number of unique values
    dictionary = pd.DataFrame({
        "column": df.columns,
        "label": [labels.get(c, "") for c in df.columns],
        "dtype": [str(df[c].dtype) for c in df.columns],
        "pct_missing": [round(df[c].isna().mean() * 100, 1) for c in df.columns],
        "n_unique": [df[c].nunique(dropna=True) for c in df.columns],
    })
    out = Path(__file__).resolve().parents[2] / "docs" / "column_dictionary.csv"
    dictionary.to_csv(out, index=False)
    print(f"\nColumn dictionary saved to: {out}")

    print("\n--- Location-related columns ---")
    keys = ("county", "region", "location", "town", "ward", "eb03")
    loc_cols = [c for c in df.columns if any(k in c.lower() for k in keys)]
    print(loc_cols)
    for c in loc_cols[:5]:
        print(f"\nLabel: {labels.get(c, '')}")
        print(f"Value counts for {c}:")
        print(df[c].value_counts(dropna=False).head(15).to_string())


if __name__ == "__main__":
    main()