<script setup lang="ts">
import { ChevronUp } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  formatPence,
  formatPounds,
  type BillingFrequency,
  type PremiumBreakdown,
} from '@/composables/useQuoteCalculator'

const props = defineProps<{
  breakdown: PremiumBreakdown | null
  billing: BillingFrequency
  payout: number
  termYears: number
  criticalIllnessAmount?: number | null
}>()

const emit = defineEmits<{ 'update:billing': [value: BillingFrequency] }>()

const expanded = ref(false)

const price = computed(() => {
  if (!props.breakdown) return null
  return props.billing === 'monthly' ? props.breakdown.monthlyPence : props.breakdown.annualPence
})
const period = computed(() => (props.billing === 'monthly' ? 'a month' : 'a year'))

const lines = computed(() => {
  const value = props.breakdown
  if (!value) return []
  const entries = [{ label: 'Life cover', pence: value.lifeCoverPence }]
  if (value.criticalIllnessPence > 0) {
    entries.push({ label: 'Critical illness cover', pence: value.criticalIllnessPence })
  }
  if (value.waiverPence > 0) {
    entries.push({ label: 'Waiver of premium', pence: value.waiverPence })
  }
  return entries
})

const billingOptions: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annually' },
]

// Sliders change the price many times a second, so only the settled figure is announced.
const announcement = ref('')
let announceTimer: ReturnType<typeof setTimeout> | undefined

watch([price, period], ([value]) => {
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => {
    announcement.value = value === null ? '' : `Your price is now ${formatPence(value)} ${period.value}.`
  }, 800)
})

onBeforeUnmount(() => clearTimeout(announceTimer))
</script>

<template>
  <aside
    aria-label="Your price"
    class="fixed inset-x-0 bottom-0 z-20 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-pine-900 text-surface shadow-bar lg:sticky lg:top-6 lg:bottom-auto lg:max-h-none lg:rounded-2xl lg:shadow-panel"
  >
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>

    <div class="px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:p-6">
      <div class="relative flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium text-pine-100">Your estimated price</span>
          <span v-if="price !== null" class="tabular block">
            <span class="text-3xl font-bold tracking-tight lg:text-[2.75rem] lg:leading-tight" data-testid="price">{{ formatPence(price) }}</span>
            <span class="ml-1.5 text-pine-100">{{ period }}</span>
          </span>
          <span v-else class="mt-0.5 block font-semibold lg:mt-2 lg:text-lg">Enter your age to see a price</span>
        </span>
        <!-- Stretches over the whole row on small screens, and is removed from the tab order on large ones. -->
        <button
          type="button"
          class="absolute inset-0 flex items-center justify-end rounded focus-visible:outline-marigold lg:hidden"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          <ChevronUp
            class="size-6 transition-transform duration-200"
            :class="{ 'rotate-180': expanded }"
            aria-hidden="true"
          />
          <span class="sr-only">{{ expanded ? 'Hide' : 'Show' }} price details</span>
        </button>
      </div>

      <div :class="expanded ? 'block' : 'hidden lg:block'">
        <div
          class="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-pine-800 p-1"
          role="radiogroup"
          aria-label="How often you pay"
        >
          <label
            v-for="option in billingOptions"
            :key="option.value"
            class="flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-semibold transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-marigold"
            :class="billing === option.value ? 'bg-surface text-ink' : 'text-surface hover:bg-pine-700'"
          >
            <input
              class="sr-only"
              type="radio"
              name="billing"
              :value="option.value"
              :checked="billing === option.value"
              @change="emit('update:billing', option.value)"
            />
            {{ option.label }}
          </label>
        </div>

        <p v-if="breakdown && billing === 'annual'" class="tabular mt-2 text-sm text-marigold-soft">
          You save {{ formatPence(breakdown.annualSavingPence) }} a year by paying annually.
        </p>
        <p v-else-if="breakdown" class="tabular mt-2 text-sm text-pine-100">
          Pay annually and save {{ formatPence(breakdown.annualSavingPence) }} a year.
        </p>

        <dl class="mt-5 space-y-2 border-t border-pine-700 pt-4 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-pine-100">Payout</dt>
            <dd class="tabular font-semibold">{{ formatPounds(payout) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-pine-100">Length of cover</dt>
            <dd class="tabular font-semibold">{{ termYears }} years</dd>
          </div>
          <div v-if="criticalIllnessAmount" class="flex justify-between gap-4">
            <dt class="text-pine-100">Critical illness payout</dt>
            <dd class="tabular font-semibold">{{ formatPounds(criticalIllnessAmount) }}</dd>
          </div>
        </dl>

        <dl v-if="lines.length" class="mt-4 space-y-2 border-t border-pine-700 pt-4 text-sm">
          <div v-for="line in lines" :key="line.label" class="flex justify-between gap-4">
            <dt class="text-pine-100">{{ line.label }}</dt>
            <dd class="tabular font-semibold">{{ formatPence(line.pence) }}<span class="sr-only"> a month</span></dd>
          </div>
          <div class="flex justify-between gap-4 pt-1 font-bold">
            <dt>Monthly total</dt>
            <dd class="tabular">{{ formatPence(breakdown!.monthlyPence) }}</dd>
          </div>
        </dl>

        <p class="mt-4 text-xs leading-relaxed text-pine-100">
          Illustrative demo price. Not an offer of insurance.
        </p>
      </div>
    </div>
  </aside>
</template>
