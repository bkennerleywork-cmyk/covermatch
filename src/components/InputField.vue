<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next'
import { computed, ref, useId } from 'vue'

type InputMode = 'text' | 'numeric' | 'tel' | 'email'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    type?: 'text' | 'email' | 'tel'
    name?: string
    hint?: string
    error?: string
    required?: boolean
    autocomplete?: string
    inputmode?: InputMode
    maxlength?: number
    /** Short suffix shown inside the field, such as "years". */
    suffix?: string
  }>(),
  {
    type: 'text',
    name: undefined,
    hint: undefined,
    error: undefined,
    required: false,
    autocomplete: undefined,
    inputmode: undefined,
    maxlength: undefined,
    suffix: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
}>()

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`
const input = ref<HTMLInputElement | null>(null)

const describedBy = computed(
  () =>
    [props.error ? errorId : null, props.hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined,
)

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div>
    <label :for="id" class="block font-semibold">
      {{ label }}
      <span v-if="!required" class="font-normal text-ink-soft">(optional)</span>
    </label>
    <p v-if="hint" :id="hintId" class="mt-0.5 text-sm text-ink-soft">{{ hint }}</p>
    <div class="relative mt-1.5">
      <input
        :id="id"
        ref="input"
        :value="modelValue"
        :type="type"
        :name="name"
        :required="required"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="block min-h-12 w-full rounded-lg border-[1.5px] bg-surface px-3.5 py-2.5 text-base text-ink caret-pine-700 transition-colors duration-150 focus:outline-none focus-visible:outline-[3px] focus-visible:outline-offset-1"
        :class="[
          error
            ? 'border-danger focus-visible:outline-danger'
            : 'border-line-strong hover:border-ink focus-visible:outline-pine-600',
          suffix ? 'pr-16' : '',
        ]"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="emit('blur')"
      />
      <span
        v-if="suffix"
        class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-ink-soft"
      >
        {{ suffix }}
      </span>
    </div>
    <p v-if="error" :id="errorId" class="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{{ error }}</span>
    </p>
  </div>
</template>
