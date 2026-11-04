import type { BillingFrequency, MedicalConditionId } from '@/composables/useQuoteCalculator'

export interface CrmLeadPayload {
  source: 'covermatch-web-funnel'
  submittedAt: string
  contact: {
    firstName: string
    lastName: string
    email: string
    phone: string
    postcode: string
  }
  consent: {
    quoteProcessing: boolean
    marketing: boolean
    capturedAt: string
  }
  quote: {
    payout: number
    termYears: number
    age: number
    isSmoker: boolean
    conditions: MedicalConditionId[]
    criticalIllnessAmount: number | null
    waiverOfPremium: boolean
    billing: BillingFrequency
    monthlyPence: number
    annualPence: number
    needsUnderwriterReview: boolean
  }
  experiments: Record<string, string>
}

export interface CrmResponse {
  reference: string
}

export class CrmDispatchError extends Error {
  override name = 'CrmDispatchError'
}

/** Addresses on this reserved domain fail on purpose, so the error state can be demonstrated. */
export const SIMULATED_FAILURE_DOMAIN = '@fail.test'

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createReference(): string {
  const values = crypto.getRandomValues(new Uint8Array(6))
  const body = Array.from(values, (value) => REFERENCE_ALPHABET[value % REFERENCE_ALPHABET.length])
  return `CM-${body.join('')}`
}

/** Mock CRM endpoint. The latency is there so that loading states are exercised for real. */
export async function dispatchLead(
  payload: CrmLeadPayload,
  { latencyMs = 900 }: { latencyMs?: number } = {},
): Promise<CrmResponse> {
  await new Promise((resolve) => setTimeout(resolve, latencyMs))

  if (payload.contact.email.endsWith(SIMULATED_FAILURE_DOMAIN)) {
    throw new CrmDispatchError('The CRM did not accept the lead.')
  }
  return { reference: createReference() }
}
