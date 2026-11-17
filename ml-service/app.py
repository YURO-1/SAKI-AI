import json
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "ml-service" / "models" / "saki_tier_model.joblib"
METADATA_PATH = ROOT / "ml-service" / "models" / "model_metadata.json"
RULES_PATH = ROOT / "data" / "processed" / "wbes_rules.csv"
BENCHMARKS_PATH = ROOT / "data" / "processed" / "sector_benchmarks.csv"

SECTOR_GROUPS = [
    "Retail trade",
    "Wholesale & motor trade",
    "Food & accommodation",
    "Personal services",
    "Education & health",
    "Manufacturing",
    "Transport & storage",
    "Business & financial services",
    "Construction",
    "Other",
]

PREMISES_GROUPS = [
    "Commercial premises",
    "Residential",
    "Market stall / kiosk",
    "Industrial / jua kali",
    "Open-air / mobile / other",
]


class RevenuePredictionInput(BaseModel):
    sector_group: Literal[
        "Retail trade",
        "Wholesale & motor trade",
        "Food & accommodation",
        "Personal services",
        "Education & health",
        "Manufacturing",
        "Transport & storage",
        "Business & financial services",
        "Construction",
        "Other",
    ]
    premises_group: Literal[
        "Commercial premises",
        "Residential",
        "Market stall / kiosk",
        "Industrial / jua kali",
        "Open-air / mobile / other",
    ]
    registered: Literal[0, 1]
    main_buyer_code: int = Field(ge=0)
    capital_source_code: int = Field(ge=0)
    initial_capital_ksh: float = Field(gt=0)
    founding_employees: int = Field(ge=0)


class RevenuePredictionOutput(BaseModel):
    predicted_tier: str
    probabilities: dict[str, float]
    model_version: str
    limitation: str


app = FastAPI(
    title="SAKI AI ML and Evidence Service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def load_model():
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")
    return joblib.load(MODEL_PATH)


model = load_model()
metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
rules = pd.read_csv(RULES_PATH)
benchmarks = pd.read_csv(BENCHMARKS_PATH)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.get("/metadata")
def model_metadata():
    return metadata


@app.post("/predict/revenue-tier", response_model=RevenuePredictionOutput)
def predict_revenue_tier(payload: RevenuePredictionInput):
    row = {
        "sector_group": payload.sector_group,
        "premises_group": payload.premises_group,
        "registered": str(payload.registered),
        "main_buyer_code": str(payload.main_buyer_code),
        "capital_source_code": str(payload.capital_source_code),
        "initial_capital_ksh": payload.initial_capital_ksh,
        "founding_employees": payload.founding_employees,
    }
    features = pd.DataFrame([row])

    predicted = str(model.predict(features)[0])
    probabilities = {
        str(label): round(float(prob), 6)
        for label, prob in zip(model.classes_, model.predict_proba(features)[0])
    }

    return RevenuePredictionOutput(
        predicted_tier=predicted,
        probabilities=probabilities,
        model_version=metadata["version"],
        limitation=(
            "This estimates a historical monthly revenue tier for surviving "
            "establishments. It does not predict business survival or success."
        ),
    )


@app.get("/constraints")
def get_constraints(
    scope: Literal["Kenya", "Nairobi"] = "Nairobi",
    sector: str = Query(..., description="SAKI sector group"),
):
    selected = rules[
        (rules["requested_scope"] == scope)
        & (rules["requested_sector"] == sector)
    ]
    if selected.empty:
        raise HTTPException(
            status_code=404,
            detail="No constraint evidence is available for this scope and sector.",
        )
    return {
        "scope": scope,
        "sector": sector,
        "source": "World Bank Enterprise Surveys, Kenya 2025",
        "indicators": selected.where(pd.notna(selected), None).to_dict(orient="records"),
    }


@app.get("/benchmarks")
def get_benchmark(sector: str = Query(..., description="SAKI sector group")):
    selected = benchmarks[benchmarks["sector_group"] == sector]
    if selected.empty:
        raise HTTPException(
            status_code=404,
            detail="No KNBS benchmark is available for this sector.",
        )
    return selected.where(pd.notna(selected), None).to_dict(orient="records")[0]
