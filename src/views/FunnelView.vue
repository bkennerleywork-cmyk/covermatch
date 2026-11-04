<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Cigarette,
  CigaretteOff,
  Info,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnalyticsInspector from '@/components/AnalyticsInspector.vue'
import Button from '@/components/Button.vue'
import InputField from '@/components/InputField.vue'
import Modal from '@/components/Modal.vue'
import PriceSummaryCard from '@/components/PriceSummaryCard.vue'
import SliderField from '@/components/SliderField.vue'
import StepIndicator from '@/components/StepIndicator.vue'
import ToggleCard from '@/components/ToggleCard.vue'
import {
  bandAmount,
  useAnalytics,
  type FunnelStepName,
} from '@/composables/useAnalytics'
import { normalisePhone, normalisePostcode, useLeadForm, type LeadFieldName } from '@/composables/useLeadForm'
import {
  AGE_MAX,
  AGE_MIN,
  CRITICAL_ILLNESS_MAX_AGE,
  CRITICAL_ILLNESS_MIN,
  CRITICAL_ILLNESS_STEP,
  formatPence,
  formatPounds,
  isValidAge,
  MAX_AGE_AT_EXPIRY,
  MEDICAL_CONDITIONS,
  PAYOUT_MAX,
  PAYOUT_MIN,
  PAYOUT_STEP,
  TERM_MIN,
  useQuoteCalculator,
  WAIVER_LOADING,
  WAIVER_MAX_AGE,
} from '@/composables/useQuoteCalculator'
import { dispatchLead, type CrmLeadPayload } from '@/services/crmClient'

const STEP_NAMES: readonly FunnelStepName[] = ['coverage', 'health', 'customise', 'lead']

const STEP_HEADINGS = [
  'How much cover do you need?',
  'A few questions about your health',
  'Make the quote fit',
  'Where should we send your quote?',
] as const

const route = useRoute()
const router = useRouter()
const { track, getVariant } = useAnalytics()

const defaultBilling = getVariant('default_billing')
const healthCtaVariant = getVariant('health_cta_copy')
const healthCta = healthCtaVariant === 'see_my_price' ? 'See my price' : 'Show my quote'

const quote = useQuoteCalculator(defaultBilling)
const { state, billing, breakdown } = quote
const lead = useLeadForm()

/* Step navigation: the step lives in the URL so that the browser Back button works. */
const maxReached = ref(1)

const step = computed(() => {
  const requested = Number(route.query.step ?? 1)
  if (!Number.isInteger(requested) || requested < 1) return 1
  // Answers live in memory only, so a reload or deep link cannot skip unanswered steps.
  return Math.min(requested, maxReached.value)
})

function goTo(target: number): void {
  maxReached.value = Math.max(maxReached.value, target)
  void router.push({ query: { ...route.query, step: String(target) } })
}

watch(
  step,
  (current) => {
    track({ event: 'funnel_step_view', step: current, step_name: STEP_NAMES[current - 1]! })
    if (current === 3) {
      track({
        event: 'quote_viewed',
        payout_band: bandAmount(state.payout, 50_000),
        term_years: state.termYears,
        billing: billing.value,
      })
    }
  },
  { immediate: true },
)

/**
 * Runs once the new step is in the DOM, which with an out-in transition is later than nextTick.
 * It moves screen reader and keyboard users to the new heading, not a button that has gone.
 */
function onStepEntered(element: Element): void {
  window.scrollTo({ top: 0 })
  element.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
}

function completeStep(current: number): void {
  track({ event: 'funnel_step_complete', step: current, step_name: STEP_NAMES[current - 1]! })
  goTo(current + 1)
}

function reportStepError(current: number, fieldCount: number): void {
  track({
    event: 'funnel_step_error',
    step: current,
    step_name: STEP_NAMES[current - 1]!,
    field_count: fieldCount,
  })
}

/* Step 1 */
const ageInput = ref('')
const ageTouched = ref(false)
const ageField = ref<InstanceType<typeof InputField> | null>(null)

watch(ageInput, (value) => {
  const trimmed = value.trim()
  state.age = /^\d+$/.test(trimmed) ? Number(trimmed) : null
})

const ageError = computed(() => {
  if (!ageTouched.value) return undefined
  if (!ageInput.value.trim()) return 'Enter your age.'
  if (!isValidAge(state.age)) return `Enter an age between ${AGE_MIN} and ${AGE_MAX}, in whole years.`
  return undefined
})

function submitCoverage(): void {
  ageTouched.value = true
  if (ageError.value) {
    reportStepError(1, 1)
    ageField.value?.focus()
    return
  }
  completeStep(1)
}

const termHint = computed(() =>
  quote.maxTerm.value < 40
    ? `At your age, cover can run for up to ${quote.maxTerm.value} years, finishing by your ${MAX_AGE_AT_EXPIRY}th birthday.`
    : 'Many people match this to their mortgage or to when their children will be independent.',
)

/* Step 2 */
const healthAttempted = ref(false)
const smokerError = computed(() =>
  healthAttempted.value && state.isSmoker === null ? 'Tell us whether you use nicotine.' : undefined,
)
const conditionsError = computed(() =>
  healthAttempted.value && state.conditions.length === 0 && !state.noConditions
    ? 'Choose any that apply, or choose "None of these".'
    : undefined,
)

const smokerGroup = ref<HTMLElement | null>(null)
const conditionsGroup = ref<HTMLElement | null>(null)

function submitHealth(): void {
  healthAttempted.value = true
  const errors = [smokerError.value, conditionsError.value].filter(Boolean)
  if (errors.length) {
    reportStepError(2, errors.length)
    const target = smokerError.value ? smokerGroup.value : conditionsGroup.value
    target?.querySelector('input')?.focus()
    return
  }
  completeStep(2)
}

/* Step 3 */
function setCriticalIllness(enabled: boolean): void {
  state.criticalIllness = enabled
  track({ event: 'addon_toggled', addon: 'critical_illness', enabled })
}

function setWaiver(enabled: boolean): void {
  state.waiverOfPremium = enabled
  track({ event: 'addon_toggled', addon: 'waiver_of_premium', enabled })
}

const costLabel = (pence: number | null): string =>
  pence === null ? '' : `+${formatPence(pence)} a month`

function setBilling(value: typeof billing.value): void {
  billing.value = value
  track({ event: 'billing_changed', billing: value })
}

/* Step 4 */
type SubmitStatus = 'idle' | 'sending' | 'failed' | 'sent'
const submitStatus = ref<SubmitStatus>('idle')
const reference = ref('')
const sentPayload = ref<CrmLeadPayload | null>(null)
const failureAlert = ref<HTMLElement | null>(null)

const fieldRefs: Partial<Record<LeadFieldName, { focus: () => void } | null>> = {}
const consentInput = ref<HTMLInputElement | null>(null)

function focusField(name: LeadFieldName): void {
  if (name === 'consent') consentInput.value?.focus()
  else fieldRefs[name]?.focus()
}

function buildPayload(): CrmLeadPayload {
  const now = new Date().toISOString()
  const premium = breakdown.value!
  return {
    source: 'covermatch-web-funnel',
    submittedAt: now,
    contact: {
      firstName: lead.fields.firstName.trim(),
      lastName: lead.fields.lastName.trim(),
      email: lead.fields.email.trim().toLowerCase(),
      phone: normalisePhone(lead.fields.phone),
      postcode: normalisePostcode(lead.fields.postcode),
    },
    consent: {
      quoteProcessing: lead.fields.consent,
      marketing: lead.fields.marketing,
      capturedAt: now,
    },
    quote: {
      payout: state.payout,
      termYears: state.termYears,
      age: state.age!,
      isSmoker: state.isSmoker === true,
      conditions: [...state.conditions],
      criticalIllnessAmount: state.criticalIllness ? state.criticalIllnessAmount : null,
      waiverOfPremium: state.waiverOfPremium,
      billing: billing.value,
      monthlyPence: premium.monthlyPence,
      annualPence: premium.annualPence,
      needsUnderwriterReview: premium.needsUnderwriterReview,
    },
    experiments: {
      health_cta_copy: healthCtaVariant,
      default_billing: defaultBilling,
    },
  }
}

async function submitLead(): Promise<void> {
  if (submitStatus.value === 'sending') return

  const firstInvalid = lead.validateAll()
  if (firstInvalid) {
    reportStepError(4, Object.keys(lead.errors.value).length)
    focusField(firstInvalid)
    return
  }

  submitStatus.value = 'sending'
  const payload = buildPayload()
  try {
    const response = await dispatchLead(payload)
    reference.value = response.reference
    sentPayload.value = payload
    submitStatus.value = 'sent'
    track({ event: 'funnel_step_complete', step: 4, step_name: 'lead' })
    track({
      event: 'lead_submitted',
      lead_reference: response.reference,
      premium_band: bandAmount(payload.quote.monthlyPence / 100, 25),
    })
  } catch {
    submitStatus.value = 'failed'
    track({ event: 'lead_failed', reason: 'network' })
    await nextTick()
    failureAlert.value?.focus()
  }
}

function startAgain(): void {
  quote.reset()
  lead.reset()
  ageInput.value = ''
  ageTouched.value = false
  healthAttempted.value = false
  submitStatus.value = 'idle'
  reference.value = ''
  sentPayload.value = null
  maxReached.value = 1
  void router.push({ query: { ...route.query, step: '1' } })
}

const isSent = computed(() => submitStatus.value === 'sent')

/* Modals */
type ModalName = 'cover' | 'critical-illness' | 'waiver' | 'terms'
const modalTitles: Record<ModalName, string> = {
  cover: 'How life cover works',
  'critical-illness': 'What critical illness cover includes',
  waiver: 'How waiver of premium works',
  terms: 'Terms and how we use your information',
}
const activeModal = ref<ModalName | null>(null)
const lastModal = ref<ModalName>('cover')

function openModal(name: ModalName): void {
  lastModal.value = name
  activeModal.value = name
  track({ event: 'modal_opened', modal: name })
}

onBeforeUnmount(() => {
  activeModal.value = null
})
</script>

<template>
  <div class="min-h-dvh lg:pb-0" :class="isSent ? 'pb-8' : 'pb-40'">
    <header class="border-b border-line">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <span class="flex items-center gap-2 text-lg font-bold tracking-tight">
          <svg viewBox="0 0 32 32" class="size-7" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0b3a2d" />
            <path d="M16 6.5 24.5 10v6.200c0 4.900-3.400 8-8.500 9.500-5.100-1.500-8.500-4.600-8.500-9.500V10z" fill="none" stroke="#f2b632" stroke-width="2.400" stroke-linejoin="round" />
            <path d="m12 16 3 3 5.200-5.800" fill="none" stroke="#fbfaf6" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          CoverMatch
        </span>
        <span class="text-right text-sm text-ink-soft">Demo: not a real insurer</span>
      </div>
    </header>

    <div class="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <StepIndicator
        v-if="!isSent"
        :current="step"
        :max-reached="maxReached"
        class="lg:max-w-[calc(100%-25rem)]"
        @navigate="goTo"
      />

      <div class="mt-6 grid items-start gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <main class="min-w-0 max-w-2xl">
          <Transition name="step" mode="out-in" @enter="onStepEntered">
            <!-- Success -->
            <section v-if="isSent" key="sent" data-testid="success">
              <CircleCheck class="size-10 text-pine-700" aria-hidden="true" />
              <h1 tabindex="-1" class="mt-3 text-3xl font-bold tracking-tight focus:outline-none sm:text-4xl">
                Thanks, {{ sentPayload?.contact.firstName }}. Your quote is saved.
              </h1>
              <p class="mt-3 text-lg text-ink-soft">
                In a live service, an adviser would now contact you on the details you gave. This is a demo, so nobody will call.
              </p>
              <dl class="mt-6 grid gap-4 rounded-xl border-[1.5px] border-line bg-surface p-5 sm:grid-cols-2">
                <div>
                  <dt class="text-sm text-ink-soft">Your reference</dt>
                  <dd class="tabular text-xl font-bold" data-testid="reference">{{ reference }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-ink-soft">Your estimated price</dt>
                  <dd class="tabular text-xl font-bold" data-testid="final-price">
                    {{ formatPence(quote.displayPence.value ?? 0) }} {{ billing === 'monthly' ? 'a month' : 'a year' }}
                  </dd>
                </div>
              </dl>
              <p v-if="breakdown?.needsUnderwriterReview" class="mt-4 flex items-start gap-2 text-ink-soft">
                <Info class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                Because of your health answers, an underwriter would need to review this price before cover could start.
              </p>
              <details class="mt-6 rounded-lg border border-line text-sm">
                <summary class="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
                  Developer view: mock CRM payload
                </summary>
                <pre class="overflow-x-auto border-t border-line p-4 font-mono text-xs" data-testid="crm-payload">{{ JSON.stringify(sentPayload, null, 2) }}</pre>
              </details>
              <div class="mt-8">
                <Button variant="outline" @click="startAgain">Start another quote</Button>
              </div>
            </section>

            <!-- Step 1: Coverage needs -->
            <form v-else-if="step === 1" key="1" novalidate @submit.prevent="submitCoverage">
              <h1 tabindex="-1" class="text-3xl font-bold tracking-tight focus:outline-none sm:text-4xl">{{ STEP_HEADINGS[0] }}</h1>
              <p class="mt-3 text-lg text-ink-soft">
                Life cover pays a lump sum to the people you choose if you die during the policy.
                <button type="button" class="link" @click="openModal('cover')">How it works</button>
              </p>

              <div class="mt-8 space-y-8">
                <SliderField
                  v-model="state.payout"
                  label="Payout"
                  :min="PAYOUT_MIN"
                  :max="PAYOUT_MAX"
                  :step="PAYOUT_STEP"
                  :format="formatPounds"
                  hint="A common starting point is enough to clear your mortgage, plus a few years of income."
                />
                <SliderField
                  v-model="state.termYears"
                  label="Length of cover"
                  :min="TERM_MIN"
                  :max="quote.maxTerm.value"
                  :format="(years: number) => `${years} years`"
                  :hint="termHint"
                />
                <div class="max-w-56">
                  <InputField
                    ref="ageField"
                    v-model="ageInput"
                    label="Your age"
                    name="age"
                    inputmode="numeric"
                    autocomplete="off"
                    suffix="years"
                    required
                    :maxlength="3"
                    :error="ageError"
                    @blur="ageTouched = ageInput.trim() !== '' || ageTouched"
                  />
                </div>
              </div>

              <div class="mt-10">
                <Button type="submit">
                  Continue
                  <ArrowRight class="size-5" aria-hidden="true" />
                </Button>
              </div>
            </form>

            <!-- Step 2: Lifestyle and health -->
            <form v-else-if="step === 2" key="2" novalidate @submit.prevent="submitHealth">
              <h1 tabindex="-1" class="text-3xl font-bold tracking-tight focus:outline-none sm:text-4xl">{{ STEP_HEADINGS[1] }}</h1>
              <p class="mt-3 text-lg text-ink-soft">
                Your answers shape your price. They are never sent to our analytics tools.
              </p>

              <fieldset ref="smokerGroup" class="mt-8" :aria-describedby="smokerError ? 'smoker-error' : undefined">
                <legend class="text-lg font-semibold">Have you used nicotine in the last 12 months?</legend>
                <p class="mt-0.5 text-sm text-ink-soft">This includes cigarettes, vapes, patches and gum.</p>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <ToggleCard
                    type="radio"
                    name="smoker"
                    title="No"
                    description="I have not used nicotine"
                    :icon="CigaretteOff"
                    :model-value="state.isSmoker === false"
                    @update:model-value="state.isSmoker = false"
                  />
                  <ToggleCard
                    type="radio"
                    name="smoker"
                    title="Yes"
                    description="I have used nicotine"
                    :icon="Cigarette"
                    :model-value="state.isSmoker === true"
                    @update:model-value="state.isSmoker = true"
                  />
                </div>
                <p v-if="smokerError" id="smoker-error" class="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
                  <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {{ smokerError }}
                </p>
              </fieldset>

              <fieldset ref="conditionsGroup" class="mt-8" :aria-describedby="conditionsError ? 'conditions-error' : undefined">
                <legend class="text-lg font-semibold">Have you ever been diagnosed with any of these?</legend>
                <p class="mt-0.5 text-sm text-ink-soft">Choose all that apply.</p>
                <div class="mt-3 grid gap-3">
                  <ToggleCard
                    v-for="condition in MEDICAL_CONDITIONS"
                    :key="condition.id"
                    :title="condition.label"
                    :description="condition.description"
                    :model-value="state.conditions.includes(condition.id)"
                    @update:model-value="quote.toggleCondition(condition.id, $event)"
                  />
                  <ToggleCard
                    title="None of these"
                    :model-value="state.noConditions"
                    @update:model-value="quote.setNoConditions($event)"
                  />
                </div>
                <p v-if="conditionsError" id="conditions-error" class="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
                  <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {{ conditionsError }}
                </p>
              </fieldset>

              <p v-if="breakdown?.needsUnderwriterReview" class="mt-4 flex items-start gap-2 rounded-lg bg-marigold-soft p-3.5 text-sm" data-testid="review-notice">
                <Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                An underwriter would need to review this answer, so your final price could change.
              </p>

              <div class="mt-10 flex flex-wrap gap-3">
                <Button variant="outline" @click="goTo(1)">
                  <ArrowLeft class="size-5" aria-hidden="true" />
                  Back
                </Button>
                <Button type="submit">
                  {{ healthCta }}
                  <ArrowRight class="size-5" aria-hidden="true" />
                </Button>
              </div>
            </form>

            <!-- Step 3: Quote and customisation -->
            <form v-else-if="step === 3" key="3" novalidate @submit.prevent="completeStep(3)">
              <h1 tabindex="-1" class="text-3xl font-bold tracking-tight focus:outline-none sm:text-4xl">{{ STEP_HEADINGS[2] }}</h1>
              <p class="mt-3 text-lg text-ink-soft">
                Adjust your cover and add extras. Your price updates as you go.
              </p>

              <div class="mt-8 space-y-8">
                <SliderField
                  v-model="state.payout"
                  label="Payout"
                  :min="PAYOUT_MIN"
                  :max="PAYOUT_MAX"
                  :step="PAYOUT_STEP"
                  :format="formatPounds"
                />
                <SliderField
                  v-model="state.termYears"
                  label="Length of cover"
                  :min="TERM_MIN"
                  :max="quote.maxTerm.value"
                  :format="(years: number) => `${years} years`"
                />
              </div>

              <h2 class="mt-10 text-xl font-bold tracking-tight">Optional extras</h2>
              <div class="mt-3 grid gap-3">
                <ToggleCard
                  data-testid="critical-illness"
                  title="Critical illness cover"
                  description="Pays a lump sum if you are diagnosed with a serious illness we cover."
                  :model-value="state.criticalIllness"
                  :disabled="!quote.criticalIllnessAvailable.value"
                  :disabled-reason="`Available if you are ${CRITICAL_ILLNESS_MAX_AGE} or under.`"
                  @update:model-value="setCriticalIllness"
                >
                  <template v-if="quote.criticalIllnessAvailable.value" #aside>
                    {{ costLabel(quote.criticalIllnessCost.value) }}
                  </template>
                </ToggleCard>
                <div v-if="state.criticalIllness" class="rounded-xl border-[1.5px] border-line bg-surface p-4">
                  <SliderField
                    v-model="state.criticalIllnessAmount"
                    label="Critical illness payout"
                    :min="CRITICAL_ILLNESS_MIN"
                    :max="quote.criticalIllnessMax.value"
                    :step="CRITICAL_ILLNESS_STEP"
                    :format="formatPounds"
                  />
                </div>
                <button type="button" class="link justify-self-start text-sm" @click="openModal('critical-illness')">
                  What critical illness cover includes
                </button>

                <ToggleCard
                  data-testid="waiver"
                  class="mt-2"
                  title="Waiver of premium"
                  description="We pay your premiums if illness or injury stops you working for more than 6 months."
                  :model-value="state.waiverOfPremium"
                  :disabled="!quote.waiverAvailable.value"
                  :disabled-reason="`Available if you are ${WAIVER_MAX_AGE} or under.`"
                  @update:model-value="setWaiver"
                >
                  <template v-if="quote.waiverAvailable.value" #aside>
                    {{ costLabel(quote.waiverCost.value) }}
                  </template>
                </ToggleCard>
                <button type="button" class="link justify-self-start text-sm" @click="openModal('waiver')">
                  How waiver of premium works
                </button>
              </div>

              <div class="mt-10 flex flex-wrap gap-3">
                <Button variant="outline" @click="goTo(2)">
                  <ArrowLeft class="size-5" aria-hidden="true" />
                  Back
                </Button>
                <Button type="submit">
                  Save my quote
                  <ArrowRight class="size-5" aria-hidden="true" />
                </Button>
              </div>
            </form>

            <!-- Step 4: Lead capture -->
            <form v-else key="4" novalidate @submit.prevent="submitLead">
              <h1 tabindex="-1" class="text-3xl font-bold tracking-tight focus:outline-none sm:text-4xl">{{ STEP_HEADINGS[3] }}</h1>
              <p class="mt-3 text-lg text-ink-soft">
                We will save this price and arrange a call to talk it through. There is no obligation to buy.
              </p>

              <div
                v-if="submitStatus === 'failed'"
                ref="failureAlert"
                tabindex="-1"
                role="alert"
                class="mt-6 flex items-start gap-2 rounded-lg bg-danger-soft p-4 text-danger focus:outline-none"
                data-testid="submit-error"
              >
                <CircleAlert class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <span>We could not save your quote. Your answers are still here, so please try again.</span>
              </div>

              <div class="mt-8 grid gap-5 sm:grid-cols-2">
                <InputField
                  :ref="(el) => (fieldRefs.firstName = el as InstanceType<typeof InputField> | null)"
                  v-model="lead.fields.firstName"
                  label="First name"
                  name="firstName"
                  autocomplete="given-name"
                  required
                  :error="lead.errors.value.firstName"
                  @blur="lead.touch('firstName')"
                />
                <InputField
                  :ref="(el) => (fieldRefs.lastName = el as InstanceType<typeof InputField> | null)"
                  v-model="lead.fields.lastName"
                  label="Last name"
                  name="lastName"
                  autocomplete="family-name"
                  required
                  :error="lead.errors.value.lastName"
                  @blur="lead.touch('lastName')"
                />
                <InputField
                  :ref="(el) => (fieldRefs.email = el as InstanceType<typeof InputField> | null)"
                  v-model="lead.fields.email"
                  class="sm:col-span-2"
                  label="Email address"
                  type="email"
                  name="email"
                  autocomplete="email"
                  required
                  :error="lead.errors.value.email"
                  @blur="lead.touch('email')"
                />
                <InputField
                  :ref="(el) => (fieldRefs.phone = el as InstanceType<typeof InputField> | null)"
                  v-model="lead.fields.phone"
                  label="Phone number"
                  type="tel"
                  name="phone"
                  autocomplete="tel"
                  required
                  :error="lead.errors.value.phone"
                  @blur="lead.touch('phone')"
                />
                <InputField
                  :ref="(el) => (fieldRefs.postcode = el as InstanceType<typeof InputField> | null)"
                  v-model="lead.fields.postcode"
                  label="Postcode"
                  name="postcode"
                  autocomplete="postal-code"
                  required
                  :maxlength="8"
                  :error="lead.errors.value.postcode"
                  @blur="lead.touch('postcode')"
                />
              </div>

              <div class="mt-6 space-y-4">
                <div>
                  <label class="flex cursor-pointer items-start gap-3">
                    <input
                      ref="consentInput"
                      v-model="lead.fields.consent"
                      type="checkbox"
                      name="consent"
                      class="mt-0.5 size-6 shrink-0 cursor-pointer accent-pine-800"
                      :aria-invalid="lead.errors.value.consent ? 'true' : undefined"
                      :aria-describedby="lead.errors.value.consent ? 'consent-error' : undefined"
                      @change="lead.touch('consent')"
                    />
                    <span>I agree that CoverMatch can use my contact details and health answers to prepare my quote.</span>
                  </label>
                  <p class="ml-9 mt-1 text-sm">
                    <button type="button" class="link" @click="openModal('terms')">Read the terms and how we use your information</button>
                  </p>
                  <p v-if="lead.errors.value.consent" id="consent-error" class="ml-9 mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
                    <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {{ lead.errors.value.consent }}
                  </p>
                </div>
                <label class="flex cursor-pointer items-start gap-3">
                  <input
                    v-model="lead.fields.marketing"
                    type="checkbox"
                    name="marketing"
                    class="mt-0.5 size-6 shrink-0 cursor-pointer accent-pine-800"
                  />
                  <span>Send me occasional tips and offers by email. <span class="text-ink-soft">(optional)</span></span>
                </label>
              </div>

              <div class="mt-10 flex flex-wrap gap-3">
                <Button variant="outline" :disabled="submitStatus === 'sending'" @click="goTo(3)">
                  <ArrowLeft class="size-5" aria-hidden="true" />
                  Back
                </Button>
                <Button type="submit" :loading="submitStatus === 'sending'" loading-label="Saving your quote">
                  {{ submitStatus === 'failed' ? 'Try again' : 'Save my quote and request a call' }}
                </Button>
              </div>
            </form>
          </Transition>

          <div class="mt-12 lg:mb-12">
            <AnalyticsInspector />
          </div>
        </main>

        <PriceSummaryCard
          v-if="!isSent"
          :breakdown="breakdown"
          :billing="billing"
          :payout="state.payout"
          :term-years="state.termYears"
          :critical-illness-amount="state.criticalIllness ? state.criticalIllnessAmount : null"
          @update:billing="setBilling"
        />
      </div>
    </div>

    <Modal :open="activeModal !== null" :title="modalTitles[lastModal]" @close="activeModal = null">
      <div v-if="lastModal === 'cover'" class="space-y-3">
        <p>You choose a payout and how long the cover lasts. If you die during that time, the policy pays the lump sum to the people you choose.</p>
        <p>If you outlive the policy, it ends and nothing is paid. You pay the same premium each month for the full length of the cover.</p>
        <p>Many people use it to clear a mortgage or replace lost income for their family.</p>
      </div>
      <div v-else-if="lastModal === 'critical-illness'" class="space-y-3">
        <p>This pays a lump sum if you are diagnosed with a covered illness during the policy. In a live product, the list of conditions and definitions would come from the policy document.</p>
        <p>Typical conditions on UK policies include:</p>
        <ul class="list-disc space-y-1 pl-5">
          <li>Cancer above a stated severity</li>
          <li>Heart attack of a specified severity</li>
          <li>Stroke with lasting symptoms</li>
          <li>Multiple sclerosis with persisting symptoms</li>
        </ul>
        <p>The payout can be up to your life cover amount, with a maximum of {{ formatPounds(quote.criticalIllnessMax.value) }} on your current quote.</p>
      </div>
      <div v-else-if="lastModal === 'waiver'" class="space-y-3">
        <p>If illness or injury stops you working for more than 6 months, the insurer pays your premiums until you can return to work or the policy ends.</p>
        <p>It keeps your cover in place when your income is under pressure. On this demo it adds {{ WAIVER_LOADING * 100 }}% to your premium.</p>
      </div>
      <div v-else class="space-y-3">
        <p><strong>This is a demo.</strong> CoverMatch is a developer portfolio project. It is not an insurer or a broker, and it is not authorised by the Financial Conduct Authority. Nothing here is an offer of insurance or financial advice.</p>
        <p><strong>What happens to your answers.</strong> They stay in this browser tab. The "CRM" is a simulated call, so nothing leaves your device. Please avoid entering real details.</p>
        <p><strong>In a live service,</strong> health answers are special category data under UK GDPR. They would be used only to prepare your quote, with your explicit consent, and you could withdraw that consent at any time.</p>
        <p><strong>Analytics</strong> records which steps people complete. It never includes health answers, smoker status, contact details or your exact price.</p>
      </div>
      <template #footer>
        <Button variant="primary" block @click="activeModal = null">Close</Button>
      </template>
    </Modal>
  </div>
</template>
