# BizScope Nairobi

An AI-powered business opportunity analysis system for Nairobi (working title; internally "SAKI AI").

Final-year project. Stack: React + TypeScript + Tailwind, Spring Boot, PostgreSQL, Python (FastAPI + Scikit-learn).

## Structure
- `frontend/`: React web app
- `backend/`: Spring Boot API
- `ml-service/`: FastAPI model service
- `data/`: datasets (raw, processed, survey)
- `notebooks/`: exploration and EDA
- `docs/`: architecture and report material

## Current analysis data roles
- The KNBS-trained model estimates a historical monthly revenue tier; it does not predict whether a new business will succeed.
- KNBS sector benchmarks provide historical revenue and resource references; WBES provides sector-level operating constraints and competition context, not model training.
- These secondary-data indicators are not direct customer demand or a forecast of a proposed business's sales.
- The analysis API keeps the model estimate, historical benchmarks and WBES evidence separate and includes their limitations.

## Backend API
The Spring Boot API is in `backend/`. It provides registration/login, owner-scoped business-idea CRUD and saved analysis endpoints.

### Run tests
From the repository root:

```powershell
cd backend
.\mvnw.cmd test
```

Tests use an in-memory H2 database and do not require the local PostgreSQL password.

### Run the ML and evidence service
In a separate PowerShell terminal:

```powershell
cd ml-service
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

### Run the backend locally
Set the PostgreSQL connection values and a private JWT signing secret in the current PowerShell session, then start the API:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/saki"
$env:DB_USERNAME = "your-postgres-role"
$env:DB_PASSWORD = "your-local-postgres-password"
$env:SAKI_JWT_SECRET = "generate-a-private-secret-at-least-32-bytes-long"
$env:ML_SERVICE_URL = "http://127.0.0.1:8000"
.\mvnw.cmd spring-boot:run
```

Do not commit credentials or use the example JWT secret in a deployed environment. The ML service must be running for analyses to be generated.

Key routes:
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET|POST /api/ideas`, `GET|PUT|DELETE /api/ideas/{id}`
- `POST|GET /api/ideas/{id}/analyses`
- `GET /api/health`

### Run the frontend
In another PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

The frontend defaults to the Spring Boot API at `http://localhost:8080`. Override it with `VITE_API_URL` if needed.