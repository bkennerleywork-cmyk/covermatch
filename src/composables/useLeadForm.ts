import { computed, reactive } from 'vue'

export interface LeadFields {
  firstName: string
  lastName: string
  email: string
  phone: string
  postcode: string
  consent: boolean
  marketing: boolean
}

export type LeadFieldName = 'firstName' | 'lastName' | 'email' | 'phone' | 'postcode' | 'consent'
export type LeadErrors = Partial<Record<LeadFieldName, string>>

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' .-]*$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Mobiles (07) always have 11 digits including the 0. Some older landlines have 10.
const UK_PHONE_PATTERN = /^(?:\+44|0044|0)(?:7\d{9}|[1-35689]\d{8,9})$/
const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/

export const normalisePhone = (value: string): string => value.replace(/[\s()-]/g, '')

export const normalisePostcode = (value: string): string => {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact
}

function validateName(value: string, label: string): string | undefined {
  const name = value.trim()
  if (!name) return `Enter your ${label}.`
  if (name.length > 60) return `Your ${label} must be 60 characters or fewer.`
  if (!NAME_PATTERN.test(name)) {
    return `Your ${label} can only include letters, spaces, hyphens and apostrophes.`
  }
  return undefined
}

export const validators: Record<LeadFieldName, (fields: LeadFields) => string | undefined> = {
  firstName: ({ firstName }) => validateName(firstName, 'first name'),
  lastName: ({ lastName }) => validateName(lastName, 'last name'),
  email: ({ email }) => {
    const value = email.trim()
    if (!value) return 'Enter your email address.'
    return EMAIL_PATTERN.test(value)
      ? undefined
      : 'Enter an email address in the format name@example.com.'
  },
  phone: ({ phone }) => {
    const value = normalisePhone(phone)
    if (!value) return 'Enter your phone number.'
    return UK_PHONE_PATTERN.test(value)
      ? undefined
      : 'Enter a UK phone number, such as 07700 900123.'
  },
  postcode: ({ postcode }) => {
    if (!postcode.trim()) return 'Enter your postcode.'
    return UK_POSTCODE_PATTERN.test(normalisePostcode(postcode))
      ? undefined
      : 'Enter a full UK postcode, such as SW1A 1AA.'
  },
  consent: ({ consent }) =>
    consent ? undefined : 'Tick the box so that we can use your answers to prepare your quote.',
}

/** Field order here sets which invalid field receives focus first. */
export const LEAD_FIELD_ORDER: readonly LeadFieldName[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'postcode',
  'consent',
]

export function validateLead(fields: LeadFields): LeadErrors {
  const errors: LeadErrors = {}
  for (const name of LEAD_FIELD_ORDER) {
    const message = validators[name](fields)
    if (message) errors[name] = message
  }
  return errors
}

const initialFields = (): LeadFields => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  postcode: '',
  consent: false,
  marketing: false,
})

export function useLeadForm() {
  const fields = reactive<LeadFields>(initialFields())
  // Errors appear on blur, not while someone is still typing, and clear as soon as they are fixed.
  const touched = reactive<Partial<Record<LeadFieldName, boolean>>>({})

  const allErrors = computed(() => validateLead(fields))
  const visibleErrors = computed<LeadErrors>(() => {
    const errors: LeadErrors = {}
    for (const name of LEAD_FIELD_ORDER) {
      if (touched[name] && allErrors.value[name]) errors[name] = allErrors.value[name]
    }
    return errors
  })

  const touch = (name: LeadFieldName): void => {
    touched[name] = true
  }

  /** Reveals every error and returns the first invalid field, or null when the form is valid. */
  function validateAll(): LeadFieldName | null {
    LEAD_FIELD_ORDER.forEach(touch)
    return LEAD_FIELD_ORDER.find((name) => allErrors.value[name]) ?? null
  }

  function reset(): void {
    Object.assign(fields, initialFields())
    for (const name of LEAD_FIELD_ORDER) delete touched[name]
  }

  return { fields, errors: visibleErrors, touch, validateAll, reset }
}
