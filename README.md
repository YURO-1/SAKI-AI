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
- The frontend presents a rule-based plain-language assessment before expandable technical estimates; it does not issue an open/close verdict.
- The signed-in workspace separates Overview, My Opportunities, Assessments, AI Support, and the Final Report into navigable pages.
- The final report starts with a combined survey-and-search narrative and recommended checks; full model probabilities, benchmarks, and indicator tables are kept in a collapsed evidence section.
- KNBS capital and revenue figures are nominal 2016 KSh and are not inflation-adjusted, so the assessment cannot determine whether a current startup budget is sufficient.
- Optional live web search is triggered only when the user requests it. It is separate from the historical assessment and returns dated search snippets with source links.
- Optional online research sends the submitted business idea name, an inferred business type, Kenya, and issue terms to Tavily. It runs one general web search and one Reddit-focused search (up to two basic-search credits per run); exact location, capital, user email, and model/survey results are not sent.
- Search terms target problems facing the named business in Kenya, including taxes and fees, crime/security, corruption/bribery, competition, and profile-specific operating issues. Results remain keyword-filtered and may include unverified social posts; review the linked source before relying on them.
- A result is shown only when its text mentions the submitted idea name or a recognized business type and matches a relevant issue; broad sector-only results are excluded.

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
Set the PostgreSQL connection values and a private JWT signing secret in the current PowerShell session, then start the API. The database defaults to `saki_ai`:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/saki_ai"
$env:DB_USERNAME = "your-postgres-role"
$env:DB_PASSWORD = "your-local-postgres-password"
$env:SAKI_JWT_SECRET = "generate-a-private-secret-at-least-32-bytes-long"
$env:ML_SERVICE_URL = "http://127.0.0.1:8000"
$env:SAKI_ADMIN_EMAIL = "admin@example.test"
$env:SAKI_ADMIN_PASSWORD = "use-a-private-password-of-at-least-12-characters"
$env:TAVILY_API_KEY = "your-private-Tavily-API-key"
.\mvnw.cmd spring-boot:run
```

`TAVILY_API_KEY` is optional; without it, live search returns a configuration error and regular assessments continue to work. Tavily's free plan lists 1,000 API credits per month and does not require a credit card; each basic search uses one credit. Search results may include forum posts, which are user reports rather than verified facts. Keep this key, credentials, and JWT secrets out of source control. The administrator environment variables are optional, but must be set together. On startup, they create an `ADMIN` account only if that email does not exist; an existing regular account is never promoted automatically. The ML service must be running for analyses and administrator model metadata to be available.

Key routes:
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET|POST /api/ideas`, `GET|PUT|DELETE /api/ideas/{id}`
- `POST|GET /api/ideas/{id}/analyses`
- `GET /api/admin/model` (administrator only; proxies current model metadata)
- `GET /api/health`

### Run the frontend
In another PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

The frontend defaults to the Spring Boot API at `http://localhost:8080`. Override it with `VITE_API_URL` if needed.