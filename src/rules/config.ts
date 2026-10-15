/**
 * MADFU ONBOARDING — BUSINESS RULE CONFIGURATION
 *
 * Single authoritative, replaceable rule model. UI components never hard-code
 * eligibility decisions; they ask the decision functions in `./decisions.ts`,
 * which read only from this file and from `./categories.ts`.
 *
 * Every value marked PROVISIONAL is an assumption recorded in the decision
 * log (`./decisionLog.ts`), not a confirmed business rule.
 */

export type ApplicantType = 'CR' | 'FREELANCER';
export type RevenueBand = 'LT_100K' | 'R_100K_20M' | 'GT_20M';
export type Journey = 'SELF_ONBOARDING' | 'SALES_LEAD';

export const APPLICANT_TYPES: { value: ApplicantType; label: string }[] = [
  { value: 'CR', label: 'Registered Business' },
  { value: 'FREELANCER', label: 'Freelancer' },
];

/**
 * Revenue bands. Copy is written so there is no numeric gap or overlap:
 * exactly SAR 100,000 and exactly SAR 20,000,000 both fall in the middle band.
 * PROVISIONAL (D-01): the exact SAR 100,000 boundary is pending clarification.
 */
export const REVENUE_BANDS: { value: RevenueBand; label: string; rangeNote: string }[] = [
  { value: 'LT_100K', label: 'Below SAR 100,000', rangeNote: '< 100,000' },
  { value: 'R_100K_20M', label: 'SAR 100,000 to SAR 20,000,000', rangeNote: '≥ 100,000 and ≤ 20,000,000' },
  { value: 'GT_20M', label: 'Above SAR 20,000,000', rangeNote: '> 20,000,000' },
];

/** Revenue routing per applicant type (confirmed rule, boundary provisional). */
export const REVENUE_ROUTING: Record<ApplicantType, Record<RevenueBand, Journey>> = {
  CR: { LT_100K: 'SALES_LEAD', R_100K_20M: 'SELF_ONBOARDING', GT_20M: 'SALES_LEAD' },
  FREELANCER: { LT_100K: 'SELF_ONBOARDING', R_100K_20M: 'SELF_ONBOARDING', GT_20M: 'SELF_ONBOARDING' },
};

/**
 * Frontend STRUCTURAL validation only. These patterns are configurable
 * placeholders — they are NOT verified government format requirements.
 * Government validity is only established by the CR / identity integrations.
 */
export const IDENTIFICATION_RULES: Record<ApplicantType, { label: string; pattern: RegExp; hint: string; error: string }> = {
  CR: {
    label: 'Commercial Registration Number (CR)',
    pattern: /^\d{10}$/,
    hint: '10 digits (configurable structural rule)',
    error: 'Enter a valid Commercial Registration number (10 digits).',
  },
  FREELANCER: {
    label: 'National ID Number',
    pattern: /^[12]\d{9}$/,
    hint: '10 digits (configurable structural rule)',
    error: 'Enter a valid National ID number (10 digits).',
  },
};

export const MOBILE_RULES = {
  countryCode: '+966',
  countryLabel: 'Saudi Arabia',
  /** Accepts 5XXXXXXXX or 05XXXXXXXX; stored normalised as 5XXXXXXXX. */
  pattern: /^0?5\d{8}$/,
  error: 'Enter a valid Saudi mobile number, e.g. 5X XXX XXXX.',
};

/** OTP policy. PROVISIONAL (D-04): resend / expiry values are placeholders. */
export const OTP_POLICY = {
  codeLength: 6,
  maxIncorrectAttempts: 3,
  expirySeconds: 120,
  resendCooldownSeconds: 30,
  maxResends: 3,
  /** Whether a resend resets the incorrect-attempt counter. */
  resendResetsAttempts: false,
};

/** Government CR lookup retry policy. PROVISIONAL (D-08). */
export const GOV_POLICY = {
  /** Silent automatic retries on a temporary failure before the user sees a recovery state. */
  autoRetries: 2,
  /** Manual "Try again" presses allowed before the save-and-exit state is offered. */
  maxManualRetries: 3,
};

/** Nafath policy (confirmed: 2 attempts per application, shared across individuals). */
export const NAFATH_POLICY = {
  maxAttemptsPerApplication: 2,
  /** Changing the selected authorised person never resets the counter. */
  counterSharedAcrossIndividuals: true,
  /**
   * PROVISIONAL (D-11): a technical failure (request could not be created) does not
   * consume a verification attempt, but is bounded. Rejected and timed-out requests do.
   */
  technicalFailureConsumesAttempt: false,
  maxTechnicalFailures: 3,
};

/** IBAN ownership verification policy (confirmed: 2 unsuccessful attempts then continue). */
export const IBAN_POLICY = {
  maxUnsuccessfulOwnershipAttempts: 2,
  /** PROVISIONAL (D-10): provider outage is modelled separately from a "not verified" result. */
  maxTechnicalErrors: 3,
  /** Call the ownership API when Nafath was NOT verified? */
  verifyWhenNafathUnverified: {
    FREELANCER: false, // confirmed: collect IBAN only, do not call the API
    CR: false, // PROVISIONAL (D-12): avoid cost; application goes to manual review anyway
  } as Record<ApplicantType, boolean>,
};

/** Category screening behaviour. PROVISIONAL (D-05, D-13). */
export const CATEGORY_POLICY = {
  /** What a "Pending manual business review" classification does before any paid call. */
  manualReviewBehaviour: 'STOP_AS_LEAD' as 'STOP_AS_LEAD' | 'CONTINUE_WITH_FLAG',
  /** Freelancer selecting a CR-only subcategory: never auto-reject; continue with a flag. */
  crOnlyFreelancerBehaviour: 'CONTINUE_WITH_FLAG' as const,
};

/**
 * Review flags that, in addition to an unverified Nafath, keep the contract
 * unavailable and route the application to manual verification.
 * PROVISIONAL (D-06): unresolved certificate-eligibility cases stay in manual review.
 */
export const CONTRACT_BLOCKING_FLAGS = [
  'CERT_EXPIRED',
  'CERT_INCONSISTENT',
  'CERT_NOT_FOUND_MANUAL_ENTRY',
  'CERT_MANUAL_ENTRY_UNVERIFIED',
  'NO_ELIGIBLE_AUTHORISED_PERSON',
] as const;

export const VAT_RULES = {
  pattern: /^3\d{13}3$/,
  error: 'Enter a valid 15-digit VAT registration number (configurable rule).',
  hint: '15 digits, starts and ends with 3 (configurable structural rule)',
};

export const URL_RULES = {
  website: { pattern: /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i, error: 'Enter a valid website URL starting with https://' },
  maps: {
    pattern: /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*$/i,
    error: 'Enter a valid Google Maps link for one branch.',
  },
};

/** Freelancing certificate number — structural placeholder for manual entry (PROVISIONAL). */
export const CERTIFICATE_RULES = {
  pattern: /^FL-\d{9}$/,
  hint: 'Format: FL-XXXXXXXXX (configurable structural rule)',
  error: 'Enter a valid freelancing certificate number, e.g. FL-000000000.',
};

export const BRANCH_OPTIONS = [
  { value: '1', label: '1 branch' },
  { value: '2-3', label: '2–3 branches' },
  { value: '4+', label: 'More than 3 branches' },
] as const;

/** Third-party services that incur a per-call cost (used by the cost ledger). */
export const PAID_SERVICES = ['GOV_CR_LOOKUP', 'NAFATH_REQUEST', 'CERTIFICATE_LOOKUP', 'IBAN_OWNERSHIP'] as const;
export type PaidService = (typeof PAID_SERVICES)[number];
