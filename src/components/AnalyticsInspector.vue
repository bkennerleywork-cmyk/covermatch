<script setup lang="ts">
import { computed } from 'vue'
import { useAnalytics, type DataLayerEntry } from '@/composables/useAnalytics'

// Portfolio aid: makes the otherwise invisible mock GTM stream visible to reviewers.
const { events } = useAnalytics()
const recent = computed(() => [...events.value].reverse().slice(0, 30))

function details(entry: DataLayerEntry): string {
  const { event, timestamp, ...rest } = entry
  return JSON.stringify(rest)
}
</script>

<template>
  <details class="rounded-lg border border-line text-sm">
    <summary class="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
      Developer view: dataLayer events ({{ events.length }})
    </summary>
    <div class="border-t border-line px-4 py-3">
      <p class="text-ink-soft">
        Mock Google Tag Manager stream, newest first. Health answers and contact details are never included.
      </p>
      <ol class="mt-3 max-h-64 space-y-2 overflow-y-auto">
        <li v-for="entry in recent" :key="entry.timestamp + entry.event" class="break-words font-mono text-xs">
          <span class="font-semibold">{{ entry.event }}</span>
          <span class="text-ink-soft"> {{ details(entry) }}</span>
        </li>
      </ol>
    </div>
  </details>
</template>
