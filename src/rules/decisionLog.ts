/**
 * DECISION LOG — distinguishes confirmed requirements from assumptions and
 * open questions. Rendered in the site, the PDF and docs/business-rules.
 */
export type DecisionType = 'Confirmed requirement' | 'Provisional assumption' | 'Product decision needed' | 'UX/UI decision needed' | 'Engineering integration question';

export interface DecisionItem {
  id: string;
  type: DecisionType;
  topic: string;
  statement: string;
  prototypeBehaviour?: string;
  owner?: string;
}

export const DECISIONS: DecisionItem[] = [
  // ---- Confirmed requirements (from the brief) ----
  {
    id: 'C-01',
    type: 'Confirmed requirement',
    topic: 'Applicant types',
    statement: 'Two applicant types (Registered Business, Freelancer) share one entry page; ID field switches with type; certificate number is not requested at entry.',
  },
  {
    id: 'C-02',
    type: 'Confirmed requirement',
    topic: 'Duplicate order',
    statement: 'Identity (CR / National ID) is checked first; if it exists the application stops before the mobile check. Mobile reuse across different identities is allowed.',
  },
  { id: 'C-03', type: 'Confirmed requirement', topic: 'OTP', statement: 'Maximum 3 incorrect OTP attempts; real codes are never displayed in normal UX.' },
  {
    id: 'C-04',
    type: 'Confirmed requirement',
    topic: 'Revenue routing',
    statement: 'CR below SAR 100K or above SAR 20M → sales lead after OTP. CR within range → self-onboarding. Freelancers → self-onboarding for all bands.',
  },
  {
    id: 'C-05',
    type: 'Confirmed requirement',
    topic: 'Category before paid checks',
    statement: 'Madfu category/subcategory is selected immediately after OTP, before CR retrieval and Nafath. Restricted categories stop self-onboarding without paid calls.',
  },
  {
    id: 'C-06',
    type: 'Confirmed requirement',
    topic: 'CR-only for freelancer',
    statement: 'A freelancer choosing a CR-only category is flagged, not rejected; final eligibility is a business decision.',
  },
  {
    id: 'C-07',
    type: 'Confirmed requirement',
    topic: 'Authorized persons',
    statement: 'Only individuals are shown; one selection; name (first/last visible) and ID (first 3/last 3 visible) masked.',
  },
  {
    id: 'C-08',
    type: 'Confirmed requirement',
    topic: 'Nafath attempts',
    statement: 'Maximum 2 Nafath attempts per application, shared across individuals; changing person does not reset the counter.',
  },
  {
    id: 'C-09',
    type: 'Confirmed requirement',
    topic: 'IBAN',
    statement:
      'Max 2 unsuccessful ownership checks; after that the applicant continues and the IBAN is queued for manual financial verification. IBAN failure never blocks the contract when Nafath succeeded.',
  },
  { id: 'C-10', type: 'Confirmed requirement', topic: 'Contract eligibility', statement: 'Successful Nafath is the deciding factor; without it the contract is not available.' },
  {
    id: 'C-11',
    type: 'Confirmed requirement',
    topic: 'Freelancer without Nafath',
    statement: 'After 2 unsuccessful attempts: manual certificate number, business details, IBAN without ownership API, no contract, manual verification.',
  },
  {
    id: 'C-12',
    type: 'Confirmed requirement',
    topic: 'User-facing outcomes',
    statement: 'Three neutral outcomes (submitted / received / interest received); internal statuses are never disclosed.',
  },

  // ---- Provisional assumptions (known items 1–10 + prototype choices) ----
  {
    id: 'D-01',
    type: 'Provisional assumption',
    topic: 'SAR 100,000 boundary',
    statement:
      'Exactly SAR 100,000 is treated as self-onboarding (middle band). Copy: “Below SAR 100,000 / SAR 100,000 to SAR 20,000,000 / Above SAR 20,000,000” — no gap or overlap.',
    prototypeBehaviour: 'Configurable in rules/config.ts (REVENUE_BANDS, REVENUE_ROUTING).',
    owner: 'Product / Risk',
  },
  {
    id: 'D-02',
    type: 'Product decision needed',
    topic: 'Contract signing technology',
    statement: 'Final signature/acceptance technology (click-wrap, e-signature provider, Nafath-signing) is not decided.',
    prototypeBehaviour: 'Generic checkbox + “Accept and submit” placeholder; acceptance simulated and not legally binding.',
    owner: 'Legal / Product',
  },
  {
    id: 'D-03',
    type: 'Engineering integration question',
    topic: 'Government validation patterns',
    statement: 'Exact CR and National ID format rules and the government API contracts are not confirmed.',
    prototypeBehaviour: 'Structural regex placeholders (10 digits) kept separate from simulated government verification.',
    owner: 'Engineering',
  },
  {
    id: 'D-04',
    type: 'Product decision needed',
    topic: 'OTP resend & expiry',
    statement: 'Resend cooldown, max resends, code expiry, lockout duration and whether resends reset the attempt counter.',
    prototypeBehaviour: 'Expiry 120 s, cooldown 30 s, 3 resends, resend does not reset attempts; lockout requires a new application.',
    owner: 'Product / Security',
  },
  {
    id: 'D-05',
    type: 'Product decision needed',
    topic: 'Category restriction catalogue',
    statement: 'Madfu’s actual categories, restricted list, CR-only list and review list are not provided.',
    prototypeBehaviour: 'Clearly labelled fixture catalogue in rules/categories.ts.',
    owner: 'Risk / Compliance',
  },
  {
    id: 'D-06',
    type: 'Product decision needed',
    topic: 'Certificate / category reconciliation',
    statement: 'Mapping between government freelancing activities and Madfu categories, and treatment of expired / inconsistent certificates.',
    prototypeBehaviour: 'Fixture mapping table; mismatches flagged (journey continues); expired / inconsistent certificates flagged and contract disabled (manual review).',
    owner: 'Risk / Product',
  },
  {
    id: 'D-07',
    type: 'Product decision needed',
    topic: 'Existing freelancer — add certificate',
    statement: 'How an existing freelancer adds another certificate inside their account.',
    prototypeBehaviour: 'Documented branch from S01-X to S01-F placeholder marked FUTURE FLOW. No implementation.',
    owner: 'Product',
  },
  {
    id: 'D-08',
    type: 'Product decision needed',
    topic: 'API failures after retries',
    statement: 'What happens when the CR service stays unavailable after retries (notify, auto-resume, convert to lead?).',
    prototypeBehaviour: '2 silent auto-retries, then 3 manual retries, then “save and exit”; resuming grants a fresh retry allowance.',
    owner: 'Product / Engineering',
  },
  {
    id: 'D-09',
    type: 'Product decision needed',
    topic: 'Contract decline handling',
    statement: 'Follow-up after a decline (reminders, expiry of the application, sales contact).',
    prototypeBehaviour: 'Application saved, not submitted, status CONTRACT_PENDING with CONTRACT_DECLINED flag; applicant can review again.',
    owner: 'Product / Sales',
  },
  {
    id: 'D-10',
    type: 'Product decision needed',
    topic: 'IBAN technical errors',
    statement: 'A persistent provider outage is not a verified failure. Policy needed for whether contract processing waits for verification.',
    prototypeBehaviour: '3 technical errors → status “pending (provider)”, separate flag; contract allowed subject to processing rules.',
    owner: 'Finance / Product',
  },
  {
    id: 'D-11',
    type: 'Provisional assumption',
    topic: 'Nafath technical failure',
    statement: 'A request that could not be created does not consume one of the 2 attempts; bounded at 3 technical failures, then manual verification.',
    prototypeBehaviour: 'NAFATH_POLICY.technicalFailureConsumesAttempt = false (configurable).',
    owner: 'Product / Risk',
  },
  {
    id: 'D-12',
    type: 'Product decision needed',
    topic: 'IBAN check for CR without Nafath',
    statement: 'The brief specifies no ownership API for freelancers without Nafath; CR without Nafath is not specified.',
    prototypeBehaviour: 'Not called (cost avoidance; application goes to manual review). Configurable per applicant type.',
    owner: 'Product / Finance',
  },
  {
    id: 'D-13',
    type: 'Provisional assumption',
    topic: '“Pending manual review” category',
    statement: 'Whether a review-required category stops before paid checks or continues with a flag.',
    prototypeBehaviour: 'Stops and saves a review lead (Outcome C) before any paid call. Configurable: STOP_AS_LEAD | CONTINUE_WITH_FLAG.',
    owner: 'Risk',
  },
  {
    id: 'D-14',
    type: 'Provisional assumption',
    topic: 'Identity lock',
    statement: 'Applicant type and identification cannot be edited once a Nafath request has been sent (prevents resetting the shared counter).',
    prototypeBehaviour: 'Fields read-only; a new application is required. Abuse via restarting needs a server-side control.',
    owner: 'Product / Risk',
  },
  {
    id: 'D-15',
    type: 'UX/UI decision needed',
    topic: 'Resume authentication',
    statement: 'Production resume should re-authenticate (e.g. OTP) before showing a saved draft.',
    prototypeBehaviour: 'Browser-storage resume without re-authentication (demo only).',
    owner: 'UX / Security',
  },
  {
    id: 'D-16',
    type: 'Provisional assumption',
    topic: 'Certificate not found after Nafath',
    statement: 'A verified freelancer with no certificate may enter a number manually; treated as manual review with contract disabled.',
    prototypeBehaviour: 'Flag CERT_NOT_FOUND_MANUAL_ENTRY (blocking).',
    owner: 'Product / Risk',
  },
  {
    id: 'D-17',
    type: 'Provisional assumption',
    topic: 'Lead resubmission',
    statement: 'Submitted applications (A/B) register the identity so a repeat application hits the duplicate check; leads (C) do not.',
    prototypeBehaviour: 'Demo registry in browser storage (clearable from Prototype Controls).',
    owner: 'Sales / Product',
  },
  {
    id: 'D-18',
    type: 'UX/UI decision needed',
    topic: 'Category picker',
    statement: 'Real catalogue size may require a searchable / grouped picker instead of two dropdowns.',
    owner: 'UX',
  },
  {
    id: 'D-19',
    type: 'UX/UI decision needed',
    topic: 'Nafath presentation',
    statement: 'Full screen vs modal for the Nafath number; behaviour on mobile web.',
    prototypeBehaviour: 'Dedicated screen with a very large circular number.',
    owner: 'UX',
  },
  {
    id: 'D-20',
    type: 'Engineering integration question',
    topic: 'Nafath status delivery',
    statement: 'Polling vs callback for Nafath status, request expiry duration, and idempotency on refresh.',
    prototypeBehaviour: 'Waiting state persists across refresh; resolution simulated by timer or dev simulator.',
    owner: 'Engineering',
  },
  {
    id: 'D-21',
    type: 'Engineering integration question',
    topic: 'Related-party data',
    statement: 'Whether owners/managers come from the same CR call or a separate endpoint, and how entity types are identified.',
    prototypeBehaviour: 'Separate mock call; entity type field drives the individuals-only filter.',
    owner: 'Engineering',
  },
  {
    id: 'D-22',
    type: 'Engineering integration question',
    topic: 'IBAN ownership provider',
    statement: 'Provider, matching rules (exact / fuzzy name), and cost per call.',
    prototypeBehaviour: 'Typed adapter returns verified / not_verified / technical_error.',
    owner: 'Engineering / Finance',
  },
  {
    id: 'D-23',
    type: 'Product decision needed',
    topic: 'VAT number rule',
    statement: 'Exact VAT number validation and whether VAT certificate upload is required.',
    prototypeBehaviour: '15 digits starting and ending with 3 (structural placeholder).',
    owner: 'Finance / Compliance',
  },
];
