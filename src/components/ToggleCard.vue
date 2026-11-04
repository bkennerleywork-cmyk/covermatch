<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    description?: string
    /** A radio card belongs to a group sharing `name`. A checkbox card stands alone. */
    type?: 'checkbox' | 'radio'
    name?: string
    icon?: Component
    disabled?: boolean
    /** Explains why the card is disabled, in place of the description. */
    disabledReason?: string
  }>(),
  {
    description: undefined,
    type: 'checkbox',
    name: undefined,
    icon: undefined,
    disabled: false,
    disabledReason: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label
    class="group relative flex items-start gap-3.5 rounded-xl border-[1.5px] p-4 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-pine-600"
    :class="[
      disabled
        ? 'cursor-not-allowed border-line bg-transparent'
        : modelValue
          ? 'cursor-pointer border-pine-800 bg-pine-50'
          : 'cursor-pointer border-line-strong bg-surface hover:border-ink',
    ]"
  >
    <input
      class="sr-only"
      :type="type"
      :name="name"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span
      class="mt-0.5 flex size-6 shrink-0 items-center justify-center border-[1.5px] transition-colors duration-150"
      :class="[
        type === 'radio' ? 'rounded-full' : 'rounded-md',
        modelValue ? 'border-pine-800 bg-pine-800 text-surface' : 'border-line-strong bg-surface',
      ]"
      aria-hidden="true"
    >
      <Check v-if="modelValue" class="size-4" :stroke-width="3" />
    </span>
    <span class="min-w-0 flex-1" :class="{ 'opacity-70': disabled }">
      <span class="flex items-start justify-between gap-3">
        <span class="font-semibold">{{ title }}</span>
        <component :is="icon" v-if="icon" class="size-5 shrink-0 text-pine-700" aria-hidden="true" />
        <span v-if="$slots.aside" class="tabular shrink-0 text-right text-sm font-semibold">
          <slot name="aside" />
        </span>
      </span>
      <span v-if="disabled && disabledReason" class="mt-0.5 block text-sm text-ink-soft">
        {{ disabledReason }}
      </span>
      <span v-else-if="description" class="mt-0.5 block text-sm text-ink-soft">
        {{ description }}
      </span>
    </span>
  </label>
</template>
