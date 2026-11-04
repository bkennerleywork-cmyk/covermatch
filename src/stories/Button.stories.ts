import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ArrowRight } from 'lucide-vue-next'
import Button from '@/components/Button.vue'

const meta = {
  title: 'Design system/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'outline'] },
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
  },
  args: { variant: 'primary', loading: false, disabled: false, block: false },
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: '<Button v-bind="args">Continue</Button>',
  }),
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Loading: Story = { args: { loading: true, loadingLabel: 'Saving your quote' } }
export const Disabled: Story = { args: { disabled: true } }

export const WithIcon: Story = {
  render: (args) => ({
    components: { Button, ArrowRight },
    setup: () => ({ args }),
    template: '<Button v-bind="args">Continue <ArrowRight class="size-5" aria-hidden="true" /></Button>',
  }),
}
