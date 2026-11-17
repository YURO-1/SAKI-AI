import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_revenue_prediction():
    response = client.post(
        "/predict/revenue-tier",
        json={
            "sector_group": "Retail trade",
            "premises_group": "Commercial premises",
            "registered": 1,
            "main_buyer_code": 4,
            "capital_source_code": 1,
            "initial_capital_ksh": 150000,
            "founding_employees": 2,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["predicted_tier"] in {"Low", "Medium", "High"}
    assert set(body["probabilities"]) == {"Low", "Medium", "High"}
    assert "does not predict" in body["limitation"]


def test_invalid_prediction_is_rejected():
    response = client.post(
        "/predict/revenue-tier",
        json={
            "sector_group": "Retail trade",
            "premises_group": "Commercial premises",
            "registered": 2,
            "main_buyer_code": 4,
            "capital_source_code": 1,
            "initial_capital_ksh": 150000,
            "founding_employees": 2,
        },
    )
    assert response.status_code == 422


def test_constraints():
    response = client.get(
        "/constraints",
        params={"scope": "Nairobi", "sector": "Retail trade"},
    )
    assert response.status_code == 200
    assert response.json()["indicators"]


def test_benchmark():
    response = client.get("/benchmarks", params={"sector": "Retail trade"})
    assert response.status_code == 200
    assert response.json()["median_monthly_revenue_ksh"] == 19500.0
