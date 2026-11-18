import type { Analysis, BusinessIdea, ConstraintIndicator } from './api'

export interface ReportedFinding {
  title: string
  share: number
  margin?: number
  fallbackNote?: string
}

export interface DecisionGuidance {
  predictedTier: string
  probabilities: Array<{ tier: string; share: number }>
  proposedCapital: string
  historicalCapital: string
  capitalNote: string
  medianRevenue: string
  revenueRange: string
  highTierShare: string
  sampleSize: string
  sampleQuality: string
  topObstacle: ReportedFinding | null
  topCompetition: ReportedFinding | null
  obstacleAction: string
  budgetFocus: string[]
  profile: string[]
  localCheck: string
  overallSummary: string
  decisionRule: string
  sourcesNote: string
}

export function buildDecisionGuidance(analysis: Analysis, idea?: BusinessIdea): DecisionGuidance {
  const { benchmark, constraints, revenuePrediction } = analysis.result
  const sampleSize = Number.isFinite(benchmark.n_establishments)
    ? benchmark.n_establishments.toLocaleString()
    : '—'
  const probabilities = (['Low', 'Medium', 'High'] as const)
    .map((tier) => ({ tier, share: revenuePrediction.probabilities[tier] }))
  const topObstacle = asFinding(highestReported(constraints.indicators, 'obstacle'))
  const topCompetition = asFinding(highestReported(constraints.indicators, 'competition'))
  const place = idea?.location || 'your chosen area'

  return {
    predictedTier: revenuePrediction.predicted_tier,
    probabilities,
    proposedCapital: idea ? money(idea.initialCapitalKsh) : 'Not available',
    historicalCapital: Number.isFinite(benchmark.median_initial_capital_ksh)
      ? money(benchmark.median_initial_capital_ksh)
      : 'Not available',
    capitalNote: `${benchmark.reliable ? 'Sample meets the minimum size.' : 'Small sample; treat as indicative.'} Historical 2016 KSh, not inflation-adjusted or a current cost target.`,
    medianRevenue: Number.isFinite(benchmark.median_monthly_revenue_ksh)
      ? money(benchmark.median_monthly_revenue_ksh)
      : 'Not available',
    revenueRange: Number.isFinite(benchmark.p25_monthly_revenue_ksh) && Number.isFinite(benchmark.p75_monthly_revenue_ksh)
      ? `${money(benchmark.p25_monthly_revenue_ksh)}–${money(benchmark.p75_monthly_revenue_ksh)}`
      : 'Not available',
    highTierShare: Number.isFinite(benchmark.pct_high) ? `${Math.round(benchmark.pct_high)}%` : 'Not available',
    sampleSize,
    sampleQuality: benchmark.reliable ? 'Meets minimum sample' : 'Small sample',
    topObstacle,
    topCompetition,
    obstacleAction: topObstacle
      ? mitigationFor(topObstacle.title)
      : 'No ranked obstacle is available. Identify the main operating risk for this business and price a practical response.',
    budgetFocus: budgetFocus(idea),
    profile: idea
      ? [
          idea.sectorGroup,
          idea.location || 'Area not specified',
          idea.premisesGroup,
          `${idea.foundingEmployees} planned employee${idea.foundingEmployees === 1 ? '' : 's'}`,
          idea.registered ? 'Registered' : 'Not registered',
        ]
      : ['Business profile unavailable'],
    localCheck: `The model does not score neighborhood demand, foot traffic, current rents, or nearby competitor counts. Check current prices and competing offers in ${place}.`,
    overallSummary: topObstacle
      ? `For ${idea?.name || idea?.sectorGroup || 'this idea'}, investigate ${topObstacle.title.toLowerCase()} first. Then compare a current, itemized launch budget with funds you can access.`
      : `For ${idea?.name || idea?.sectorGroup || 'this idea'}, first compare a current, itemized launch budget with funds you can access and identify the main local operating risk.`,
    decisionRule: 'If current quoted startup and early operating costs exceed available funds, raise more capital or reduce the opening scope before committing. If costs are covered, verify the priority risk and local competition before opening. The historical comparison cannot make this decision for you.',
    sourcesNote: 'Data basis: KNBS Nairobi MSME Survey 2016 for historical revenue and resource benchmarks; World Bank Enterprise Surveys Kenya 2025 for reported constraints and competition. Some constraint indicators may use broader fallback samples.',
  }
}

function highestReported(indicators: ConstraintIndicator[], family: string) {
  return indicators
    .filter((item) => item.family === family && typeof item.risk_share === 'number' && Number.isFinite(item.risk_share))
    .sort((a, b) => (b.risk_share ?? -1) - (a.risk_share ?? -1))[0]
}

function asFinding(item: ConstraintIndicator | undefined): ReportedFinding | null {
  if (!item || typeof item.risk_share !== 'number') return null
  const fallbackNote = item.status === 'fallback'
    ? `Broader comparison: ${[item.source_scope, item.source_sector].filter(Boolean).join(' / ') || 'fallback group'}`
    : undefined
  return {
    title: indicatorName(item),
    share: item.risk_share,
    margin: typeof item.moe_pp === 'number' && Number.isFinite(item.moe_pp) ? item.moe_pp : undefined,
    fallbackNote,
  }
}

function indicatorName(item: ConstraintIndicator) {
  return item.indicator.replace(/^(Obstacle: |Competition: )/, '')
}

function mitigationFor(title: string) {
  const issue = title.toLowerCase()
  if (/electric|power|outage/.test(issue)) return 'Price power needs, outage contingencies, and any backup equipment before choosing the site or hours.'
  if (/finance|credit|loan|capital/.test(issue)) return 'Compare financing fees and repayment dates with the business cash cycle before borrowing.'
  if (/tax|licen[cs]|permit|fee|regulat/.test(issue)) return 'Confirm official fees, required licences, and filing dates; include them in the launch budget.'
  if (/crime|theft|security/.test(issue)) return 'Price secure storage and suitable security measures for the premises and stock.'
  if (/transport|road|access/.test(issue)) return 'Price delivery and replenishment routes from suppliers to the proposed location.'
  if (/water/.test(issue)) return 'Check water reliability and the cost of storage or alternative supply.'
  if (/corruption/.test(issue)) return 'Verify requirements through official channels and budget documented fees only.'
  if (/competition|competitor/.test(issue)) return 'Compare nearby prices and offers, then define one specific way this business will stand out.'
  if (/skilled|labor|labour|wage/.test(issue)) return 'Check local worker availability, wages, and payroll obligations before setting staffing costs.'
  if (/land|premis|rent|property/.test(issue)) return 'Verify permitted use, lease terms, deposit, and renewal costs before signing.'
  return `Get current local prices for ${title.toLowerCase()} and write down a practical response before opening.`
}

function budgetFocus(idea?: BusinessIdea) {
  if (!idea) return ['Prepare an itemized current budget for the business and premises.']

  const sector = idea.sectorGroup.toLowerCase()
  const premises = idea.premisesGroup.toLowerCase()
  const items: string[] = []

  if (sector.includes('food')) items.push('Food stock, refrigeration or cooking equipment, hygiene requirements, utilities, and spoilage.')
  else if (sector.includes('manufacturing')) items.push('Machinery, raw materials, power capacity, repairs, and workplace safety.')
  else if (sector.includes('transport')) items.push('Vehicle or equipment, fuel, maintenance, insurance, and operating licences.')
  else if (sector.includes('education') || sector.includes('health')) items.push('Sector licences, qualified staff, equipment, and recurring supplies.')
  else if (sector.includes('construction')) items.push('Tools, materials, transport, safety equipment, and project cash-flow gaps.')
  else if (sector.includes('wholesale')) items.push('Bulk stock, freight, storage, supplier credit terms, and stock turnover time.')
  else if (sector.includes('retail')) items.push('Opening stock, replenishment time, shrinkage, and rent or market fees.')
  else if (sector.includes('personal services')) items.push('Tools, consumables, service licences, and staff or owner operating time.')
  else items.push('Core equipment, stock or supplies, licences, and recurring operating costs.')

  if (premises.includes('market stall')) items.push('Stall fees, market levies, storage, and stock security.')
  else if (premises.includes('commercial')) items.push('Rent deposit, fit-out, utilities, and lease conditions.')
  else if (premises.includes('residential')) items.push('Permission to operate, permitted use, and any required changes to the premises.')
  else if (premises.includes('industrial')) items.push('Power and water connections, equipment installation, and safety requirements.')
  else items.push('Site permissions, weather protection, secure storage, and transport access.')

  if (!idea.registered) items.push('Confirm current registration and sector/county licensing requirements and fees.')
  if (idea.foundingEmployees > 0) items.push(`Include payroll and statutory costs for ${idea.foundingEmployees} planned employee${idea.foundingEmployees === 1 ? '' : 's'}.`)
  return items
}

function money(value: number) {
  return `KSh ${Math.round(value).toLocaleString('en-KE')}`
}
