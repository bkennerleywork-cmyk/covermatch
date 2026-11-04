import type { Meta, StoryObj } from '@storybook/vue3-vite'
import PriceSummaryCard from '@/components/PriceSummaryCard.vue'
import { calculatePremium } from '@/composables/useQuoteCalculator'

const breakdown = calculatePremium({
  payout: 250_000,
  termYears: 25,
  age: 35,
  isSmoker: false,
  conditions: [],
  criticalIllness: true,
  criticalIllnessAmount: 50_000,
  waiverOfPremium: true,
})

const meta = {
  title: 'Design system/PriceSummaryCard',
  component: PriceSummaryCard,
  tags: ['autodocs'],
  args: {
    breakdown,
    billing: 'monthly',
    payout: 250_000,
    termYears: 25,
    criticalIllnessAmount: 50_000,
  },
  render: (args) => ({
    components: { PriceSummaryCard },
    setup: () => ({ args }),
    template: '<div class="max-w-sm"><PriceSummaryCard v-bind="args" /></div>',
  }),
} satisfies Meta<typeof PriceSummaryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Monthly: Story = {}
export const Annual: Story = { args: { billing: 'annual' } }
export const AwaitingAge: Story = { args: { breakdown: null, criticalIllnessAmount: null } }
