import { useEffect, useState } from 'react'
import {
  api,
  ApiError,
  type Analysis,
  type BusinessIdea,
  type BusinessIdeaInput,
  type ConstraintIndicator,
  type ModelMetadata,
  type UserRole,
} from './api'

const sectors = [
  'Retail trade',
  'Wholesale & motor trade',
  'Food & accommodation',
  'Personal services',
  'Education & health',
  'Manufacturing',
  'Transport & storage',
  'Business & financial services',
  'Construction',
  'Other',
]

const premisesTypes = [
  'Commercial premises',
  'Residential',
  'Market stall / kiosk',
  'Industrial / jua kali',
  'Open-air / mobile / other',
]

const initialIdea: BusinessIdeaInput = {
  name: '',
  sectorGroup: 'Retail trade',
  location: '',
  premisesGroup: 'Commercial premises',
  initialCapitalKsh: 150000,
  registered: false,
  mainBuyerCode: 4,
  capitalSourceCode: 1,
  foundingEmployees: 1,
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('saki-token'))
  const [role, setRole] = useState<UserRole>(() => sessionStorage.getItem('saki-role') === 'ADMIN' ? 'ADMIN' : 'USER')
  const [email, setEmail] = useState(() => sessionStorage.getItem('saki-email') ?? '')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [ideas, setIdeas] = useState<BusinessIdea[]>([])
  const [form, setForm] = useState<BusinessIdeaInput>(initialIdea)
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null)
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)
  const [modelMetadata, setModelMetadata] = useState<ModelMetadata | null>(null)
  const [modelError, setModelError] = useState('')
  const [modelLoading, setModelLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    api.listIdeas(token)
      .then((items) => {
        if (!cancelled) setIdeas(items)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(messageFor(cause))
        if (cause instanceof ApiError && cause.status === 401) signOut()
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || role !== 'ADMIN') {
      setModelMetadata(null)
      setModelError('')
      setModelLoading(false)
      return
    }

    let cancelled = false
    setModelLoading(true)
    setModelError('')
    api.currentModel(token)
      .then((metadata) => {
        if (!cancelled) setModelMetadata(metadata)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setModelError(messageFor(cause))
      })
      .finally(() => {
        if (!cancelled) setModelLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, role])

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = isRegistering
        ? await api.register(email, password)
        : await api.login(email, password)
      sessionStorage.setItem('saki-token', response.accessToken)
      sessionStorage.setItem('saki-email', email.trim().toLowerCase())
      sessionStorage.setItem('saki-role', response.role)
      setEmail(email.trim().toLowerCase())
      setToken(response.accessToken)
      setRole(response.role)
      setPassword('')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    sessionStorage.removeItem('saki-token')
    sessionStorage.removeItem('saki-email')
    sessionStorage.removeItem('saki-role')
    setToken(null)
    setRole('USER')
    setEmail('')
    setIdeas([])
    setActiveAnalysis(null)
    setActiveIdeaId(null)
    setError('')
  }

  async function createIdea(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const idea = await api.createIdea(token, form)
      setIdeas((current) => [idea, ...current])
      setForm(initialIdea)
      setActiveIdeaId(idea.id)
      setActiveAnalysis(null)
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  async function runAnalysis(idea: BusinessIdea) {
    if (!token) return
    setBusy(true)
    setError('')
    setActiveIdeaId(idea.id)
    try {
      const analysis = await api.analyze(token, idea.id)
      setActiveAnalysis(analysis)
    } catch (cause) {
      setError(messageFor(cause))
      setActiveAnalysis(null)
    } finally {
      setBusy(false)
    }
  }

  async function showLatestAnalysis(idea: BusinessIdea) {
    if (!token) return
    setBusy(true)
    setError('')
    setActiveIdeaId(idea.id)
    try {
      const saved = await api.listAnalyses(token, idea.id)
      setActiveAnalysis(saved[0] ?? null)
      if (saved.length === 0) setError('No saved assessment for this idea yet. Run an assessment to create one.')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  async function deleteIdea(idea: BusinessIdea) {
    if (!token || !window.confirm(`Delete "${idea.name}" and its saved assessments?`)) return
    setBusy(true)
    setError('')
    try {
      await api.deleteIdea(token, idea.id)
      setIdeas((current) => current.filter((item) => item.id !== idea.id))
      if (activeIdeaId === idea.id) {
        setActiveIdeaId(null)
        setActiveAnalysis(null)
      }
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthScreen
        email={email}
        password={password}
        isRegistering={isRegistering}
        busy={busy}
        error={error}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onRegisterToggle={() => {
          setIsRegistering((current) => !current)
          setError('')
        }}
        onSubmit={submitAuth}
      />
    )
  }

  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId)

  return (
    <div className="min-h-screen bg-[#f5f7f3] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
          <a className="mb-12 flex items-center gap-3" href="#overview" aria-label="SAKI AI home">
            <BrandMark />
            <span className="text-xl font-extrabold tracking-tight text-[#18372e]">SAKI<span className="text-[#80a944]">AI</span></span>
          </a>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <a className="nav-link nav-link-active" href="#overview"><span>01</span> Overview</a>
          <a className="nav-link" href="#ideas"><span>02</span> My opportunities</a>
          <a className="nav-link" href="#assessment"><span>03</span> Assessments</a>
          {role === 'ADMIN' && <a className="nav-link" href="#admin-model"><span>04</span> Model metadata</a>}
          <div className="mt-auto rounded-2xl bg-[#f2f6ec] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#264b3e]">
              <span className="h-2 w-2 rounded-full bg-[#82a849]" />
              Evidence-led insights
            </div>
            <p className="text-xs leading-5 text-slate-600">KNBS revenue benchmarks and WBES constraints are shown with their sources and limitations.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-10 lg:py-8">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <BrandMark />
              <span className="font-extrabold text-[#18372e]">SAKI AI</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm text-slate-500">Nairobi business opportunity workspace</p>
              <p className="mt-1 text-xs text-slate-400">Research-backed, not a guarantee of success</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:block">{email}</span>
              <button className="button-secondary !px-4 !py-2 text-sm" onClick={signOut}>Sign out</button>
            </div>
          </header>

          <section id="overview" className="mb-7 overflow-hidden rounded-[28px] bg-[#19392f] px-6 py-7 text-white sm:px-9 sm:py-9">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#c5df9a]">Make the next move clearer</p>
                <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Turn your business idea into an evidence-led plan.</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">Compare your proposal with Nairobi business benchmarks and see the constraints reported by established firms.</p>
              </div>
              <a href="#new-idea" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#c4e394] px-5 py-3 text-sm font-bold text-[#1b352d] transition hover:bg-[#d2efa2]">
                <span className="text-lg leading-none">+</span> Assess an idea
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">KNBS · Nairobi MSME Survey 2016</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">World Bank Enterprise Surveys · Kenya 2025</span>
            </div>
          </section>

          {error && (
            <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>{error}</span>
              <button aria-label="Dismiss error" className="font-bold" onClick={() => setError('')}>×</button>
            </div>
          )}

          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Your opportunities" value={ideas.length.toString()} note="Ideas saved to your account" accent="green" />
            <MetricCard label="Assessment evidence" value={activeAnalysis ? 'Ready' : 'On demand'} note="Generated from the current data sources" accent="blue" />
            <MetricCard label="Market context" value="Secondary data" note="Historical KNBS activity and WBES sector evidence" accent="sand" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <section id="new-idea" className="panel-card">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="section-eyebrow">01 / Opportunity details</p>
                  <h2 className="section-title">Describe your business idea</h2>
                </div>
                <span className="rounded-full bg-[#f0f5e8] px-3 py-1 text-xs font-semibold text-[#54733a]">KSh</span>
              </div>
              <form className="grid gap-x-4 gap-y-4 sm:grid-cols-2" onSubmit={createIdea}>
                <label className="field-label sm:col-span-2">
                  Idea name
                  <input className="field-input" maxLength={120} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Neighbourhood grocery shop" />
                </label>
                <label className="field-label">
                  Sector
                  <select className="field-input" value={form.sectorGroup} onChange={(event) => setForm({ ...form, sectorGroup: event.target.value })}>
                    {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  Proposed Nairobi area
                  <input className="field-input" maxLength={120} required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="e.g. Westlands" />
                </label>
                <label className="field-label">
                  Premises type
                  <select className="field-input" value={form.premisesGroup} onChange={(event) => setForm({ ...form, premisesGroup: event.target.value })}>
                    {premisesTypes.map((premise) => <option key={premise}>{premise}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  Estimated startup capital (KSh)
                  <input className="field-input" type="number" min="1" step="1" required value={form.initialCapitalKsh} onChange={(event) => setForm({ ...form, initialCapitalKsh: Number(event.target.value) })} />
                </label>
                <label className="field-label">
                  Founding employees
                  <input className="field-input" type="number" min="0" step="1" required value={form.foundingEmployees} onChange={(event) => setForm({ ...form, foundingEmployees: Number(event.target.value) })} />
                </label>
                <label className="field-label">
                  Main buyer type (KNBS code)
                  <input className="field-input" type="number" min="0" step="1" required value={form.mainBuyerCode} onChange={(event) => setForm({ ...form, mainBuyerCode: Number(event.target.value) })} />
                </label>
                <label className="field-label">
                  Capital source (KNBS code)
                  <input className="field-input" type="number" min="0" step="1" required value={form.capitalSourceCode} onChange={(event) => setForm({ ...form, capitalSourceCode: Number(event.target.value) })} />
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 sm:col-span-2">
                  <input className="h-4 w-4 accent-[#527f43]" type="checkbox" checked={form.registered} onChange={(event) => setForm({ ...form, registered: event.target.checked })} />
                  Business is formally registered
                </label>
                <button className="button-primary sm:col-span-2" disabled={busy} type="submit">
                  {busy ? 'Saving…' : 'Save opportunity'}
                </button>
              </form>
              <p className="mt-4 text-xs leading-5 text-slate-400">Some fields mirror KNBS survey categories so the model can compare your proposal with historical establishments.</p>
            </section>

            <section id="ideas" className="panel-card">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="section-eyebrow">02 / Your workspace</p>
                  <h2 className="section-title">Saved opportunities</h2>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-500">{ideas.length}</span>
              </div>
              {ideas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">Your ideas will appear here</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Add your first opportunity to compare it with available evidence.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {ideas.map((idea) => (
                    <li key={idea.id} className={`rounded-2xl border p-4 transition ${activeIdeaId === idea.id ? 'border-[#7c9d5a] bg-[#f8fbf2]' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-slate-800">{idea.name}</h3>
                          <p className="mt-1 text-xs text-slate-500">{idea.sectorGroup} · {idea.location}</p>
                        </div>
                        <button aria-label={`Delete ${idea.name}`} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-700" onClick={() => deleteIdea(idea)}>Delete</button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-600">KSh {idea.initialCapitalKsh.toLocaleString()}</span>
                        <div className="flex gap-2">
                          <button className="text-xs font-semibold text-[#416849] hover:underline" disabled={busy} onClick={() => showLatestAnalysis(idea)}>Saved result</button>
                          <button className="rounded-lg bg-[#19392f] px-3 py-2 text-xs font-bold text-white hover:bg-[#285444] disabled:opacity-50" disabled={busy} onClick={() => runAnalysis(idea)}>Assess</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section id="assessment" className="mt-6">
            {activeAnalysis ? (
              <AnalysisPanel analysis={activeAnalysis} idea={activeIdea} />
            ) : (
              <div className="panel-card flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="section-eyebrow">03 / Evidence-based assessment</p>
                  <h2 className="section-title">Your assessment will appear here</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Save an idea, then select Assess. Results show the revenue-tier estimate, KNBS sector benchmarks and WBES constraints separately.</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#f7f1df] px-3 py-1.5 text-xs font-semibold text-[#846a2e]">No success score is calculated</span>
              </div>
            )}
          </section>
          {role === 'ADMIN' && (
            <section id="admin-model" className="panel-card mt-6" aria-labelledby="admin-model-heading">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="section-eyebrow">Administrator / Model oversight</p>
                  <h2 id="admin-model-heading" className="section-title">Current model metadata</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This reports the deployed model and its evaluation results. Only one evaluated model is currently available; this page does not switch or activate versions.</p>
                </div>
                {modelMetadata && <span className="w-fit rounded-full bg-[#eaf2df] px-3 py-1.5 text-xs font-semibold text-[#4f703e]">Version {modelMetadata.version}</span>}
              </div>
              {modelLoading && <p className="mt-5 text-sm text-slate-500">Loading model metadata…</p>}
              {modelError && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{modelError}</p>}
              {modelMetadata && (
                <>
                  <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetadataValue label="Model" value={modelMetadata.model_name} />
                    <MetadataValue label="Training records" value={modelMetadata.n_rows_total.toLocaleString()} />
                    <MetadataValue label="Held-out test accuracy" value={`${(modelMetadata.test_accuracy * 100).toFixed(1)}%`} />
                    <MetadataValue label="Held-out macro-F1" value={`${(modelMetadata.test_macro_f1 * 100).toFixed(1)}%`} />
                  </dl>
                  <div className="mt-4 rounded-xl bg-[#f7f8f5] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prediction target</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{modelMetadata.target}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{modelMetadata.limitations}</p>
                  </div>
                </>
              )}
            </section>
          )}
          <footer className="mt-8 border-t border-slate-200 py-5 text-xs leading-5 text-slate-500">
            SAKI AI provides decision support, not guarantees. Results reflect historical survey data and should be considered alongside local research.
          </footer>
        </main>
      </div>
    </div>
  )
}

function AuthScreen({
  email,
  password,
  isRegistering,
  busy,
  error,
  onEmailChange,
  onPasswordChange,
  onRegisterToggle,
  onSubmit,
}: {
  email: string
  password: string
  isRegistering: boolean
  busy: boolean
  error: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onRegisterToggle: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f3] p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-xl shadow-slate-900/5 md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-[#19392f] p-8 text-white sm:p-10">
          <div className="relative z-10 flex items-center gap-3"><BrandMark /><span className="text-xl font-extrabold">SAKI AI</span></div>
          <div className="relative z-10 mt-16">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c5df9a]">Nairobi opportunity intelligence</p>
            <h1 className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Build your next move on better evidence.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/70">Explore business benchmarks and operating constraints with clear sources and honest limitations.</p>
          </div>
          <div className="relative z-10 mt-10 text-xs text-white/55">KNBS · World Bank Enterprise Surveys</div>
          <div className="pointer-events-none absolute -bottom-28 -right-14 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -right-6 h-64 w-64 rounded-full border border-white/10" />
        </section>
        <section className="p-7 sm:p-10">
          <p className="section-eyebrow">{isRegistering ? 'Create workspace' : 'Welcome back'}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{isRegistering ? 'Create your account' : 'Sign in to SAKI AI'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your saved opportunities are private to your account.</p>
          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
          <form className="mt-7 space-y-4" onSubmit={onSubmit}>
            <label className="field-label">
              Email address
              <input autoComplete="email" className="field-input" type="email" required value={email} onChange={(event) => onEmailChange(event.target.value)} />
            </label>
            <label className="field-label">
              Password
              <input autoComplete={isRegistering ? 'new-password' : 'current-password'} className="field-input" minLength={isRegistering ? 12 : undefined} required type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
              {isRegistering && <span className="mt-1 block text-xs font-normal text-slate-400">Use at least 12 characters.</span>}
            </label>
            <button className="button-primary mt-2 w-full" disabled={busy} type="submit">{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            {isRegistering ? 'Already have an account?' : 'New to SAKI AI?'}{' '}
            <button className="font-bold text-[#416849] hover:underline" onClick={onRegisterToggle}>{isRegistering ? 'Sign in' : 'Create an account'}</button>
          </p>
        </section>
      </div>
    </main>
  )
}

function AnalysisPanel({ analysis, idea }: { analysis: Analysis; idea: BusinessIdea | undefined }) {
  const { revenuePrediction, benchmark, constraints, assessmentNotes } = analysis.result
  const indicators = [...constraints.indicators].sort((a, b) => (b.risk_share ?? -1) - (a.risk_share ?? -1))
  const obstacles = indicators.filter((item) => item.family === 'obstacle')
  const competition = indicators.filter((item) => item.family === 'competition')

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="section-eyebrow">Assessment / {new Date(analysis.createdAt).toLocaleDateString()}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{idea?.name ?? 'Business idea'}</h2>
        </div>
        <span className="w-fit rounded-full bg-[#eaf2df] px-3 py-1.5 text-xs font-semibold text-[#4f703e]">Evidence by category</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="panel-card">
          <p className="section-eyebrow">KNBS model · Historical comparison</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Estimated monthly revenue tier</p>
              <p className="mt-1 text-3xl font-bold text-[#19392f]">{revenuePrediction.predicted_tier}</p>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Model v{revenuePrediction.model_version}</span>
          </div>
          <div className="mt-5 space-y-3">
            {(['Low', 'Medium', 'High'] as const).map((tier) => (
              <div key={tier}>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>{tier} tier</span><span>{Math.round((revenuePrediction.probabilities[tier] ?? 0) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${tier === revenuePrediction.predicted_tier ? 'bg-[#71964d]' : 'bg-slate-300'}`} style={{ width: `${(revenuePrediction.probabilities[tier] ?? 0) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-[#f7f8f5] p-3 text-xs leading-5 text-slate-500">{revenuePrediction.limitation}</p>
        </article>

        <article className="panel-card">
          <p className="section-eyebrow">KNBS · Sector benchmark</p>
          <h3 className="mt-1 text-lg font-bold text-slate-800">{benchmark.sector_group}</h3>
          <p className="mt-1 text-xs text-slate-500">Nairobi MSME survey 2016 · {benchmark.n_establishments} eligible establishments</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <BenchmarkValue label="Median monthly revenue" value={money(benchmark.median_monthly_revenue_ksh)} />
            <BenchmarkValue label="Revenue range (middle 50%)" value={`${money(benchmark.p25_monthly_revenue_ksh)} – ${money(benchmark.p75_monthly_revenue_ksh)}`} />
            <BenchmarkValue label="High-tier share" value={`${benchmark.pct_high}%`} />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">{benchmark.reliable ? 'Benchmark meets the project minimum sample threshold.' : 'Small sector sample: treat this benchmark as indicative only.'}</p>
        </article>
      </div>

      <article className="panel-card">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="section-eyebrow">World Bank Enterprise Surveys · Kenya 2025</p>
            <h3 className="section-title">Sector operating constraints</h3>
          </div>
          <span className="text-xs text-slate-400">Share of surveyed firms reporting the issue</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {obstacles.slice(0, 6).map((item) => <EvidenceIndicatorCard key={item.indicator} item={item} />)}
        </div>
        {obstacles.length === 0 && <p className="mt-4 text-sm text-slate-500">No WBES constraint observations are available for this sector.</p>}
      </article>

      <article className="panel-card">
        <p className="section-eyebrow">World Bank Enterprise Surveys · Kenya 2025</p>
        <h3 className="section-title">Competition indicators</h3>
        <p className="mt-1 text-xs text-slate-400">Firm-reported competition context, not a count of competitors in the proposed location.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {competition.map((item) => <EvidenceIndicatorCard key={item.indicator} item={item} />)}
        </div>
        {competition.length === 0 && <p className="mt-4 text-sm text-slate-500">No WBES competition observations are available for this sector.</p>}
      </article>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="panel-card">
          <p className="section-eyebrow">KNBS · Demand-related historical context</p>
          <h3 className="section-title">Observed sector business activity</h3>
          <p className="mt-1 text-xs text-slate-400">Nairobi MSME Survey 2016 · {benchmark.n_establishments} eligible establishments</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BenchmarkValue label="Median monthly revenue" value={money(benchmark.median_monthly_revenue_ksh)} />
            <BenchmarkValue label="Businesses in high revenue tier" value={`${benchmark.pct_high}%`} />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Historical sector activity is a demand-related indicator, not direct customer demand or a forecast of this idea’s sales.</p>
        </article>
        <article className="panel-card">
          <p className="section-eyebrow">KNBS · Resource planning context</p>
          <h3 className="section-title">Compare with historical sector medians</h3>
          {idea ? (
            <div className="mt-4 grid gap-3">
              <BenchmarkValue label="Your proposed startup capital" value={money(idea.initialCapitalKsh)} />
              <BenchmarkValue label="Sector median startup capital" value={money(benchmark.median_initial_capital_ksh)} />
              <BenchmarkValue label="Your planned founding employees" value={idea.foundingEmployees.toLocaleString()} />
              <BenchmarkValue label="Sector median founding employees" value={benchmark.median_founding_employees.toLocaleString()} />
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">Business profile details are unavailable for this comparison.</p>}
          <p className="mt-4 text-xs leading-5 text-slate-500">These are descriptive reference values, not recommended budgets or staffing levels.</p>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="panel-card">
          <p className="section-eyebrow">Interpretation notes</p>
          <ul className="mt-3 space-y-2">
            {assessmentNotes.map((note) => <li key={note} className="flex gap-2 text-sm leading-5 text-slate-600"><span className="text-[#779955]">•</span><span>{note}</span></li>)}
          </ul>
        </article>
      </div>
    </div>
  )
}

function EvidenceIndicatorCard({ item }: { item: ConstraintIndicator }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-5 text-slate-700">{item.indicator.replace(/^(Obstacle: |Competition: )/, '')}</p>
        <span className="shrink-0 text-sm font-bold text-[#456b45]">{item.risk_share == null ? '—' : `${item.risk_share}%`}</span>
      </div>
      {item.risk_share != null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#9bb873]" style={{ width: `${Math.min(item.risk_share, 100)}%` }} /></div>}
      <p className="mt-2 text-[11px] text-slate-400">
        {item.status === 'fallback' ? `Fallback: ${item.source_scope}, ${item.source_sector}` : item.status}
        {item.moe_pp != null ? ` · ±${item.moe_pp} pp` : ''}
      </p>
    </div>
  )
}

function BenchmarkValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f8f5] p-3">
      <p className="text-[11px] leading-4 text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  )
}

function MetricCard({ label, value, note, accent }: { label: string; value: string; note: string; accent: 'green' | 'blue' | 'sand' }) {
  const colors = {
    green: 'bg-[#eaf2df] text-[#54733a]',
    blue: 'bg-[#e9f1f0] text-[#38675f]',
    sand: 'bg-[#f7f1df] text-[#846a2e]',
  }
  return (
    <article className="panel-card !p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${colors[accent]}`}>Summary</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </article>
  )
}

function MetadataValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-slate-800">{value}</dd>
    </div>
  )
}

function BrandMark() {
  return <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c4e394] text-sm font-black text-[#19392f]">S</span>
}

function money(value: number) {
  return `KSh ${Number(value).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export default App
