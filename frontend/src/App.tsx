import { useEffect, useState } from 'react'
import {
  api,
  ApiError,
  type Analysis,
  type BusinessResearch,
  type BusinessIdea,
  type BusinessIdeaInput,
  type ConstraintIndicator,
  type ModelMetadata,
  type UserRole,
} from './api'
import { buildDecisionGuidance, type DecisionGuidance } from './decisionSupport'

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

const workspacePages = [
  { id: 'overview', number: '01', label: 'Overview' },
  { id: 'opportunities', number: '02', label: 'My opportunities' },
  { id: 'assessments', number: '03', label: 'Assessments' },
  { id: 'support', number: '04', label: 'AI support' },
  { id: 'report', number: '05', label: 'Final report' },
] as const

type WorkspacePage = typeof workspacePages[number]['id']

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('saki-token'))
  const [role, setRole] = useState<UserRole>(() => sessionStorage.getItem('saki-role') === 'ADMIN' ? 'ADMIN' : 'USER')
  const [email, setEmail] = useState(() => sessionStorage.getItem('saki-email') ?? '')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [ideas, setIdeas] = useState<BusinessIdea[]>([])
  const [form, setForm] = useState<BusinessIdeaInput>(initialIdea)
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null)
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)
  const [activeResearch, setActiveResearch] = useState<BusinessResearch | null>(null)
  const [workspacePage, setWorkspacePage] = useState<WorkspacePage>('overview')
  const [modelMetadata, setModelMetadata] = useState<ModelMetadata | null>(null)
  const [modelError, setModelError] = useState('')
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
    if (!token || role !== 'ADMIN') return

    let cancelled = false
    api.currentModel(token)
      .then((metadata) => {
        if (!cancelled) setModelMetadata(metadata)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setModelError(messageFor(cause))
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
      setModelMetadata(null)
      setModelError('')
      setPassword('')
      setAuthOpen(false)
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  function navigateTo(page: WorkspacePage) {
    setWorkspacePage(page)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectOpportunity(idea: BusinessIdea) {
    setActiveIdeaId(idea.id)
    if (activeAnalysis?.ideaId !== idea.id) {
      setActiveAnalysis(null)
      setActiveResearch(null)
    }
  }

  function signOut() {
    sessionStorage.removeItem('saki-token')
    sessionStorage.removeItem('saki-email')
    sessionStorage.removeItem('saki-role')
    setToken(null)
    setRole('USER')
    setModelMetadata(null)
    setModelError('')
    setEmail('')
    setIdeas([])
    setActiveAnalysis(null)
    setActiveIdeaId(null)
    setActiveResearch(null)
    setWorkspacePage('overview')
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
      setActiveResearch(null)
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
    setActiveAnalysis(null)
    setActiveResearch(null)
    navigateTo('assessments')
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
    setActiveAnalysis(null)
    setActiveResearch(null)
    navigateTo('assessments')
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
        setActiveResearch(null)
      }
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  function openAuth(registering: boolean) {
    setIsRegistering(registering)
    setError('')
    setAuthOpen(true)
  }

  if (!token) {
    return (
      <>
        <LandingPage onSignIn={() => openAuth(false)} onRegister={() => openAuth(true)} />
        {authOpen && (
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
            onClose={() => setAuthOpen(false)}
            onSubmit={submitAuth}
          />
        )}
      </>
    )
  }

  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId)
  const activePageLabel = workspacePages.find((page) => page.id === workspacePage)?.label ?? 'Overview'

  return (
    <div className="min-h-screen bg-[#f0f3e9] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
          <button className="mb-12 flex items-center gap-3 text-left" onClick={() => navigateTo('overview')} aria-label="SAKI AI overview">
            <BrandMark />
            <span className="text-xl font-extrabold tracking-tight text-[#18372e]">SAKI<span className="text-[#80a944]">AI</span></span>
          </button>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <nav aria-label="Workspace pages" className="space-y-1">
            {workspacePages.map((page) => (
              <button
                key={page.id}
                aria-current={workspacePage === page.id ? 'page' : undefined}
                className={`nav-link w-full text-left ${workspacePage === page.id ? 'nav-link-active' : ''}`}
                onClick={() => navigateTo(page.id)}
              >
                <span>{page.number}</span> {page.label}
              </button>
            ))}
          </nav>
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
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718a54]">SAKI AI workspace</p>
              <h1 className="mt-1 text-xl font-bold text-[#19392f]">{activePageLabel}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:block">{email}</span>
              <button className="button-secondary !px-4 !py-2 text-sm" onClick={signOut}>Sign out</button>
            </div>
          </header>

          <nav aria-label="Workspace pages" className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {workspacePages.map((page) => (
              <button
                key={page.id}
                aria-current={workspacePage === page.id ? 'page' : undefined}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${workspacePage === page.id ? 'border-[#19392f] bg-[#19392f] text-white' : 'border-[#dce4d6] bg-white text-slate-600'}`}
                onClick={() => navigateTo(page.id)}
              >
                {page.number} · {page.label}
              </button>
            ))}
          </nav>

          {error && (
            <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>{error}</span>
              <button aria-label="Dismiss error" className="font-bold" onClick={() => setError('')}>×</button>
            </div>
          )}

          {workspacePage === 'overview' && (
            <>
          <section id="overview" className="mb-7 overflow-hidden rounded-[28px] bg-[#19392f] px-6 py-7 text-white sm:px-9 sm:py-9">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#c5df9a]">Make the next move clearer</p>
                <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Turn your business idea into an evidence-led plan.</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">Compare your proposal with Nairobi business benchmarks and see the constraints reported by established firms.</p>
              </div>
              <button onClick={() => navigateTo('opportunities')} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#c4e394] px-5 py-3 text-sm font-bold text-[#1b352d] transition hover:bg-[#d2efa2]">
                <span className="text-lg leading-none">+</span> Assess an idea
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">KNBS · Nairobi MSME Survey 2016</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">World Bank Enterprise Surveys · Kenya 2025</span>
            </div>
          </section>

          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Your opportunities" value={ideas.length.toString()} note="Ideas saved to your account" accent="green" />
            <MetricCard label="Assessment evidence" value={activeAnalysis ? 'Ready' : 'On demand'} note="Generated from the current data sources" accent="blue" />
            <MetricCard label="Market context" value="Secondary data" note="Historical KNBS activity and WBES sector evidence" accent="sand" />
          </div>
            </>
          )}

          {workspacePage === 'opportunities' && (
            <>
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
                          <button className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => selectOpportunity(idea)}>Select</button>
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
          {activeIdea && (
            <div className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-[#dce6d4] bg-[#f7faf3] p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Selected opportunity</p>
                <p className="mt-1 font-bold text-[#19392f]">{activeIdea.name}</p>
                <p className="mt-1 text-xs text-slate-500">Continue to the survey-based assessment when you are ready.</p>
              </div>
              <button className="button-primary w-fit" onClick={() => navigateTo('assessments')}>Proceed to assessments <span aria-hidden="true" className="ml-2">→</span></button>
            </div>
          )}
            </>
          )}

          {workspacePage === 'assessments' && (
            <section id="assessment" className="mt-6 space-y-5">
            {activeAnalysis ? (
              <>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="section-eyebrow">03 / Survey-based assessment</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{activeIdea?.name ?? 'Business idea'}</h2>
                    <p className="mt-2 text-sm text-slate-500">Review the model estimate, historical sector benchmark, and reported constraints before checking current online context.</p>
                  </div>
                  {activeIdea && <button className="button-secondary" disabled={busy} onClick={() => runAnalysis(activeIdea)}>{busy ? 'Assessing…' : 'Run assessment again'}</button>}
                </div>
                <DecisionSupportPanel analysis={activeAnalysis} idea={activeIdea} />
                <div className="flex flex-col gap-3 rounded-2xl border border-[#dce6d4] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-[#19392f]">Add current business-specific context</p>
                    <p className="mt-1 text-sm text-slate-500">Search for recent information relevant to this business type in Kenya.</p>
                  </div>
                  <button className="button-primary w-fit" onClick={() => navigateTo('support')}>Proceed to AI support <span aria-hidden="true" className="ml-2">→</span></button>
                </div>
              </>
            ) : (
              <div className="panel-card flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="section-eyebrow">03 / Evidence-based assessment</p>
                  <h2 className="section-title">{activeIdea ? `Ready to assess ${activeIdea.name}` : 'Choose an opportunity to assess'}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Results show the revenue-tier estimate, historical sector benchmarks, and reported operating constraints separately. They do not predict business success.</p>
                </div>
                {activeIdea ? (
                  <button className="button-primary shrink-0" disabled={busy} onClick={() => runAnalysis(activeIdea)}>{busy ? 'Assessing…' : 'Run survey assessment'}</button>
                ) : <button className="button-secondary shrink-0" onClick={() => navigateTo('opportunities')}>Choose an opportunity</button>}
              </div>
            )}
          </section>
          )}

          {workspacePage === 'support' && (
            <section className="mt-6">
              {activeIdea && activeAnalysis ? (
                <>
                  <div className="mb-5">
                    <p className="section-eyebrow">04 / Current online context</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Research support for {activeIdea.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Search results provide timely context to consider alongside the survey evidence. They are not verified findings or an AI-generated synthesis.</p>
                  </div>
                  <CurrentResearchPanel
                    key={activeAnalysis.id}
                    token={token}
                    ideaId={activeAnalysis.ideaId}
                    businessName={activeIdea.name}
                    sector={activeIdea.sectorGroup}
                    research={activeResearch}
                    onResearchChange={setActiveResearch}
                  />
                  <div className="mt-5 flex justify-end">
                    <button className="button-primary" onClick={() => navigateTo('report')}>Continue to final report <span aria-hidden="true" className="ml-2">→</span></button>
                  </div>
                </>
              ) : (
                <div className="panel-card">
                  <p className="section-eyebrow">04 / AI support</p>
                  <h2 className="section-title">Run a survey assessment first</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Current online research is tied to a selected, assessed opportunity.</p>
                  <button className="button-primary mt-5" onClick={() => navigateTo(activeIdea ? 'assessments' : 'opportunities')}>{activeIdea ? 'Go to assessments' : 'Choose an opportunity'}</button>
                </div>
              )}
            </section>
          )}

          {workspacePage === 'report' && (
            <section className="mt-6">
              {activeAnalysis ? (
                <AnalysisPanel analysis={activeAnalysis} idea={activeIdea} research={activeResearch} />
              ) : (
                <div className="panel-card">
                  <p className="section-eyebrow">05 / Final report</p>
                  <h2 className="section-title">Complete an assessment to build your report</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">The final report combines survey-grounded advice with any online research you choose to run.</p>
                  <button className="button-primary mt-5" onClick={() => navigateTo(activeIdea ? 'assessments' : 'opportunities')}>{activeIdea ? 'Go to assessments' : 'Choose an opportunity'}</button>
                </div>
              )}
            </section>
          )}

          {role === 'ADMIN' && workspacePage === 'overview' && (
            <section id="admin-model" className="panel-card mt-6" aria-labelledby="admin-model-heading">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="section-eyebrow">Administrator / Model oversight</p>
                  <h2 id="admin-model-heading" className="section-title">Current model metadata</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This reports the deployed model and its evaluation results. Only one evaluated model is currently available; this page does not switch or activate versions.</p>
                </div>
                {modelMetadata && <span className="w-fit rounded-full bg-[#eaf2df] px-3 py-1.5 text-xs font-semibold text-[#4f703e]">Version {modelMetadata.version}</span>}
              </div>
              {!modelMetadata && !modelError && <p className="mt-5 text-sm text-slate-500">Loading model metadata…</p>}
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

type BusinessPhoto = {
  category: 'Food & produce' | 'Market & crafts'
  image: string
  alt: string
  title: string
  location: string
  author: string
  sourceUrl: string
  license: string
  licenseUrl: string
}

const businessPhotos: BusinessPhoto[] = [
  {
    category: 'Food & produce',
    image: '/images/nairobi-produce-stall.jpg',
    alt: 'A Nairobi-area fruit and vegetable stall stocked with fresh produce',
    title: 'Fresh produce stall',
    location: 'Nairobi outskirts',
    author: 'Terryngari',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_vegetable_stall_in_the_outskirts_of_Nairobi,_Kenya._Showcasing_a_variety_of_fruits.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    category: 'Market & crafts',
    image: '/images/nairobi-market-stand.jpg',
    alt: 'A Nairobi Maasai market stall selling crafts and clothing',
    title: 'Maasai market stall',
    location: 'Nairobi',
    author: 'Sdkb',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nairobi_Maasai_Market_stand.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    category: 'Market & crafts',
    image: '/images/village-market-crafts.jpg',
    alt: 'Clothing, accessories, and craft stalls at Village Market in Nairobi',
    title: 'Local crafts and textiles',
    location: 'Village Market, Nairobi',
    author: 'BugWarp',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Maasai_Markets_at_the_The_Village_Market_-_BugWarp_01.jpg',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
]

function LandingPage({ onSignIn, onRegister }: { onSignIn: () => void; onRegister: () => void }) {
  const [category, setCategory] = useState<'All businesses' | BusinessPhoto['category']>('All businesses')
  const visiblePhotos = category === 'All businesses'
    ? businessPhotos
    : businessPhotos.filter((photo) => photo.category === category)

  return (
    <main id="top" className="min-h-screen bg-[#f7f4e9] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#e6e8dc] bg-[#f7f4e9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <a className="flex shrink-0 items-center gap-3" href="#top" aria-label="SAKI AI home">
            <BrandMark />
            <span className="text-lg font-extrabold tracking-tight text-[#18372e]">SAKI<span className="text-[#80a944]"> AI</span></span>
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a className="transition hover:text-[#19392f]" href="#evidence">Our evidence</a>
            <a className="transition hover:text-[#19392f]" href="#businesses">Nairobi businesses</a>
            <a className="transition hover:text-[#19392f]" href="#how-it-works">How it works</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="rounded-xl px-3 py-2 text-sm font-bold text-[#264b3e] transition hover:bg-[#eaf0e2]" onClick={onSignIn}>Sign in</button>
            <button className="button-primary !min-h-10 !px-4 !py-2 text-xs sm:text-sm" onClick={onRegister}>Get started</button>
          </div>
        </div>
      </header>

      <section className="overflow-hidden bg-[#e9f0e2]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="relative z-10">
            <p className="mb-5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#6e8d4a]">
              <span className="h-2 w-2 rounded-full bg-[#82a849]" />
              Built around Nairobi enterprise data
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#18372e] sm:text-5xl lg:text-6xl">
              See your business idea in its local context.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#56665d] sm:text-lg sm:leading-8">
              SAKI AI helps you compare a business idea with Nairobi enterprise benchmarks and the operating constraints firms report in Kenya.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="button-primary !px-6 !py-3" onClick={onRegister}>Explore your idea <span aria-hidden="true" className="ml-2">→</span></button>
              <a className="button-secondary !min-h-[45px] !px-5 !py-3 text-sm" href="#evidence">See the evidence</a>
            </div>
            <p className="mt-6 text-xs leading-5 text-slate-500">Decision support for planning—not a promise of demand, profit, or business success.</p>
          </div>

          <div className="relative mx-auto h-[390px] w-full max-w-xl sm:h-[480px]" aria-label="Photos of Nairobi market businesses">
            <div className="absolute inset-y-4 right-0 w-[78%] overflow-hidden rounded-[28px] shadow-xl shadow-[#293c2e]/15">
              <img className="h-full w-full object-cover object-center" src="/images/nairobi-produce-stall.jpg" alt="Fruit and vegetable stall in the Nairobi area" fetchPriority="high" />
            </div>
            <div className="absolute bottom-0 left-0 h-48 w-[48%] overflow-hidden rounded-[22px] border-[6px] border-[#e9f0e2] shadow-lg sm:h-56">
              <img className="h-full w-full object-cover object-center" src="/images/nairobi-market-stand.jpg" alt="Craft and clothing stall at a Nairobi market" />
            </div>
            <div className="absolute left-2 top-7 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg sm:left-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#82975f]">Local enterprise</p>
              <p className="mt-1 text-sm font-bold text-[#19392f]">Nairobi, Kenya</p>
            </div>
            <p className="absolute bottom-3 right-2 max-w-[46%] text-right text-[10px] leading-4 text-slate-600 sm:bottom-7 sm:right-3">
              Illustrative market scenes · photo credits below
            </p>
          </div>
        </div>
      </section>

      <section id="evidence" className="scroll-mt-24 bg-[#19392f] text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c5df9a]">The survey foundation</p>
              <p className="mt-3 text-5xl font-semibold tracking-tight sm:text-6xl">1,546</p>
              <p className="mt-2 text-sm leading-6 text-white/75">cleaned Nairobi establishment records in the KNBS MSME Survey 2016 dataset</p>
            </div>
            <div className="border-white/15 sm:border-l sm:pl-12">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c5df9a]">The model sample</p>
              <p className="mt-3 text-5xl font-semibold tracking-tight sm:text-6xl">973</p>
              <p className="mt-2 text-sm leading-6 text-white/75">records used to train the historical revenue-tier model after eligibility checks</p>
            </div>
          </div>
          <p className="mt-8 border-t border-white/15 pt-5 text-xs leading-5 text-white/55">
            These are survey and training-record counts—not today’s active business count or a count of SAKI AI user assessments. The revenue model estimates historical revenue tiers; it does not predict business success.
          </p>
        </div>
      </section>

      <section id="businesses" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="section-eyebrow">From the streets and markets</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#18372e] sm:text-4xl">Local businesses. Local context.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              A glimpse of the independent trade and market activity behind Nairobi’s enterprise landscape.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter business photos">
            {(['All businesses', 'Food & produce', 'Market & crafts'] as const).map((filter) => (
              <button
                key={filter}
                aria-pressed={category === filter}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                  category === filter
                    ? 'border-[#19392f] bg-[#19392f] text-white'
                    : 'border-[#dfe5da] bg-white text-slate-600 hover:border-[#9cac8d] hover:text-[#19392f]'
                }`}
                onClick={() => setCategory(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visiblePhotos.map((photo) => (
            <figure key={photo.image} className="overflow-hidden rounded-[22px] border border-[#e5e9e1] bg-white shadow-sm">
              <img className="h-64 w-full object-cover" src={photo.image} alt={photo.alt} loading="lazy" />
              <figcaption className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#82975f]">{photo.category}</p>
                <h3 className="mt-2 text-lg font-bold text-[#19392f]">{photo.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{photo.location}</p>
                <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500">
                  Photo by <a className="font-semibold text-[#416849] underline underline-offset-2" href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.author}</a>
                  {' · '}
                  <a className="font-semibold text-[#416849] underline underline-offset-2" href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-[#edf1e7]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="section-eyebrow">A clearer starting point</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#18372e] sm:text-4xl">Turn a rough idea into a grounded comparison.</h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              { number: '01', title: 'Describe your idea', text: 'Choose a business sector, Nairobi area, premises type, and basic startup details.' },
              { number: '02', title: 'Review historical context', text: 'See revenue-tier estimates and sector benchmarks based on the KNBS Nairobi MSME Survey.' },
              { number: '03', title: 'Consider reported constraints', text: 'Review operating challenges and competition indicators from World Bank Enterprise Surveys.' },
            ].map((step) => (
              <article key={step.number} className="rounded-[20px] border border-[#e0e6dc] bg-white p-6">
                <p className="text-xs font-extrabold tracking-[0.12em] text-[#82975f]">{step.number}</p>
                <h3 className="mt-4 text-lg font-bold text-[#19392f]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-between gap-5 rounded-[22px] bg-[#19392f] p-6 text-white sm:flex-row sm:items-center sm:p-8">
            <div>
              <h3 className="text-xl font-bold">Start exploring your business idea.</h3>
              <p className="mt-2 text-sm text-white/65">Create a workspace to save ideas and review assessments.</p>
            </div>
            <button className="button-primary w-fit !bg-[#c4e394] !px-5 !py-3 !text-[#1b352d] hover:!bg-[#d2efa2]" onClick={onRegister}>Create your workspace <span aria-hidden="true" className="ml-2">→</span></button>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <a className="font-extrabold text-[#19392f]" href="#top">SAKI AI</a>
        <p>KNBS Nairobi MSME Survey 2016 · World Bank Enterprise Surveys Kenya 2025</p>
        <p>Planning support, not a guarantee of success.</p>
      </footer>
    </main>
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
  onClose,
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
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#10231d]/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        className="relative mx-auto my-6 grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-[#fbfaf5] shadow-2xl shadow-slate-950/25 md:grid-cols-[1.05fr_0.95fr]"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="absolute right-4 top-4 z-50 rounded-full bg-white/90 px-3 py-1 text-xl leading-7 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900" type="button" aria-label="Close dialog" onClick={onClose}>×</button>
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
        <section className="p-7 pt-14 sm:p-10 sm:pt-12">
          <p className="section-eyebrow">{isRegistering ? 'Create workspace' : 'Welcome back'}</p>
          <h2 id="auth-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{isRegistering ? 'Create your account' : 'Sign in to SAKI AI'}</h2>
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
    </div>
  )
}

function AnalysisPanel({ analysis, idea, research }: { analysis: Analysis; idea: BusinessIdea | undefined; research: BusinessResearch | null }) {
  const { revenuePrediction, benchmark, constraints, assessmentNotes } = analysis.result
  const indicators = [...constraints.indicators].sort((a, b) => (b.risk_share ?? -1) - (a.risk_share ?? -1))
  const obstacles = indicators.filter((item) => item.family === 'obstacle')
  const competition = indicators.filter((item) => item.family === 'competition')

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="section-eyebrow">Final report · assessment from {new Date(analysis.createdAt).toLocaleDateString()}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{idea?.name ?? 'Business idea'}</h2>
        </div>
        <span className="w-fit rounded-full bg-[#eaf2df] px-3 py-1.5 text-xs font-semibold text-[#4f703e]">Summary first · evidence below</span>
      </div>

      <CombinedReportSummary analysis={analysis} idea={idea} research={research} />

      <details className="group">
        <summary className="panel-card flex cursor-pointer list-none items-center justify-between gap-4 transition hover:border-[#cbd7c0]">
          <div>
            <p className="section-eyebrow">Supporting evidence</p>
            <p className="mt-1 text-sm font-bold text-slate-800">View detailed estimates, probabilities, and data sources</p>
            <p className="mt-1 text-xs text-slate-500">Expand for the underlying figures and reported indicators.</p>
          </div>
          <span aria-hidden="true" className="shrink-0 rounded-full bg-[#edf2e7] px-3 py-1.5 text-lg text-[#416849] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="panel-card">
              <p className="section-eyebrow">Revenue-tier estimate</p>
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
              <p className="mt-4 rounded-xl bg-[#f7f8f5] p-3 text-xs leading-5 text-slate-500">{revenuePrediction.limitation} Startup capital is not inflation-adjusted against the 2016 training records.</p>
            </article>

            <article className="panel-card">
              <p className="section-eyebrow">Historical sector benchmark</p>
              <h3 className="mt-1 text-lg font-bold text-slate-800">{benchmark.sector_group}</h3>
              <p className="mt-1 text-xs text-slate-500">Historical sample · {benchmark.n_establishments} eligible establishments</p>
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
                <p className="section-eyebrow">Reported operating constraints</p>
                <h3 className="section-title">Sector operating constraints</h3>
              </div>
              <span className="text-xs text-slate-400">Share of surveyed firms reporting the issue</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {obstacles.slice(0, 6).map((item) => <EvidenceIndicatorCard key={item.indicator} item={item} />)}
            </div>
            {obstacles.length === 0 && <p className="mt-4 text-sm text-slate-500">No constraint observations are available for this sector.</p>}
          </article>

          <article className="panel-card">
            <p className="section-eyebrow">Competition indicators</p>
            <h3 className="section-title">Competition indicators</h3>
            <p className="mt-1 text-xs text-slate-400">Firm-reported competition context, not a count of competitors in the proposed location.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {competition.map((item) => <EvidenceIndicatorCard key={item.indicator} item={item} />)}
            </div>
            {competition.length === 0 && <p className="mt-4 text-sm text-slate-500">No competition observations are available for this sector.</p>}
          </article>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="panel-card">
              <p className="section-eyebrow">Demand-related historical context</p>
              <h3 className="section-title">Observed sector business activity</h3>
              <p className="mt-1 text-xs text-slate-400">Historical sample · {benchmark.n_establishments} eligible establishments</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <BenchmarkValue label="Median monthly revenue" value={money(benchmark.median_monthly_revenue_ksh)} />
                <BenchmarkValue label="Businesses in high revenue tier" value={`${benchmark.pct_high}%`} />
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">Historical sector activity is a demand-related indicator, not direct customer demand or a forecast of this idea’s sales.</p>
            </article>
            <article className="panel-card">
              <p className="section-eyebrow">Resource planning context</p>
              <h3 className="section-title">Compare with historical sector medians</h3>
              {idea ? (
                <div className="mt-4 grid gap-3">
                  <BenchmarkValue label="Your proposed startup capital" value={money(idea.initialCapitalKsh)} />
                  <BenchmarkValue label="2016 sector median startup capital" value={money(benchmark.median_initial_capital_ksh)} />
                  <BenchmarkValue label="Your planned founding employees" value={idea.foundingEmployees.toLocaleString()} />
                  <BenchmarkValue label="Sector median founding employees" value={benchmark.median_founding_employees.toLocaleString()} />
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">Business profile details are unavailable for this comparison.</p>}
              <p className="mt-4 text-xs leading-5 text-slate-500">These are descriptive 2016 values in nominal KSh, not inflation-adjusted budgets or staffing recommendations.</p>
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
      </details>
    </div>
  )
}

function CombinedReportSummary({
  analysis,
  idea,
  research,
}: {
  analysis: Analysis
  idea: BusinessIdea | undefined
  research: BusinessResearch | null
}) {
  const guidance = buildDecisionGuidance(analysis, idea)
  const onlineActions = (research?.keySignals ?? []).slice(0, 4).map(researchAction)

  return (
    <article className="overflow-hidden rounded-[24px] border border-[#dce6d4] bg-white shadow-sm">
      <header className="bg-[#19392f] px-5 py-5 text-white sm:px-7 sm:py-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c5df9a]">Integrated decision report</p>
        <h3 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">What the evidence means for {idea?.name ?? 'this opportunity'}</h3>
        <p className="mt-2 text-sm leading-6 text-white/75">A practical summary combining historical survey constraints with current, business-focused web and Reddit results.</p>
      </header>

      <div className="space-y-6 p-5 sm:p-7">
        <section className="rounded-2xl bg-[#f5f7f1] p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Bottom line</p>
          <p className="mt-2 text-base font-semibold leading-7 text-[#19392f]">{guidance.overallSummary}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{guidance.decisionRule}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">The survey uses historical KSh values that are not inflation-adjusted, so it cannot confirm whether today’s available capital is enough. Price the current launch and early operating costs before committing.</p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#e3e9de] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Survey evidence</p>
            <h4 className="mt-2 text-lg font-bold text-[#19392f]">The sector risk to investigate first</h4>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {guidance.topObstacle
                ? `The strongest available survey signal is ${guidance.topObstacle.title.toLowerCase()}. This is a sector-level report from existing firms, not a prediction that your business will face the same issue.`
                : 'No ranked survey obstacle is available for this comparison. Identify the main operating risk for this business and price a practical response.'}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{guidance.obstacleAction}</p>
            {guidance.topCompetition && (
              <p className="mt-3 text-sm leading-6 text-slate-600">The survey also flags {guidance.topCompetition.title.toLowerCase()}; compare current nearby offers rather than treating this as a local competitor count.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#e3e9de] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Current web and Reddit research</p>
            {!research ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">Search has not been run, so this report currently relies on the survey evidence and your opportunity details only.</p>
            ) : research.results.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">The search found no results that matched both this idea’s name or recognized business type and a relevant operating issue. This is not evidence that no risks exist.</p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Search results mention {research.keySignals.length ? research.keySignals.join(', ').toLowerCase() : 'related operating conditions'}.
                  {' '}Treat these as current issues to verify, not confirmed facts about this specific opportunity.
                </p>
                <ul className="mt-4 space-y-3">
                  {research.results.slice(0, 3).map((result) => (
                    <li key={result.url} className="rounded-xl bg-[#f7f8f5] p-3">
                      <a className="text-sm font-bold text-[#416849] underline decoration-[#b9c9a7] underline-offset-2 hover:text-[#19392f]" href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{result.snippet}</p>
                      <p className="mt-2 text-[10px] text-slate-500">{result.matchedTopics.join(' · ')}{result.publishedDate ? ` · ${result.publishedDate}` : ''}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <section className="border-t border-slate-100 pt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Recommended checks before opening</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              guidance.obstacleAction,
              ...onlineActions,
              ...guidance.budgetFocus.slice(0, 2),
              guidance.localCheck,
            ].map((action) => (
              <li key={action} className="flex gap-2 rounded-xl bg-[#f7f8f5] p-3 text-sm leading-5 text-slate-700">
                <span aria-hidden="true" className="text-[#779955]">•</span><span>{action}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Online snippets are keyword-matched, may include anecdotal posts, and are not independently verified. Confirm important claims with current official guidance and local quotes. Search findings do not alter the historical model estimate.
        </p>
      </div>
    </article>
  )
}

function researchAction(signal: string) {
  const topic = signal.toLowerCase()
  if (topic.includes('tax') || topic.includes('fee')) return 'Confirm current KRA and county fees from official schedules; include only documented charges in the budget.'
  if (topic.includes('crime') || topic.includes('security')) return 'Check the proposed site’s security and price protection for cash, equipment, and stock.'
  if (topic.includes('corruption') || topic.includes('bribery')) return 'Verify requirements through official channels and request receipts for every required payment.'
  if (topic.includes('competition')) return 'Compare nearby prices, opening hours, and customer offers, then define how this business will stand out.'
  if (topic.includes('infrastructure') || topic.includes('utility')) return 'Confirm power, water, road, and service capacity at the actual site, including connection and backup costs.'
  if (topic.includes('land') || topic.includes('lease') || topic.includes('permit')) return 'Verify permitted use, lease terms, land documentation, and required permits before signing.'
  if (topic.includes('tenant') || topic.includes('investment')) return 'Validate occupancy and tenant demand with prospective customers before relying on development projections.'
  return `Verify the reported ${signal.toLowerCase()} issue with current official sources and local supplier or customer checks.`
}

function DecisionSupportPanel({ analysis, idea, research }: { analysis: Analysis; idea: BusinessIdea | undefined; research?: BusinessResearch | null }) {
  const guidance = buildDecisionGuidance(analysis, idea)

  return (
    <article className="overflow-hidden rounded-[24px] border border-[#dce6d4] bg-white shadow-sm">
      <header className="bg-[#19392f] px-5 py-5 text-white sm:px-7 sm:py-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c5df9a]">Decision support</p>
        <h3 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{idea?.name || 'Business idea'} · numbers and actions</h3>
        <p className="mt-2 text-sm text-white/75">Key figures and tailored checks, with the final recommendation below.</p>
      </header>

      <div className="grid divide-y divide-[#e7ebe3] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section className="p-5 sm:p-6">
          <h4 className="text-sm font-bold text-[#19392f]">Key numbers</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-[#e3e9de] bg-[#fbfcf9] p-4">
              <p className="text-xs font-semibold text-slate-500">Estimated revenue tier</p>
              <p className="mt-1 text-2xl font-bold text-[#19392f]">{guidance.predictedTier}</p>
              <div className="mt-3 space-y-2">
                {guidance.probabilities.map((entry) => (
                  <div key={entry.tier}>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-600">
                      <span>{entry.tier}</span><span>{Math.round(entry.share * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${entry.tier === guidance.predictedTier ? 'bg-[#71964d]' : 'bg-slate-400'}`} style={{ width: `${Math.min(entry.share * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">Revenue-tier estimates, not success odds.</p>
            </article>

            <article className="rounded-2xl border border-[#e3e9de] bg-[#fbfcf9] p-4">
              <p className="text-xs font-semibold text-slate-500">Startup capital</p>
              <dl className="mt-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-xs text-slate-500">Proposed</dt>
                  <dd className="text-right text-sm font-bold text-slate-800">{guidance.proposedCapital}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-xs text-slate-500">Historical median</dt>
                  <dd className="text-right text-sm font-bold text-slate-800">{guidance.historicalCapital}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">{guidance.capitalNote}</p>
            </article>

            <article className="rounded-2xl border border-[#e3e9de] bg-[#fbfcf9] p-4">
              <p className="text-xs font-semibold text-slate-500">Sector reference</p>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-2 text-xs"><dt className="text-slate-500">Median monthly revenue</dt><dd className="text-right font-bold text-slate-800">{guidance.medianRevenue}</dd></div>
                <div className="flex justify-between gap-2 text-xs"><dt className="text-slate-500">Middle 50% range</dt><dd className="text-right font-bold text-slate-800">{guidance.revenueRange}</dd></div>
                <div className="flex justify-between gap-2 text-xs"><dt className="text-slate-500">High-tier share</dt><dd className="text-right font-bold text-slate-800">{guidance.highTierShare}</dd></div>
                <div className="flex justify-between gap-2 text-xs"><dt className="text-slate-500">Sample</dt><dd className="text-right font-bold text-slate-800">{guidance.sampleSize}</dd></div>
              </dl>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">{guidance.sampleQuality} · historical values</p>
            </article>

            <ReportedFindingCard title="Top reported obstacle" finding={guidance.topObstacle} />
            <ReportedFindingCard title="Competition indicator" finding={guidance.topCompetition} />
          </div>
        </section>

        <section className="bg-[#f5f7f1] p-5 sm:p-6">
          <h4 className="text-sm font-bold text-[#19392f]">What to focus on for this idea</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {guidance.profile.map((item) => <span key={item} className="rounded-full border border-[#dfe6d8] bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">{item}</span>)}
          </div>
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Top issue to investigate</p>
            <p className="mt-1 text-sm leading-5 text-slate-700">{guidance.obstacleAction}</p>
          </div>
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Costs to price for this sector and premises</p>
            <ul className="mt-2 space-y-2">
              {guidance.budgetFocus.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-slate-600">
                  <span aria-hidden="true" className="text-[#779955]">•</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-5 rounded-xl border border-[#e1e7db] bg-white px-4 py-3 text-xs leading-5 text-slate-600">{guidance.localCheck}</p>
          {research ? (
            <div className="mt-4 rounded-xl border border-[#dfe6d8] bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Current online checks</p>
              {research.keySignals.length > 0 ? (
                <p className="mt-1 text-xs leading-5 text-slate-600">Recent search results flagged {research.keySignals.join(', ')}. Verify these against current official guidance and local supplier or customer checks before changing your plan.</p>
              ) : (
                <p className="mt-1 text-xs leading-5 text-slate-600">No matching online themes were found. This does not rule out current risks; validate locally.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-[#dfe6d8] bg-white px-4 py-3 text-xs leading-5 text-slate-600">Online research has not been run. This recommendation is based on the survey evidence and your opportunity details only.</p>
          )}
        </section>
      </div>

      <footer className="bg-[#19392f] px-5 py-5 text-white sm:px-7 sm:py-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c5df9a]">Bottom line</p>
        <p className="mt-2 text-sm font-semibold leading-6">{guidance.overallSummary}</p>
        <p className="mt-2 text-sm leading-6 text-white/75">{guidance.decisionRule}</p>
        {research?.keySignals.length ? <p className="mt-2 text-sm leading-6 text-white/75">Before proceeding, validate the online themes ({research.keySignals.join(', ')}) with current authoritative sources and local checks.</p> : null}
        <p className="mt-4 border-t border-white/15 pt-3 text-[11px] leading-5 text-white/60">{guidance.sourcesNote} The output is decision support, not a guarantee or a success probability.</p>
      </footer>
    </article>
  )
}

function ReportedFindingCard({ title, finding }: { title: string; finding: DecisionGuidance['topObstacle'] }) {
  return (
    <article className="rounded-2xl border border-[#e3e9de] bg-[#fbfcf9] p-4">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      {finding ? (
        <>
          <p className="mt-2 text-sm font-bold text-[#19392f]">{finding.title}</p>
          <p className="mt-1 text-xs text-slate-600">About {Math.round(finding.share)}% of firms reported it{finding.margin == null ? '' : ` · ±${finding.margin} percentage points`}.</p>
          {finding.fallbackNote && <p className="mt-2 text-[11px] text-slate-500">{finding.fallbackNote}</p>}
        </>
      ) : <p className="mt-2 text-xs leading-5 text-slate-500">No ranked indicator is available; local risk may still exist.</p>}
    </article>
  )
}

function CurrentResearchPanel({
  token,
  ideaId,
  businessName,
  sector,
  research,
  onResearchChange,
}: {
  token: string | null
  ideaId: string
  businessName: string
  sector: string
  research: BusinessResearch | null
  onResearchChange: (value: BusinessResearch | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadResearch() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      onResearchChange(await api.research(token, ideaId))
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#dce6d4] bg-white shadow-sm">
      <div className="flex flex-col gap-4 bg-[#f5f7f1] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718a54]">{businessName} · {research?.businessType ?? sector}</p>
          <h3 className="mt-1 text-lg font-bold text-[#19392f]">Check current conditions in Kenya</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Searches for problems facing “{businessName}” in Kenya, including taxes, security, corruption, competition, and business-specific issues, plus a separate Reddit-focused search. Only results mentioning the idea name or a recognized business type and a relevant issue are shown. Your idea name, inferred business type, and issue terms are sent to Tavily; exact area, capital, contact details, and survey/model results are not. Each run uses up to two basic-search credits.</p>
        </div>
        <button
          className="shrink-0 rounded-xl bg-[#19392f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#285444] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!token || loading}
          onClick={loadResearch}
        >
          {loading ? 'Searching…' : research ? 'Refresh web + Reddit search' : 'Search web + Reddit'}
        </button>
      </div>

      {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">{error}</p>}

      {research && (
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500">Search results · {research.sector}, {research.geography}</p>
            <p className="text-xs text-slate-500">Retrieved {new Date(research.retrievedAt).toLocaleString()}</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">Search terms: {research.query}</p>
          {research.keySignals.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#718a54]">Relevant themes found</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {research.keySignals.map((signal) => <span key={signal} className="rounded-full border border-[#dfe6d8] bg-[#f5f7f1] px-3 py-1 text-[11px] font-semibold text-slate-600">{signal}</span>)}
              </div>
            </div>
          )}
          {research.results.length > 0 ? (
            <ul className="space-y-3">
              {research.results.map((result) => (
                <li key={result.url} className="rounded-xl border border-[#e7ebe3] bg-[#fbfcf9] p-4">
                  <a className="text-sm font-bold text-[#416849] underline decoration-[#b9c9a7] underline-offset-2 hover:text-[#19392f]" href={result.url} target="_blank" rel="noopener noreferrer">
                    {result.title}
                  </a>
                  {result.publishedDate && <p className="mt-1 text-[11px] text-slate-500">Published/updated {result.publishedDate}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.matchedTopics.map((topic) => <span key={topic} className="rounded-full bg-[#edf2e7] px-2.5 py-1 text-[10px] font-semibold text-[#416849]">{topic}</span>)}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-5 text-slate-600">{result.snippet}</p>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl border border-[#e7ebe3] bg-[#fbfcf9] p-4 text-sm text-slate-600">No recent results matched this idea’s name or recognized business type and its operating issues. Try adding a clear business type to the idea name (for example, “butchery” or “industrial hub”) or search again later.</p>}
          <p className="text-[11px] leading-5 text-slate-500">The result list is filtered and grouped by business-specific keywords, not AI-verified. Forum posts are individual experiences, not verified evidence. Compare them with official sources. These results supplement but do not change the historical estimates or predict this business’s results.</p>
        </div>
      )}
    </section>
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
