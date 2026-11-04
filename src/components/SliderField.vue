<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min: number
    max: number
    step?: number
    /** Formats the value for display and for screen readers. */
    format?: (value: number) => string
    hint?: string
  }>(),
  {
    step: 1,
    format: (value: number) => String(value),
    hint: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const id = useId()
const hintId = `${id}-hint`

const fill = computed(() => {
  if (props.max <= props.min) return '100%'
  return `${((props.modelValue - props.min) / (props.max - props.min)) * 100}%`
})
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-4">
      <label :for="id" class="font-semibold">{{ label }}</label>
      <output :for="id" class="tabular text-2xl font-bold tracking-tight">{{ format(modelValue) }}</output>
    </div>
    <input
      :id="id"
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :aria-valuetext="format(modelValue)"
      :aria-describedby="hint ? hintId : undefined"
      class="range mt-1"
      :style="{ '--fill': fill }"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
    <div class="tabular flex justify-between text-sm text-ink-soft" aria-hidden="true">
      <span>{{ format(min) }}</span>
      <span>{{ format(max) }}</span>
    </div>
    <p v-if="hint" :id="hintId" class="mt-2 text-sm text-ink-soft">{{ hint }}</p>
  </div>
</template>
