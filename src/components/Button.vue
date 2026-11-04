<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { computed } from 'vue'

export type ButtonVariant = 'primary' | 'secondary' | 'outline'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    /** Announced to screen readers while loading. */
    loadingLabel?: string
  }>(),
  {
    variant: 'primary',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
    loadingLabel: 'Please wait',
  },
)

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-pine-800 text-surface hover:bg-pine-900 active:bg-pine-900',
  secondary: 'bg-marigold text-ink hover:bg-marigold-soft active:bg-marigold-soft',
  outline: 'border-[1.5px] border-line-strong bg-transparent text-ink hover:border-ink hover:bg-surface',
}

const classes = computed(() => [
  variantClasses[props.variant],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    class="relative inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
    :class="classes"
  >
    <span class="inline-flex items-center gap-2" :class="{ invisible: loading }">
      <slot />
    </span>
    <span v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
      <span class="sr-only">{{ loadingLabel }}</span>
    </span>
  </button>
</template>
