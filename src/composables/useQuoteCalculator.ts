import { computed, reactive, ref, watch } from 'vue'

/*
 * The pricing model is illustrative. It is shaped like UK term assurance pricing
 * (cost rises with age, term and sum assured, and smokers pay about double) but it
 * is not actuarial and must not be read as a real offer of cover.
 */

export const PAYOUT_MIN = 50_000
export const PAYOUT_MAX = 750_000
export const PAYOUT_STEP = 5_000

export const TERM_MIN = 5
export const TERM_MAX = 40

export const AGE_MIN = 18
export const AGE_MAX = 70
/** Cover must finish by this birthday. */
export const MAX_AGE_AT_EXPIRY = 90

export const CRITICAL_ILLNESS_MIN = 10_000
export const CRITICAL_ILLNESS_CAP = 250_000
export const CRITICAL_ILLNESS_STEP = 5_000
export const CRITICAL_ILLNESS_MAX_AGE = 60

export const WAIVER_MAX_AGE = 55
export const WAIVER_LOADING = 0.08

export const SMOKER_MULTIPLIER = 2.1
export const ANNUAL_DISCOUNT = 0.05
export const MINIMUM_MONTHLY_PENCE = 500

const BASE_RATE_PER_THOUSAND = 0.028
const BASE_RATE_AGE = 30
const AGE_GROWTH = 1.075
const TERM_BASELINE = 10
const TERM_GROWTH_PER_YEAR = 0.03
const CRITICAL_ILLNESS_RATE_MULTIPLE = 3.2

export type MedicalConditionId =
  | 'blood-pressure'
  | 'diabetes'
  | 'mental-health'
  | 'heart'
  | 'cancer'

export interface MedicalCondition {
  id: MedicalConditionId
  label: string
  description: string
  /** Multiplier applied to the premium. Loadings compound. */
  loading: number
  /** Real cover would need an underwriter to review this answer. */
  needsReview: boolean
}

export const MEDICAL_CONDITIONS: readonly MedicalCondition[] = [
  {
    id: 'blood-pressure',
    label: 'High blood pressure or cholesterol',
    description: 'Including conditions controlled with medication.',
    loading: 1.15,
    needsReview: false,
  },
  {
    id: 'diabetes',
    label: 'Diabetes',
    description: 'Type 1 or type 2.',
    loading: 1.5,
    needsReview: false,
  },
  {
    id: 'mental-health',
    label: 'Anxiety, depression or another mental health condition',
    description: 'Treated or diagnosed in the last five years.',
    loading: 1.1,
    needsReview: false,
  },
  {
    id: 'heart',
    label: 'Heart condition or stroke',
    description: 'Including angina, heart attack or a mini-stroke.',
    loading: 1.75,
    needsReview: true,
  },
  {
    id: 'cancer',
    label: 'Cancer',
    description: 'A diagnosis at any time, including if you are now in remission.',
    loading: 1.6,
    needsReview: true,
  },
]

export interface PremiumInput {
  payout: number
  termYears: number
  age: number
  isSmoker: boolean
  conditions: readonly MedicalConditionId[]
  criticalIllness: boolean
  criticalIllnessAmount: number
  waiverOfPremium: boolean
}

export interface PremiumBreakdown {
  /** All amounts are whole pence, so lines always add up to the total. */
  lifeCoverPence: number
  criticalIllnessPence: number
  waiverPence: number
  monthlyPence: number
  annualPence: number
  annualSavingPence: number
  needsUnderwriterReview: boolean
}

export type BillingFrequency = 'monthly' | 'annual'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export const formatPence = (pence: number): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(pence / 100)

export const formatPounds = (pounds: number): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pounds)

export const isValidAge = (age: number | null): age is number =>
  age !== null && Number.isInteger(age) && age >= AGE_MIN && age <= AGE_MAX

export const maxTermForAge = (age: number | null): number =>
  isValidAge(age) ? clamp(MAX_AGE_AT_EXPIRY - age, TERM_MIN, TERM_MAX) : TERM_MAX

export const isCriticalIllnessAvailable = (age: number | null): boolean =>
  age === null || age <= CRITICAL_ILLNESS_MAX_AGE

export const isWaiverAvailable = (age: number | null): boolean =>
  age === null || age <= WAIVER_MAX_AGE

/** Critical illness cover can never exceed the life cover it sits alongside. */
export const maxCriticalIllnessAmount = (payout: number): number =>
  Math.min(payout, CRITICAL_ILLNESS_CAP)

const healthLoading = (conditions: readonly MedicalConditionId[]): number =>
  MEDICAL_CONDITIONS.filter((condition) => conditions.includes(condition.id)).reduce(
    (total, condition) => total * condition.loading,
    1,
  )

export function calculatePremium(input: PremiumInput): PremiumBreakdown {
  const age = clamp(input.age, AGE_MIN, AGE_MAX)
  const term = clamp(input.termYears, TERM_MIN, maxTermForAge(age))
  const payout = clamp(input.payout, PAYOUT_MIN, PAYOUT_MAX)

  const ageRate = BASE_RATE_PER_THOUSAND * AGE_GROWTH ** (age - BASE_RATE_AGE)
  const termFactor = 1 + (term - TERM_BASELINE) * TERM_GROWTH_PER_YEAR
  const smokerFactor = input.isSmoker ? SMOKER_MULTIPLIER : 1
  const ratePerThousand = ageRate * termFactor * smokerFactor * healthLoading(input.conditions)

  // The minimum premium applies to the life cover line so that every add-on keeps a visible cost.
  const lifeCoverPence = Math.max(
    Math.round((payout / 1000) * ratePerThousand * 100),
    MINIMUM_MONTHLY_PENCE,
  )

  const hasCriticalIllness = input.criticalIllness && isCriticalIllnessAvailable(age)
  const criticalIllnessAmount = clamp(
    input.criticalIllnessAmount,
    CRITICAL_ILLNESS_MIN,
    maxCriticalIllnessAmount(payout),
  )
  const criticalIllnessPence = hasCriticalIllness
    ? Math.round(
        (criticalIllnessAmount / 1000) * ratePerThousand * CRITICAL_ILLNESS_RATE_MULTIPLE * 100,
      )
    : 0

  const waiverPence =
    input.waiverOfPremium && isWaiverAvailable(age)
      ? Math.round((lifeCoverPence + criticalIllnessPence) * WAIVER_LOADING)
      : 0

  const monthlyPence = lifeCoverPence + criticalIllnessPence + waiverPence
  const fullYearPence = monthlyPence * 12
  const annualPence = Math.round(fullYearPence * (1 - ANNUAL_DISCOUNT))

  return {
    lifeCoverPence,
    criticalIllnessPence,
    waiverPence,
    monthlyPence,
    annualPence,
    annualSavingPence: fullYearPence - annualPence,
    needsUnderwriterReview: MEDICAL_CONDITIONS.some(
      (condition) => condition.needsReview && input.conditions.includes(condition.id),
    ),
  }
}

interface QuoteState {
  payout: number
  termYears: number
  age: number | null
  /** Null until the customer has answered. It is priced as a non-smoker until then. */
  isSmoker: boolean | null
  conditions: MedicalConditionId[]
  /** True when the customer has actively told us none of the conditions apply. */
  noConditions: boolean
  criticalIllness: boolean
  criticalIllnessAmount: number
  waiverOfPremium: boolean
}

const initialState = (): QuoteState => ({
  payout: 250_000,
  termYears: 25,
  age: null,
  isSmoker: null,
  conditions: [],
  noConditions: false,
  criticalIllness: false,
  criticalIllnessAmount: 50_000,
  waiverOfPremium: false,
})

export function useQuoteCalculator(initialBilling: BillingFrequency = 'monthly') {
  const state = reactive<QuoteState>(initialState())
  const billing = ref<BillingFrequency>(initialBilling)

  const maxTerm = computed(() => maxTermForAge(state.age))
  const criticalIllnessMax = computed(() => maxCriticalIllnessAmount(state.payout))
  const criticalIllnessAvailable = computed(() => isCriticalIllnessAvailable(state.age))
  const waiverAvailable = computed(() => isWaiverAvailable(state.age))

  // Keep dependent answers valid when an earlier answer narrows what is allowed.
  watch(maxTerm, (max) => {
    if (state.termYears > max) state.termYears = max
  })
  watch(criticalIllnessMax, (max) => {
    if (state.criticalIllnessAmount > max) state.criticalIllnessAmount = max
  })
  watch(criticalIllnessAvailable, (available) => {
    if (!available) state.criticalIllness = false
  })
  watch(waiverAvailable, (available) => {
    if (!available) state.waiverOfPremium = false
  })

  const toInput = (overrides: Partial<PremiumInput> = {}): PremiumInput | null =>
    isValidAge(state.age)
      ? {
          payout: state.payout,
          termYears: state.termYears,
          age: state.age,
          isSmoker: state.isSmoker === true,
          conditions: state.conditions,
          criticalIllness: state.criticalIllness,
          criticalIllnessAmount: state.criticalIllnessAmount,
          waiverOfPremium: state.waiverOfPremium,
          ...overrides,
        }
      : null

  const priceWith = (overrides: Partial<PremiumInput> = {}): number | null => {
    const input = toInput(overrides)
    return input ? calculatePremium(input).monthlyPence : null
  }

  /** Null until a valid age is known, because any earlier figure would be made up. */
  const breakdown = computed<PremiumBreakdown | null>(() => {
    const input = toInput()
    return input ? calculatePremium(input) : null
  })

  const addOnCost = (flag: 'criticalIllness' | 'waiverOfPremium') =>
    computed<number | null>(() => {
      const withAddOn = priceWith({ [flag]: true })
      const withoutAddOn = priceWith({ [flag]: false })
      return withAddOn === null || withoutAddOn === null ? null : withAddOn - withoutAddOn
    })

  const criticalIllnessCost = addOnCost('criticalIllness')
  const waiverCost = addOnCost('waiverOfPremium')

  const displayPence = computed<number | null>(() => {
    if (!breakdown.value) return null
    return billing.value === 'monthly' ? breakdown.value.monthlyPence : breakdown.value.annualPence
  })

  function toggleCondition(id: MedicalConditionId, selected: boolean): void {
    state.conditions = selected
      ? [...state.conditions.filter((existing) => existing !== id), id]
      : state.conditions.filter((existing) => existing !== id)
    if (selected) state.noConditions = false
  }

  function setNoConditions(selected: boolean): void {
    state.noConditions = selected
    if (selected) state.conditions = []
  }

  function reset(): void {
    Object.assign(state, initialState())
    billing.value = initialBilling
  }

  return {
    state,
    billing,
    breakdown,
    displayPence,
    maxTerm,
    criticalIllnessMax,
    criticalIllnessAvailable,
    waiverAvailable,
    criticalIllnessCost,
    waiverCost,
    toggleCondition,
    setNoConditions,
    reset,
  }
}

export type QuoteCalculator = ReturnType<typeof useQuoteCalculator>
