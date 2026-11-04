# CoverMatch

[![CI](https://github.com/bkennerleywork-cmyk/covermatch/actions/workflows/ci.yml/badge.svg)](https://github.com/bkennerleywork-cmyk/covermatch/actions/workflows/ci.yml)

A four-step life insurance quote and customisation funnel, built as a portfolio project with Vue 3, TypeScript and Tailwind CSS.

> **This is a demo.** CoverMatch is not an insurer or a broker and is not authorised by the FCA. Prices come from an illustrative model, nothing is an offer of insurance, and no data leaves the browser. The name and branding are fictional.

## The journey

| Step | What the customer does | What it demonstrates |
| --- | --- | --- |
| 1. Your cover | Sets payout (£50k to £750k), term and age | Sliders, live pricing, rules that depend on age |
| 2. Your health | Answers nicotine and medical questions | Toggle cards, exclusive options, underwriting triage |
| 3. Your quote | Adjusts cover, adds critical illness cover and waiver of premium | Real-time recalculation, per-add-on pricing, eligibility |
| 4. Your details | Enters contact details and consent | Inline validation, loading, failure and retry, success, mock CRM dispatch |

Two developer views are built into the page: one shows the live `dataLayer` stream, and the success screen shows the CRM payload.

To see the failure state, submit the form with any address ending in `@fail.test`. To force an A/B variant, add `?variant_default_billing=annual` or `?variant_health_cta_copy=show_my_quote` to the URL.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Vue 3 with Composition API and `<script setup>` |
| Language | TypeScript in strict mode, plus `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS 3, with a self-hosted variable font |
| Build | Vite |
| Tests | Vitest, Vue Test Utils, jsdom |
| Components | Storybook |
| Quality | ESLint and `vue-tsc` |
| Delivery | Docker, Docker Compose, GitHub Actions, GitLab CI |

## Getting started

Requires Node 22.22 or later, or Node 24.15 or later.

```bash
npm ci
```

```bash
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `vue-tsc` |
| `npm run test:run` | Run the tests once |
| `npm run test:coverage` | Run the tests with a coverage report |
| `npm run storybook` | Start Storybook on port 6006 |
| `npm run build-storybook` | Build static Storybook |

### Docker

```bash
docker compose up app
```

```bash
docker compose --profile tools up storybook
```

```bash
docker compose --profile tools run --rm test
```

The app is served on port 5173 and Storybook on port 6006. Building the image's `test` stage (`docker build --target test .`) fails if linting, types or tests fail.

## Architecture

```text
src/
├── components/          Design system, with no knowledge of the funnel
│   ├── Button.vue
│   ├── InputField.vue
│   ├── Modal.vue
│   ├── PriceSummaryCard.vue
│   ├── SliderField.vue
│   ├── StepIndicator.vue
│   ├── ToggleCard.vue
│   └── AnalyticsInspector.vue
├── composables/
│   ├── useQuoteCalculator.ts   Pure pricing function and reactive quote state
│   ├── useLeadForm.ts          Validation rules and form state
│   └── useAnalytics.ts         Mock GTM data layer and A/B assignment
├── services/crmClient.ts       Mock CRM endpoint
├── views/FunnelView.vue        Composes everything into the journey
├── router/                     The route and the catch-all redirect
├── stories/                    Storybook stories
└── tests/                      Unit, component and journey tests
```

Data flows one way. `FunnelView` owns the composables and passes values down through props, and components report changes through events. Pricing and validation are plain functions wrapped by composables, so they can be tested without mounting anything.

## Engineering decisions

**Money is calculated in whole pence.** Each line of the breakdown is rounded once and the total is the sum of those lines, so the figures on screen always add up. A test checks this across a range of inputs.

**No price is shown until the age is known.** Any earlier figure would be invented, and a price that jumps once the customer enters their age damages trust. The summary card prompts for the age instead.

**Earlier answers can narrow later ones.** Cover must end by age 90, critical illness cover cannot exceed the life cover, and add-ons have age limits. The composable pulls dependent answers back into range, and the pricing function clamps its inputs as a second line of defence.

**Health data stays out of analytics.** Tag managers forward data to third parties, and health answers are special category data under UK GDPR. The `AnalyticsEvent` union has no field that could carry them, payout and premium are sent as bands, and a journey test scans the whole `dataLayer` for health and contact values.

**Answers live in memory only.** Reloading the page restarts the journey. Persisting would help conversion, but keeping health answers in browser storage is a poor default, and I would want a proper design for it first. Only a random visitor ID is stored, to keep A/B variants stable.

**The step is in the URL.** The browser Back button works as people expect, and each step could become a virtual page view. Deep links cannot skip questions, because a requested step is capped at the furthest step reached.

**A/B assignment is deterministic.** Hashing the visitor ID with the experiment ID gives a stable variant with no assignment to store, and each experiment splits independently of the others.

**The modal uses the native `<dialog>` element.** It provides the focus trap, Esc handling, an inert background and focus restoration, all of which are easy to get wrong by hand.

**Accessibility is part of the components.** Focus moves to the new heading after each step change, and to the first invalid field on a failed submit. Sliders announce formatted values. Price changes are debounced before being announced, so dragging a slider does not flood a screen reader. Motion respects `prefers-reduced-motion`.

**Validation is timed to be helpful.** Errors appear on blur or submit, not while someone is typing, and clear as soon as the value is fixed. Name validation accepts any Unicode letter, so names such as Zoë and Nguyễn work.

## Testing

| Spec | Covers |
| --- | --- |
| `quoteCalculator.spec.ts` | Premium rules, eligibility, reactive state, validation rules |
| `analytics.spec.ts` | Data layer pushes, variant stability and spread, blocked storage |
| `components.spec.ts` | Component behaviour and accessibility wiring |
| `funnel.spec.ts` | The full journey, including CRM failure and the analytics privacy check |

jsdom has no layout engine and does not run CSS transitions or the native dialog, so those were checked by hand in a browser. Browser-based end-to-end tests would be the next addition.

## CI pipeline

The same checks are defined for two platforms: `.github/workflows/ci.yml` for GitHub Actions, and `.gitlab-ci.yml` for GitLab. The GitLab version runs three stages on merge requests and branches:

1. **quality:** `eslint` and `vue-tsc`
2. **test:** `vitest run` with coverage and JUnit reports, which GitLab shows on the merge request
3. **build:** the production app and static Storybook, kept as artifacts

## What a live version would need

- A real rating engine on the server. Client-side prices are for illustration only.
- FCA authorisation, or an appointed representative arrangement, and reviewed financial promotions.
- Real terms, a privacy notice, and consent records held on the server.
- A consent banner that controls whether tags load at all.
- Server-side validation and spam protection on the lead endpoint.
