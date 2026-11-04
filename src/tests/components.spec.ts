import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '@/components/Button.vue'
import InputField from '@/components/InputField.vue'
import PriceSummaryCard from '@/components/PriceSummaryCard.vue'
import SliderField from '@/components/SliderField.vue'
import StepIndicator from '@/components/StepIndicator.vue'
import ToggleCard from '@/components/ToggleCard.vue'
import { calculatePremium } from '@/composables/useQuoteCalculator'

describe('Button', () => {
  it('defaults to type="button" so it cannot submit a form by accident', () => {
    expect(mount(Button).attributes('type')).toBe('button')
  })

  it('blocks interaction and announces itself while loading', () => {
    const wrapper = mount(Button, {
      props: { loading: true, loadingLabel: 'Saving' },
      slots: { default: 'Save' },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Saving')
  })

  it.each([
    ['primary', 'bg-pine-800'],
    ['secondary', 'bg-marigold'],
    ['outline', 'border-line-strong'],
  ] as const)('renders distinct styling for %s', (variant, expected) => {
    expect(mount(Button, { props: { variant } }).classes()).toContain(expected)
  })
})

describe('InputField', () => {
  it('links the label and error to the input', () => {
    const wrapper = mount(InputField, {
      props: { modelValue: '', label: 'Email', error: 'Enter your email.' },
    })
    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-invalid')).toBe('true')
    const describedBy = input.attributes('aria-describedby')!
    expect(wrapper.get(`[id="${describedBy}"]`).text()).toBe('Enter your email.')
  })

  it('emits typed values', async () => {
    const wrapper = mount(InputField, { props: { modelValue: '', label: 'Name' } })
    await wrapper.get('input').setValue('Ada')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Ada'])
  })
})

describe('SliderField', () => {
  it('emits numbers and exposes a readable value', async () => {
    const wrapper = mount(SliderField, {
      props: {
        modelValue: 10,
        label: 'Term',
        min: 5,
        max: 40,
        format: (value: number) => `${value} years`,
      },
    })
    expect(wrapper.get('input').attributes('aria-valuetext')).toBe('10 years')
    await wrapper.get('input').setValue(20)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([20])
  })
})

describe('ToggleCard', () => {
  it('emits its new state', async () => {
    const wrapper = mount(ToggleCard, { props: { modelValue: false, title: 'Waiver' } })
    await wrapper.get('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('explains why it is disabled', () => {
    const wrapper = mount(ToggleCard, {
      props: {
        modelValue: false,
        title: 'Waiver',
        description: 'Normal',
        disabled: true,
        disabledReason: 'Not available at your age',
      },
    })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Not available at your age')
    expect(wrapper.text()).not.toContain('Normal')
  })
})

describe('StepIndicator', () => {
  it('marks the current step and lets people return only to reached steps', async () => {
    const wrapper = mount(StepIndicator, { props: { current: 2, maxReached: 3 } })
    expect(wrapper.findAll('li')[1]?.attributes('aria-current')).toBe('step')
    expect(wrapper.findAll('button')).toHaveLength(2)
    await wrapper.findAll('button')[0]?.trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual([1])
  })
})

describe('PriceSummaryCard', () => {
  const breakdown = calculatePremium({
    payout: 250_000,
    termYears: 25,
    age: 30,
    isSmoker: false,
    conditions: [],
    criticalIllness: false,
    criticalIllnessAmount: 50_000,
    waiverOfPremium: false,
  })

  it('prompts for an age until a price exists', () => {
    const wrapper = mount(PriceSummaryCard, {
      props: { breakdown: null, billing: 'monthly', payout: 250_000, termYears: 25 },
    })
    expect(wrapper.text()).toContain('Enter your age')
  })

  it('shows the monthly or annual figure', async () => {
    const wrapper = mount(PriceSummaryCard, {
      props: { breakdown, billing: 'monthly', payout: 250_000, termYears: 25 },
    })
    expect(wrapper.get('[data-testid="price"]').text()).toBe('£10.15')
    await wrapper.setProps({ billing: 'annual' })
    expect(wrapper.get('[data-testid="price"]').text()).toBe('£115.71')
  })
})
