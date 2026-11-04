import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import ToggleCard from '@/components/ToggleCard.vue'

const meta = {
  title: 'Design system/ToggleCard',
  component: ToggleCard,
  tags: ['autodocs'],
  args: {
    modelValue: false,
    title: 'Waiver of premium',
    description: 'We pay your premiums if illness or injury stops you working for more than 6 months.',
  },
  render: (args) => ({
    components: { ToggleCard },
    setup() {
      const selected = ref(args.modelValue)
      return { args, selected }
    },
    template: '<div class="max-w-lg"><ToggleCard v-bind="args" v-model="selected" /></div>',
  }),
} satisfies Meta<typeof ToggleCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Selected: Story = { args: { modelValue: true } }
export const Disabled: Story = {
  args: { disabled: true, disabledReason: 'Available if you are 55 or under.' },
}
