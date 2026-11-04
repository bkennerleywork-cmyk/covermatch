import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { resetAnalytics } from '@/composables/useAnalytics'
import { routes } from '@/router'

async function mountFunnel(): Promise<VueWrapper> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

const heading = (wrapper: VueWrapper) => wrapper.get('h1').text()

const submit = async (wrapper: VueWrapper) => {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

const clickCard = async (wrapper: VueWrapper, title: string) => {
  const card = wrapper.findAll('label').find((label) => label.text().startsWith(title))
  if (!card) throw new Error(`No card titled ${title}`)
  await card.get('input').setValue(true)
}

async function completeToStep4(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('input[name="age"]').setValue('30')
  await submit(wrapper)
  await clickCard(wrapper, 'No')
  await clickCard(wrapper, 'None of these')
  await submit(wrapper)
  await submit(wrapper)
}

async function fillLead(wrapper: VueWrapper, email = 'ada@example.com'): Promise<void> {
  await wrapper.get('input[name="firstName"]').setValue('Ada')
  await wrapper.get('input[name="lastName"]').setValue('Lovelace')
  await wrapper.get('input[name="email"]').setValue(email)
  await wrapper.get('input[name="phone"]').setValue('07700 900123')
  await wrapper.get('input[name="postcode"]').setValue('sw1a1aa')
  await wrapper.get('input[name="consent"]').setValue(true)
}

async function sendLead(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('form').trigger('submit')
  await vi.advanceTimersByTimeAsync(1500)
  await flushPromises()
}

describe('FunnelView journey', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('scrollTo', vi.fn())
    resetAnalytics()
    window.history.replaceState({}, '', '/?variant_default_billing=monthly')
  })

  afterEach(() => {
    wrapper.unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('will not leave step 1 without a valid age', async () => {
    wrapper = await mountFunnel()
    await submit(wrapper)
    expect(heading(wrapper)).toBe('How much cover do you need?')
    expect(wrapper.text()).toContain('Enter your age.')

    await wrapper.get('input[name="age"]').setValue('17')
    await submit(wrapper)
    expect(wrapper.text()).toContain('between 18 and 70')
  })

  it('updates the price as soon as an age is entered', async () => {
    wrapper = await mountFunnel()
    expect(wrapper.find('[data-testid="price"]').exists()).toBe(false)
    await wrapper.get('input[name="age"]').setValue('30')
    expect(wrapper.get('[data-testid="price"]').text()).toBe('£10.15')
  })

  it('requires both health answers on step 2', async () => {
    wrapper = await mountFunnel()
    await wrapper.get('input[name="age"]').setValue('30')
    await submit(wrapper)
    await submit(wrapper)
    expect(wrapper.text()).toContain('Tell us whether you use nicotine.')
    expect(wrapper.text()).toContain('Choose any that apply')
    expect(heading(wrapper)).toBe('A few questions about your health')
  })

  it('reprices a smoker with an add-on on step 3', async () => {
    wrapper = await mountFunnel()
    await wrapper.get('input[name="age"]').setValue('30')
    await submit(wrapper)
    await clickCard(wrapper, 'Yes')
    await clickCard(wrapper, 'None of these')
    await submit(wrapper)
    expect(wrapper.get('[data-testid="price"]').text()).toBe('£21.32')

    await wrapper.get('[data-testid="waiver"] input').setValue(true)
    expect(wrapper.get('[data-testid="price"]').text()).toBe('£23.03')
  })

  it('shows inline errors on an empty lead form and does not dispatch', async () => {
    wrapper = await mountFunnel()
    await completeToStep4(wrapper)
    await sendLead(wrapper)
    expect(wrapper.text()).toContain('Enter your first name.')
    expect(wrapper.text()).toContain('Tick the box')
    expect(wrapper.find('[data-testid="success"]').exists()).toBe(false)
  })

  it('dispatches the lead and shows the success state', async () => {
    wrapper = await mountFunnel()
    await completeToStep4(wrapper)
    await fillLead(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true')

    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()

    expect(wrapper.get('[data-testid="success"]').text()).toContain('Thanks, Ada')
    expect(wrapper.get('[data-testid="reference"]').text()).toMatch(/^CM-[A-Z2-9]{6}$/)
    const payload = JSON.parse(wrapper.get('[data-testid="crm-payload"]').text())
    expect(payload.contact.postcode).toBe('SW1A 1AA')
    expect(payload.contact.phone).toBe('07700900123')
    expect(payload.quote.monthlyPence).toBe(1015)
    expect(payload.consent.quoteProcessing).toBe(true)
    expect(payload.consent.marketing).toBe(false)
  })

  it('confirms the price in the billing frequency the customer chose', async () => {
    window.history.replaceState({}, '', '/?variant_default_billing=annual')
    wrapper = await mountFunnel()
    await completeToStep4(wrapper)
    await fillLead(wrapper)
    await sendLead(wrapper)
    expect(wrapper.get('[data-testid="final-price"]').text()).toBe('£115.71 a year')
  })

  it('keeps the answers and offers a retry when the CRM fails', async () => {
    wrapper = await mountFunnel()
    await completeToStep4(wrapper)
    await fillLead(wrapper, 'ada@fail.test')
    await sendLead(wrapper)

    expect(wrapper.get('[data-testid="submit-error"]').text()).toContain('could not save')
    expect((wrapper.get('input[name="firstName"]').element as HTMLInputElement).value).toBe('Ada')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Try again')
  })

  it('never leaks health answers or contact details into the data layer', async () => {
    wrapper = await mountFunnel()
    await wrapper.get('input[name="age"]').setValue('41')
    await submit(wrapper)
    await clickCard(wrapper, 'Yes')
    await clickCard(wrapper, 'Diabetes')
    await submit(wrapper)
    await submit(wrapper)
    await fillLead(wrapper)
    await sendLead(wrapper)

    const stream = JSON.stringify(window.dataLayer).toLowerCase()
    expect(stream).toContain('lead_submitted')
    const secrets = ['diabetes', 'smoker', 'nicotine', 'ada', 'lovelace', 'example.com', '07700', 'sw1a', '"age"', 'monthlypence']
    for (const secret of secrets) {
      expect(stream).not.toContain(secret)
    }
  })
})
