export interface BusinessIdeaInput {
  name: string
  sectorGroup: string
  location: string
  premisesGroup: string
  initialCapitalKsh: number
  registered: boolean
  mainBuyerCode: number
  capitalSourceCode: number
  foundingEmployees: number
}

export interface BusinessIdea extends BusinessIdeaInput {
  id: string
  createdAt: string
}

export interface ConstraintIndicator {
  indicator: string
  family: string
  status: string
  risk_share?: number | null
  moe_pp?: number | null
  source_scope?: string
  source_sector?: string
  level?: string
}

export interface Benchmark {
  sector_group: string
  n_establishments: number
  median_monthly_revenue_ksh: number
  p25_monthly_revenue_ksh: number
  p75_monthly_revenue_ksh: number
  median_initial_capital_ksh: number
  median_founding_employees: number
  pct_high: number
  reliable: boolean | number
}

export interface Analysis {
  id: string
  ideaId: string
  createdAt: string
  result: {
    revenuePrediction: {
      predicted_tier: string
      probabilities: Record<'Low' | 'Medium' | 'High', number>
      model_version: string
      limitation: string
    }
    constraints: {
      scope: string
      sector: string
      source: string
      indicators: ConstraintIndicator[]
    }
    benchmark: Benchmark
    assessmentNotes: string[]
  }
}

export interface BusinessResearch {
  retrievedAt: string
  sector: string
  geography: string
  businessType: string
  query: string
  keySignals: string[]
  results: Array<{
    title: string
    url: string
    snippet: string
    publishedDate: string | null
    matchedTopics: string[]
  }>
}

export type UserRole = 'USER' | 'ADMIN'

export interface ModelMetadata {
  model_name: string
  version: string
  target: string
  n_rows_total: number
  test_accuracy: number
  test_macro_f1: number
  limitations: string
}

interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  role: UserRole
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const text = await response.text()
  let body: unknown
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'detail' in body
      ? String(body.detail)
      : typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : typeof body === 'string' && body
          ? body
          : `Request failed (${response.status}).`
    throw new ApiError(message, response.status)
  }
  return body as T
}

export const api = {
  login: (email: string, password: string) =>
    request<TokenResponse>('/api/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<TokenResponse>('/api/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listIdeas: (token: string) => request<BusinessIdea[]>('/api/ideas', token),

  createIdea: (token: string, idea: BusinessIdeaInput) =>
    request<BusinessIdea>('/api/ideas', token, {
      method: 'POST',
      body: JSON.stringify(idea),
    }),

  deleteIdea: (token: string, id: string) =>
    request<void>(`/api/ideas/${encodeURIComponent(id)}`, token, { method: 'DELETE' }),

  analyze: (token: string, id: string) =>
    request<Analysis>(`/api/ideas/${encodeURIComponent(id)}/analyses`, token, { method: 'POST' }),

  listAnalyses: (token: string, id: string) =>
    request<Analysis[]>(`/api/ideas/${encodeURIComponent(id)}/analyses`, token),

  research: (token: string, id: string) =>
    request<BusinessResearch>(`/api/ideas/${encodeURIComponent(id)}/research`, token, { method: 'POST' }),

  currentModel: (token: string) =>
    request<ModelMetadata>('/api/admin/model', token),
}
