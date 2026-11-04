import { shallowRef } from 'vue'

/*
 * A mock of the Google Tag Manager data layer. Events are pushed to window.dataLayer in
 * the shape GTM expects, so swapping in the real container snippet needs no code changes.
 *
 * Privacy rule enforced by the types below: event payloads hold funnel behaviour only.
 * Health answers, smoker status and contact details are never allowed in, because tag
 * managers forward data to third parties. Payout is sent as a band, for the same reason.
 */

export type FunnelStepName = 'coverage' | 'health' | 'customise' | 'lead'
export type AddOnName = 'critical_illness' | 'waiver_of_premium'

export type AnalyticsEvent =
  | { event: 'funnel_step_view'; step: number; step_name: FunnelStepName }
  | { event: 'funnel_step_complete'; step: number; step_name: FunnelStepName }
  | { event: 'funnel_step_error'; step: number; step_name: FunnelStepName; field_count: number }
  | { event: 'quote_viewed'; payout_band: string; term_years: number; billing: string }
  | { event: 'addon_toggled'; addon: AddOnName; enabled: boolean }
  | { event: 'billing_changed'; billing: string }
  | { event: 'modal_opened'; modal: string }
  | { event: 'lead_submitted'; lead_reference: string; premium_band: string }
  | { event: 'lead_failed'; reason: 'network' }
  | { event: 'experiment_exposure'; experiment_id: string; variant: string }

export type DataLayerEntry = AnalyticsEvent & { timestamp: string }

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

export const EXPERIMENTS = {
  health_cta_copy: ['see_my_price', 'show_my_quote'],
  default_billing: ['monthly', 'annual'],
} as const

export type ExperimentId = keyof typeof EXPERIMENTS
export type VariantOf<T extends ExperimentId> = (typeof EXPERIMENTS)[T][number]

const VISITOR_KEY = 'covermatch.visitor'

function hash(input: string): number {
  // FNV-1a: small, stable and evenly spread, which is all bucketing needs.
  let value = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** The same visitor always lands in the same variant, without storing any assignment. */
export function assignVariant<T extends ExperimentId>(
  experimentId: T,
  visitorId: string,
): VariantOf<T> {
  const variants: readonly VariantOf<T>[] = EXPERIMENTS[experimentId]
  const index = hash(`${experimentId}:${visitorId}`) % variants.length
  return variants[index] as VariantOf<T>
}

function visitorId(): string {
  const fresh = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  // Storage can throw in private windows. Variants then last for the page view, which is safe.
  try {
    const stored = localStorage.getItem(VISITOR_KEY)
    if (stored) return stored
    const created = fresh()
    localStorage.setItem(VISITOR_KEY, created)
    return created
  } catch {
    return fresh()
  }
}

/** Band a figure so that analytics never hold a customer's exact quote. */
export function bandAmount(value: number, width: number): string {
  const lower = Math.floor(value / width) * width
  return `${lower}-${lower + width}`
}

// Module state, so every component sees the same visitor, exposures and event log.
const events = shallowRef<readonly DataLayerEntry[]>([])
const exposed = new Set<ExperimentId>()
let visitor: string | null = null

export function useAnalytics() {
  function track(entry: AnalyticsEvent): void {
    const stamped: DataLayerEntry = { ...entry, timestamp: new Date().toISOString() }
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push(stamped)
    events.value = [...events.value, stamped]
  }

  /** Returns the variant and records one exposure per page load. */
  function getVariant<T extends ExperimentId>(experimentId: T): VariantOf<T> {
    const override = new URLSearchParams(window.location.search).get(`variant_${experimentId}`)
    const variants: readonly string[] = EXPERIMENTS[experimentId]
    visitor = visitor ?? visitorId()
    const variant =
      override && variants.includes(override)
        ? (override as VariantOf<T>)
        : assignVariant(experimentId, visitor)

    if (!exposed.has(experimentId)) {
      exposed.add(experimentId)
      track({ event: 'experiment_exposure', experiment_id: experimentId, variant })
    }
    return variant
  }

  return { track, getVariant, events }
}

/** Test helper: clears module state between specs. */
export function resetAnalytics(): void {
  events.value = []
  exposed.clear()
  visitor = null
  window.dataLayer = []
}
