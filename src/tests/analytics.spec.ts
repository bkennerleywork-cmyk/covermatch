import { beforeEach, describe, expect, it } from 'vitest'
import { assignVariant, bandAmount, resetAnalytics, useAnalytics } from '@/composables/useAnalytics'

describe('useAnalytics', () => {
  beforeEach(() => {
    resetAnalytics()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('pushes timestamped events to window.dataLayer', () => {
    useAnalytics().track({ event: 'funnel_step_view', step: 1, step_name: 'coverage' })
    expect(window.dataLayer).toHaveLength(1)
    expect(window.dataLayer?.[0]).toMatchObject({ event: 'funnel_step_view', step: 1 })
    expect(window.dataLayer?.[0]).toHaveProperty('timestamp')
  })

  it('assigns the same visitor to the same variant every time', () => {
    expect(assignVariant('health_cta_copy', 'visitor-1')).toBe(assignVariant('health_cta_copy', 'visitor-1'))
  })

  it('spreads visitors roughly evenly across variants', () => {
    const counts = new Map<string, number>()
    for (let index = 0; index < 2000; index += 1) {
      const variant = assignVariant('health_cta_copy', `visitor-${index}`)
      counts.set(variant, (counts.get(variant) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(800)
    }
    expect(counts.size).toBe(2)
  })

  it('records one exposure per experiment, however often it is read', () => {
    const { getVariant, events } = useAnalytics()
    getVariant('default_billing')
    getVariant('default_billing')
    expect(events.value.filter((entry) => entry.event === 'experiment_exposure')).toHaveLength(1)
  })

  it('keeps a visitor in their variant across page loads', () => {
    const first = useAnalytics().getVariant('health_cta_copy')
    const id = localStorage.getItem('covermatch.visitor')
    resetAnalytics()
    expect(useAnalytics().getVariant('health_cta_copy')).toBe(first)
    expect(localStorage.getItem('covermatch.visitor')).toBe(id)
  })

  it('allows a valid variant to be forced from the URL, and ignores invalid ones', () => {
    window.history.replaceState({}, '', '/?variant_default_billing=annual')
    expect(useAnalytics().getVariant('default_billing')).toBe('annual')

    resetAnalytics()
    window.history.replaceState({}, '', '/?variant_default_billing=free')
    expect(['monthly', 'annual']).toContain(useAnalytics().getVariant('default_billing'))
  })

  it('still works when storage is blocked', () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    try {
      expect(['monthly', 'annual']).toContain(useAnalytics().getVariant('default_billing'))
    } finally {
      Storage.prototype.getItem = original
    }
  })

  it('bands amounts so exact figures are not recorded', () => {
    expect(bandAmount(260_000, 50_000)).toBe('250000-300000')
  })
})
