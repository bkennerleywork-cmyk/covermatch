<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 1-based current step. */
    current: number
    steps?: readonly string[]
    /** Highest step the customer may jump back to. Later steps are not clickable. */
    maxReached?: number
  }>(),
  {
    steps: () => ['Your cover', 'Your health', 'Your quote', 'Your details'],
    maxReached: 1,
  },
)

const emit = defineEmits<{ navigate: [step: number] }>()

const currentLabel = computed(() => props.steps[props.current - 1] ?? '')
const isComplete = (step: number): boolean => step < props.current
const canNavigate = (step: number): boolean => step !== props.current && step <= props.maxReached
</script>

<template>
  <nav aria-label="Quote progress">
    <p class="mb-2 text-sm font-semibold sm:hidden">
      Step {{ current }} of {{ steps.length }}: {{ currentLabel }}
    </p>
    <ol class="grid gap-1.5 sm:gap-2" :style="{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }">
      <li
        v-for="(label, index) in steps"
        :key="label"
        :aria-current="index + 1 === current ? 'step' : undefined"
      >
        <span
          class="block h-1.5 rounded-full transition-colors duration-200"
          :class="index + 1 <= current ? 'bg-pine-800' : 'bg-line'"
          aria-hidden="true"
        ></span>
        <component
          :is="canNavigate(index + 1) ? 'button' : 'span'"
          :type="canNavigate(index + 1) ? 'button' : undefined"
          class="mt-2 inline-flex min-h-6 items-center gap-1.5 rounded text-left text-sm"
          :class="[
            index + 1 === current ? 'font-semibold text-ink' : 'text-ink-soft',
            canNavigate(index + 1) ? 'underline-offset-[3px] hover:text-ink hover:underline' : '',
            // Below sm the labels collapse into the summary line above, but stay readable to assistive tech.
            'max-sm:sr-only',
          ]"
          @click="canNavigate(index + 1) && emit('navigate', index + 1)"
        >
          <Check v-if="isComplete(index + 1)" class="size-4 text-pine-700" aria-hidden="true" />
          {{ label }}
          <span v-if="isComplete(index + 1)" class="sr-only">(completed)</span>
        </component>
      </li>
    </ol>
  </nav>
</template>
