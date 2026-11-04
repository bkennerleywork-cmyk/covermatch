<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

// The native dialog element provides the focus trap, Esc handling, inert background and
// focus restoration. Writing those by hand is how modals usually become inaccessible.
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

async function sync(open: boolean): Promise<void> {
  await nextTick()
  const element = dialog.value
  if (!element) return
  if (open && !element.open) element.showModal()
  if (!open && element.open) element.close()
  document.documentElement.style.overflow = open ? 'hidden' : ''
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value) emit('close')
}

watch(() => props.open, sync)
onMounted(() => {
  if (props.open) void sync(true)
})
onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-dialog"
    @cancel.prevent="emit('close')"
    @click="onBackdropClick"
  >
    <div class="flex max-h-[85dvh] flex-col">
      <header class="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <h2 :id="titleId" class="text-xl font-bold tracking-tight">{{ title }}</h2>
        <button
          type="button"
          class="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-paper"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="size-5" aria-hidden="true" />
        </button>
      </header>
      <div class="overflow-y-auto px-6 py-5 leading-relaxed">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="border-t border-line px-6 py-4">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>
