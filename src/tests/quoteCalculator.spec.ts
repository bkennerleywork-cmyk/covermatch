import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  normalisePhone,
  normalisePostcode,
  useLeadForm,
  validateLead,
  validators,
  type LeadFields,
} from '@/composables/useLeadForm'
import {
  ANNUAL_DISCOUNT,
  calculatePremium,
  formatPence,
  maxCriticalIllnessAmount,
  maxTermForAge,
  MINIMUM_MONTHLY_PENCE,
  PAYOUT_MAX,
  PAYOUT_MIN,
  useQuoteCalculator,
  WAIVER_LOADING,
  type PremiumInput,
} from '@/composables/useQuoteCalculator'

const baseInput: PremiumInput = {
  payout: 250_000,
  termYears: 25,
  age: 30,
  isSmoker: false,
  conditions: [],
  criticalIllness: false,
  criticalIllnessAmount: 50_000,
  waiverOfPremium: false,
}

const premium = (overrides: Partial<PremiumInput> = {}) =>
  calculatePremium({ ...baseInput, ...overrides })

describe('calculatePremium', () => {
  it('prices the reference customer at a known figure', () => {
    // 250 x 0.028 x 1.45 = £10.15, which guards against accidental changes to the model.
    expect(premium().monthlyPence).toBe(1015)
  })

  it('rises with payout, across the full £50k to £750k range', () => {
    const low = premium({ payout: PAYOUT_MIN }).monthlyPence
    const mid = premium({ payout: 250_000 }).monthlyPence
    const high = premium({ payout: PAYOUT_MAX }).monthlyPence
    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
  })

  it('clamps payouts outside the permitted range', () => {
    expect(premium({ payout: 1_000 }).monthlyPence).toBe(premium({ payout: PAYOUT_MIN }).monthlyPence)
    expect(premium({ payout: 9_000_000 }).monthlyPence).toBe(premium({ payout: PAYOUT_MAX }).monthlyPence)
  })

  it('rises with age and with term', () => {
    expect(premium({ age: 50 }).monthlyPence).toBeGreaterThan(premium({ age: 30 }).monthlyPence)
    expect(premium({ termYears: 35 }).monthlyPence).toBeGreaterThan(premium({ termYears: 15 }).monthlyPence)
  })

  it('charges smokers 2.1 times the non-smoker life cover price', () => {
    expect(premium({ isSmoker: true }).lifeCoverPence).toBe(Math.round(1015 * 2.1))
  })

  it('compounds loadings for several medical conditions', () => {
    const one = premium({ conditions: ['diabetes'] }).monthlyPence
    const two = premium({ conditions: ['diabetes', 'blood-pressure'] }).monthlyPence
    expect(one).toBe(Math.round(1015 * 1.5))
    expect(two).toBe(Math.round(1015 * 1.5 * 1.15))
  })

  it('flags only conditions that need an underwriter', () => {
    expect(premium({ conditions: ['blood-pressure'] }).needsUnderwriterReview).toBe(false)
    expect(premium({ conditions: ['heart'] }).needsUnderwriterReview).toBe(true)
  })

  it('applies the minimum premium to the smallest policies', () => {
    expect(premium({ age: 18, payout: PAYOUT_MIN, termYears: 5 }).monthlyPence).toBe(MINIMUM_MONTHLY_PENCE)
  })

  it('adds critical illness cover priced on its own amount', () => {
    const small = premium({ criticalIllness: true, criticalIllnessAmount: 20_000 })
    const large = premium({ criticalIllness: true, criticalIllnessAmount: 100_000 })
    expect(small.criticalIllnessPence).toBeGreaterThan(0)
    expect(large.criticalIllnessPence).toBeGreaterThan(small.criticalIllnessPence)
  })

  it('ignores the critical illness amount while the add-on is off', () => {
    expect(premium({ criticalIllness: false, criticalIllnessAmount: 200_000 }).criticalIllnessPence).toBe(0)
  })

  it('charges waiver of premium on both life and critical illness cover', () => {
    const result = premium({ criticalIllness: true, waiverOfPremium: true })
    expect(result.waiverPence).toBe(
      Math.round((result.lifeCoverPence + result.criticalIllnessPence) * WAIVER_LOADING),
    )
  })

  it('does not price add-ons for ages where they are unavailable', () => {
    const result = premium({
      age: 65,
      termYears: 20,
      criticalIllness: true,
      waiverOfPremium: true,
    })
    expect(result.criticalIllnessPence).toBe(0)
    expect(result.waiverPence).toBe(0)
  })

  it('always returns lines that add up to the total, in whole pence', () => {
    for (const age of [18, 33, 47, 60]) {
      for (const payout of [50_000, 137_000, 750_000]) {
        const result = premium({ age, payout, criticalIllness: true, waiverOfPremium: true, isSmoker: true })
        expect(result.lifeCoverPence + result.criticalIllnessPence + result.waiverPence).toBe(result.monthlyPence)
        expect(Number.isInteger(result.monthlyPence)).toBe(true)
      }
    }
  })

  it('discounts annual payment by 5% and reports the saving', () => {
    const result = premium()
    const fullYear = result.monthlyPence * 12
    expect(result.annualPence).toBe(Math.round(fullYear * (1 - ANNUAL_DISCOUNT)))
    expect(result.annualSavingPence).toBe(fullYear - result.annualPence)
  })
})

describe('eligibility rules', () => {
  it('limits the term so that cover ends by age 90', () => {
    expect(maxTermForAge(30)).toBe(40)
    expect(maxTermForAge(70)).toBe(20)
    expect(maxTermForAge(null)).toBe(40)
  })

  it('caps critical illness cover at the life cover and at £250k', () => {
    expect(maxCriticalIllnessAmount(100_000)).toBe(100_000)
    expect(maxCriticalIllnessAmount(600_000)).toBe(250_000)
  })
})

describe('useQuoteCalculator', () => {
  it('shows no price until the age is valid', () => {
    const quote = useQuoteCalculator()
    expect(quote.breakdown.value).toBeNull()
    quote.state.age = 12
    expect(quote.breakdown.value).toBeNull()
    quote.state.age = 30
    expect(quote.breakdown.value?.monthlyPence).toBe(1015)
  })

  it('recalculates in real time when answers change', () => {
    const quote = useQuoteCalculator()
    quote.state.age = 30
    const before = quote.displayPence.value
    quote.state.payout = 500_000
    expect(quote.displayPence.value).toBe(2030)
    expect(quote.displayPence.value).not.toBe(before)
  })

  it('switches the displayed figure between monthly and annual', () => {
    const quote = useQuoteCalculator()
    quote.state.age = 30
    quote.billing.value = 'annual'
    expect(quote.displayPence.value).toBe(quote.breakdown.value?.annualPence)
  })

  it('reports each add-on cost whether or not it is selected', () => {
    const quote = useQuoteCalculator()
    quote.state.age = 30
    const cost = quote.criticalIllnessCost.value!
    expect(cost).toBeGreaterThan(0)
    const before = quote.breakdown.value!.monthlyPence
    quote.state.criticalIllness = true
    expect(quote.breakdown.value!.monthlyPence).toBe(before + cost)
  })

  it('pulls dependent answers back into range when earlier answers change', async () => {
    const quote = useQuoteCalculator()
    quote.state.age = 40
    quote.state.termYears = 40
    quote.state.criticalIllness = true
    quote.state.waiverOfPremium = true
    quote.state.criticalIllnessAmount = 200_000
    await nextTick()

    quote.state.age = 65
    quote.state.payout = 100_000
    await nextTick()

    expect(quote.state.termYears).toBe(25)
    expect(quote.state.criticalIllness).toBe(false)
    expect(quote.state.waiverOfPremium).toBe(false)
    expect(quote.state.criticalIllnessAmount).toBe(100_000)
  })

  it('treats "None of these" and specific conditions as mutually exclusive', () => {
    const quote = useQuoteCalculator()
    quote.toggleCondition('diabetes', true)
    quote.setNoConditions(true)
    expect(quote.state.conditions).toEqual([])
    quote.toggleCondition('heart', true)
    expect(quote.state.noConditions).toBe(false)
    expect(quote.state.conditions).toEqual(['heart'])
  })
})

describe('formatPence', () => {
  it('formats pence as pounds', () => {
    expect(formatPence(123_456)).toBe('£1,234.56')
  })
})

const validLead: LeadFields = {
  firstName: 'Ada',
  lastName: "O'Neill-Smith",
  email: 'ada@example.com',
  phone: '07700 900123',
  postcode: 'sw1a 1aa',
  consent: true,
  marketing: false,
}

describe('lead validation', () => {
  it('accepts a complete form and does not require marketing consent', () => {
    expect(validateLead(validLead)).toEqual({})
  })

  it('reports every missing required field', () => {
    const errors = validateLead({
      firstName: ' ',
      lastName: '',
      email: '',
      phone: '',
      postcode: '',
      consent: false,
      marketing: false,
    })
    expect(Object.keys(errors).sort()).toEqual(
      ['consent', 'email', 'firstName', 'lastName', 'phone', 'postcode'].sort(),
    )
  })

  it.each(['Zoë', 'José', "O'Brien", 'Anne-Marie', 'Nguyễn', 'محمد'])('accepts the name %s', (firstName) => {
    expect(validators.firstName({ ...validLead, firstName })).toBeUndefined()
  })

  it.each(['<script>', '123', 'a@b'])('rejects the name %s', (firstName) => {
    expect(validators.firstName({ ...validLead, firstName })).toMatch(/can only include/)
  })

  it.each(['plainaddress', 'a@b', 'a b@example.com', '@example.com'])('rejects the email %s', (email) => {
    expect(validators.email({ ...validLead, email })).toBeDefined()
  })

  it.each(['07700 900123', '+44 7700 900123', '020 7946 0000', '(0161) 496 0000', '0044 7700 900123'])(
    'accepts the phone number %s',
    (phone) => {
      expect(validators.phone({ ...validLead, phone })).toBeUndefined()
    },
  )

  it.each(['12345', '07700 90012', '+1 202 555 0100', '00000000000'])('rejects the phone number %s', (phone) => {
    expect(validators.phone({ ...validLead, phone })).toBeDefined()
  })

  it.each(['SW1A 1AA', 'sw1a1aa', 'M1 1AE', 'B33 8TH', 'CR2 6XH', 'DN55 1PT'])('accepts the postcode %s', (postcode) => {
    expect(validators.postcode({ ...validLead, postcode })).toBeUndefined()
  })

  it.each(['SW1A', '12345', 'ABC 123'])('rejects the postcode %s', (postcode) => {
    expect(validators.postcode({ ...validLead, postcode })).toBeDefined()
  })

  it('normalises values for the CRM', () => {
    expect(normalisePhone('(0161) 496-0000')).toBe('01614960000')
    expect(normalisePostcode('sw1a1aa')).toBe('SW1A 1AA')
  })
})

describe('useLeadForm', () => {
  it('hides errors until a field is touched, and clears them once fixed', () => {
    const form = useLeadForm()
    expect(form.errors.value.email).toBeUndefined()
    form.touch('email')
    expect(form.errors.value.email).toBeDefined()
    form.fields.email = 'ada@example.com'
    expect(form.errors.value.email).toBeUndefined()
  })

  it('reveals all errors on submit and returns the first invalid field', () => {
    const form = useLeadForm()
    form.fields.firstName = 'Ada'
    expect(form.validateAll()).toBe('lastName')
    expect(Object.keys(form.errors.value)).toContain('consent')
  })
})
