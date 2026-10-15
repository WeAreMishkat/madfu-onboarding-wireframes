/**
 * SCREEN REGISTRY — single source for screen IDs, routes and annotations.
 * Used by the prototype, screen gallery, journey maps and the PDF.
 */
import type { ScreenId } from '../state/types';

export interface ScreenAnnotation {
  purpose: string;
  whoSees: string;
  entryCondition: string;
  inputs: string[];
  primaryAction: string;
  next: string;
  alternatives: string[];
  backend: string[];
  constraints: string[];
  uxNotes: string[];
}

export interface ScreenDef {
  id: ScreenId;
  name: string;
  slug: string;
  audience: 'Both' | 'Registered Business' | 'Freelancer';
  kind: 'screen' | 'outcome' | 'future';
  annotation: ScreenAnnotation;
}

export const GLOBAL_UX_NOTE =
  'All screens require complete UX/UI validation, error-state, empty-state, loading-state, retry, and edge-case designs. The absence of a specific state from the wireframes does not mean it is excluded from the final product requirements. The UX/UI team is responsible for designing comprehensive error and validation experiences for every field, step, and integration.';

export const SCREENS: ScreenDef[] = [
  {
    id: 'S00',
    name: 'Resume application',
    slug: 'resume',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Let an applicant return to an incomplete application without losing progress.',
      whoSees: 'Any applicant with a saved, unsubmitted application.',
      entryCondition: 'Saved application exists, not submitted; applicant opens the onboarding entry point.',
      inputs: ['None (choice only)'],
      primaryAction: 'Continue application',
      next: 'The last active step (e.g. S08 Business details).',
      alternatives: ['Start a new application → S01 (previous draft discarded in this demo).'],
      backend: [
        'Demo: browser storage. Production: server-side draft keyed by application ID.',
        'Production should re-authenticate with OTP before showing saved data (assumption D-15).',
      ],
      constraints: ['Submitted applications cannot be resumed or resubmitted.'],
      uxNotes: ['Show last-saved time and the step name, not internal status.', 'Never show unmasked identity data on this screen.'],
    },
  },
  {
    id: 'S01',
    name: 'Start application (shared entry)',
    slug: 'start',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Capture applicant type, identification, annual revenue and mobile on one page.',
      whoSees: 'Every new applicant (Registered Business and Freelancer).',
      entryCondition: 'Applicant opens onboarding, or returns via "Edit details" / "Edit mobile number".',
      inputs: [
        'Applicant type (Registered Business / Freelancer)',
        'CR number (business) or National ID (freelancer) — field switches with type',
        'Annual revenue (3 bands)',
        'Mobile number (+966 default)',
      ],
      primaryAction: 'Next',
      next: 'S02 OTP verification (after backend duplicate checks).',
      alternatives: ['Identity already registered → S01-X Existing account.', 'Mobile already verified in this application and unchanged → revenue routing (OTP skipped).'],
      backend: [
        'Check 1: identity (CR / National ID) duplicate — runs first.',
        'Check 2: mobile linkage — only if identity is new; informational, never blocks.',
        'Changing type resets incompatible data; changing ID resets identity-dependent verifications; changing mobile resets OTP.',
      ],
      constraints: [
        'All fields mandatory.',
        'Freelancing certificate number is NOT requested here.',
        'Exactly SAR 100,000 falls in the middle band (provisional D-01).',
        'Format rules are configurable structural checks, not government validation.',
      ],
      uxNotes: ['Inline errors per field plus an error summary on submit.', 'After Nafath has started, type and ID are read-only.'],
    },
  },
  {
    id: 'S01-X',
    name: 'Existing account found',
    slug: 'existing-account',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Stop a duplicate application for an identity that is already registered.',
      whoSees: 'Applicants whose CR or National ID already exists.',
      entryCondition: 'Duplicate check 1 (identity) returned "already registered".',
      inputs: ['None'],
      primaryAction: 'Sign in to your account (outside prototype scope)',
      next: 'Existing-account sign-in (not designed here).',
      alternatives: ['Contact support.', 'Edit details → S01.', 'Freelancer: "Add another certificate" → S01-F (future flow).'],
      backend: ['Mobile check is skipped when identity already exists.', 'No new application record is created.'],
      constraints: ['Same CR / National ID can never be registered twice.', 'Mobile reuse alone is never a reason to show this screen.'],
      uxNotes: ['Message must not reveal account details to an unverified visitor.'],
    },
  },
  {
    id: 'S01-F',
    name: 'Existing freelancer — add another certificate (future flow)',
    slug: 'add-certificate-future',
    audience: 'Freelancer',
    kind: 'future',
    annotation: {
      purpose: 'Placeholder marking a documented future branch.',
      whoSees: 'Existing freelancer who wants to add another freelancing certificate.',
      entryCondition: 'S01-X for a Freelancer → "Add another freelancing certificate".',
      inputs: ['To be specified'],
      primaryAction: 'None (placeholder)',
      next: 'To be handled inside the existing account — pending business specification.',
      alternatives: ['Back to S01-X.'],
      backend: ['Not implemented. Must not create a second onboarding account.'],
      constraints: ['FUTURE FLOW — pending business specification (D-07).'],
      uxNotes: ['Do not design until the business rules are specified.'],
    },
  },
  {
    id: 'S02',
    name: 'Mobile OTP verification',
    slug: 'verify-mobile',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Verify the applicant controls the mobile number.',
      whoSees: 'All applicants who passed the duplicate checks.',
      entryCondition: 'S01 submitted, identity not already registered, OTP sent.',
      inputs: ['6-digit SMS code'],
      primaryAction: 'Verify',
      next: 'Revenue routing → S03 Category (self-onboarding) or O-C (CR sales lead).',
      alternatives: [
        'Incorrect code → inline error with remaining attempts.',
        'Expired code → request new code (no attempt consumed).',
        '3 incorrect attempts → S02-L.',
        'Edit mobile number → S01.',
        'Resend code (cooldown + max resends, configurable).',
      ],
      backend: ['Simulated SMS only — real code never shown in the customer UI.', 'Development simulator strip (prototype only) triggers success / failure / expiry.'],
      constraints: ['Max 3 incorrect attempts.', 'Resend cooldown/limit and expiry are provisional (D-04).'],
      uxNotes: ['Masked mobile number in the heading copy.', 'Countdown for resend; clear expiry recovery.'],
    },
  },
  {
    id: 'S02-L',
    name: 'Mobile verification locked',
    slug: 'verification-locked',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Stop verification after too many incorrect codes.',
      whoSees: 'Applicants who entered 3 incorrect codes.',
      entryCondition: 'Third incorrect OTP.',
      inputs: ['None'],
      primaryAction: 'Start again',
      next: 'S01 with a new application (demo).',
      alternatives: ['Contact support.'],
      backend: ['Lockout duration / cool-off policy to be defined (D-04).'],
      constraints: ['No further OTP attempts on this application.'],
      uxNotes: ['Neutral tone; do not imply fraud.'],
    },
  },
  {
    id: 'S03',
    name: 'Business category',
    slug: 'category',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Screen eligibility using the Madfu category catalogue BEFORE any paid verification.',
      whoSees: 'Self-onboarding applicants (CR in range, all freelancers).',
      entryCondition: 'OTP verified and revenue routing = self-onboarding.',
      inputs: ['Category', 'Subcategory'],
      primaryAction: 'Next',
      next: 'CR → S04 CR verification. Freelancer → S06 Nafath.',
      alternatives: [
        'Restricted subcategory → O-C (lead, internal CATEGORY_RESTRICTED).',
        'Pending-review subcategory → O-C (configurable, D-13).',
        'Freelancer + CR-only subcategory → continue with internal flag.',
      ],
      backend: [
        'Category API returns category/subcategory IDs, eligibility, permitted applicant types, manual-review flag.',
        'No CR lookup or Nafath call happens for restricted categories (cost avoidance).',
      ],
      constraints: [
        'Madfu taxonomy ≠ government CR activity list.',
        'Freelancer selection is preliminary; reconciled against the certificate later.',
        'Fixture catalogue — not the real restriction list.',
      ],
      uxNotes: ['Never show eligibility classification to the applicant.', 'Searchable select recommended for the real catalogue size.'],
    },
  },
  {
    id: 'S04',
    name: 'Business verification (CR lookup)',
    slug: 'business-verification',
    audience: 'Registered Business',
    kind: 'screen',
    annotation: {
      purpose: 'Retrieve CR data from the government source and show the result.',
      whoSees: 'Registered Business applicants after category screening.',
      entryCondition: 'Category decision = continue.',
      inputs: ['None (automatic lookup)'],
      primaryAction: 'Continue',
      next: 'S05 Authorized person selection.',
      alternatives: [
        'Expired CR → notice, may continue (internal CR_EXPIRED).',
        'Not found → Edit CR number → S01.',
        'Unavailable → auto-retries, then "Try again" (bounded), then save-and-exit.',
        'Provider error → generic error + retry.',
      ],
      backend: [
        'Bounded automatic retries (2) then manual retries (3) — provisional D-08.',
        'Each call recorded in the cost ledger.',
        'Never fabricate authorized-person data when the API fails.',
      ],
      constraints: ['Invalid / non-existent CR cannot proceed.'],
      uxNotes: ['Loading state with reassurance copy.', 'Recovery state must preserve progress.'],
    },
  },
  {
    id: 'S05',
    name: 'Authorized person selection',
    slug: 'authorized-person',
    audience: 'Registered Business',
    kind: 'screen',
    annotation: {
      purpose: 'Choose exactly one individual on the CR to verify with Nafath.',
      whoSees: 'Registered Business applicants with CR data.',
      entryCondition: 'S04 result valid or expired.',
      inputs: ['Single selection of one individual'],
      primaryAction: 'Continue (disabled until a selection is made)',
      next: 'S06 Nafath verification.',
      alternatives: ['No eligible individual → continue to S08 via manual-review path (contract disabled).', 'Related-party data unavailable → retry.', 'Back → S04.'],
      backend: ['Companies and other entities are filtered out — individuals only.', 'Selected person’s National ID initiates Nafath.'],
      constraints: [
        'Single-select only.',
        'Name: first + last visible, 2nd/3rd masked. ID: first 3 + last 3 visible.',
        'Changing the person never resets the Nafath attempt counter.',
      ],
      uxNotes: ['Show role (owner / manager / partner).', 'One-person list is pre-selected but still confirmed by the user.'],
    },
  },
  {
    id: 'S06',
    name: 'Nafath identity verification',
    slug: 'nafath',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Verify identity via a Nafath request with a two-digit matching number.',
      whoSees: 'CR: the selected authorized person. Freelancer: the National ID holder from S01.',
      entryCondition: 'CR: person selected (S05). Freelancer: category decision = continue.',
      inputs: ['None in Madfu — the user approves in the Nafath app'],
      primaryAction: 'Send verification request → (wait) → Continue',
      next: 'Verified: CR → S08; Freelancer → S07 certificate selection.',
      alternatives: [
        '1st failure: Try again, or (CR) choose another person.',
        '2nd failure: CR → S08 manual path; Freelancer → S07-M manual certificate.',
        'Technical failure: retry without consuming an attempt (provisional D-11).',
      ],
      backend: [
        'Max 2 attempts per application — shared across individuals.',
        'Outcomes: verified, rejected, timed out, technical failure.',
        'Each request recorded in the cost ledger.',
      ],
      constraints: ['Unverified Nafath → contract signing disabled.'],
      uxNotes: ['Very large circular number; numbered instructions.', 'Show remaining attempts after a failure.', 'Waiting state must survive refresh.'],
    },
  },
  {
    id: 'S07',
    name: 'Freelancing certificate selection',
    slug: 'certificate',
    audience: 'Freelancer',
    kind: 'screen',
    annotation: {
      purpose: 'Associate exactly one government freelancing certificate with the application.',
      whoSees: 'Freelancers with successful Nafath only.',
      entryCondition: 'Nafath verified.',
      inputs: ['Single selection of one certificate'],
      primaryAction: 'Continue',
      next: 'S08 Business details.',
      alternatives: [
        'No certificates → manual entry S07-M (manual review).',
        'Service unavailable → retry.',
        'Certificate already attached to an account → not selectable.',
        'Certificate maps to a restricted category → O-C (cost already incurred, no further paid checks).',
      ],
      backend: [
        'Reconcile certificate activity → Madfu category via mapping table.',
        'Preliminary category preserved; mismatches flagged (CATEGORY_MISMATCH).',
        'Expired / inconsistent certificates flagged for manual review (contract disabled, D-06).',
      ],
      constraints: ['Never invent missing certificates.', 'Taxonomy IDs are not assumed to match.'],
      uxNotes: ['Cards show number, category, subcategory and status.'],
    },
  },
  {
    id: 'S07-M',
    name: 'Manual certificate entry',
    slug: 'certificate-manual',
    audience: 'Freelancer',
    kind: 'screen',
    annotation: {
      purpose: 'Collect a certificate number when it cannot be retrieved after verification.',
      whoSees: 'Freelancers whose Nafath failed twice, or whose verified ID returned no certificate.',
      entryCondition: 'Nafath unverified (2 failures) or "Enter certificate manually" from S07.',
      inputs: ['Freelancing certificate number'],
      primaryAction: 'Continue',
      next: 'S08 Business details (IBAN collected without ownership check when Nafath failed).',
      alternatives: ['Certificate already attached → inline error.'],
      backend: ['Internal: identity unverified, certificate association unverified, manual review required, contract disabled.'],
      constraints: ['No automatic contract signing without successful Nafath.'],
      uxNotes: ['Neutral copy — do not tell the applicant they "failed".'],
    },
  },
  {
    id: 'S08',
    name: 'Business details (shared)',
    slug: 'business-details',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Collect settlement IBAN, VAT, sales channels and branches.',
      whoSees: 'All self-onboarding applicants who reached this step (verified or manual path).',
      entryCondition: 'CR: Nafath finished (verified or exhausted) or no eligible person. Freelancer: certificate selected or entered.',
      inputs: [
        'IBAN (required)',
        'VAT registered? Yes/No (+ VAT number if Yes)',
        'Sales channel: Online / Offline / Both (+ website and/or Google Maps URL)',
        'Number of branches (optional)',
      ],
      primaryAction: 'Next',
      next: 'Contract allowed → S09. Not allowed (Nafath unverified / blocking review flag) → O-B.',
      alternatives: [
        'IBAN not verified (1st) → correct or retry.',
        'IBAN not verified (2nd) → continue, flagged for manual financial verification.',
        'Technical error → retry; persistent → pending (separate from failure).',
      ],
      backend: [
        'Format check (SA + 22 digits, mod-97) ≠ ownership check.',
        'Ownership API on field exit; never repeated for an unchanged value.',
        'CR: match to registered business. Freelancer: match to National ID. Freelancer with failed Nafath: no API call.',
        'Editing IBAN invalidates its verification result.',
      ],
      constraints: ['Max 2 unsuccessful ownership attempts per application.', 'IBAN failure never blocks the contract when Nafath succeeded.'],
      uxNotes: ['Inline status chip: Verifying / Verified / Not verified / Technical error.', 'Values preserved across navigation, retries and refresh.'],
    },
  },
  {
    id: 'S09',
    name: 'Merchant agreement (contract)',
    slug: 'contract',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Show the agreement and capture simulated acceptance.',
      whoSees: 'Only applicants with successful Nafath and no blocking review flag.',
      entryCondition: 'S08 submitted and contract eligibility = allowed.',
      inputs: ['Agreement confirmation checkbox'],
      primaryAction: 'Accept and submit (simulated)',
      next: 'O-A Application submitted.',
      alternatives: ['Decline → confirmation → S09-D.', 'Back → S08.'],
      backend: ['Generic acceptance placeholder; signature technology not decided (D-02).', 'Acceptance recorded with contract version.'],
      constraints: ['Not legally binding. No real contract text or signature credentials.'],
      uxNotes: ['Scrollable embedded viewer; decline clearly identifiable but secondary.'],
    },
  },
  {
    id: 'S09-D',
    name: 'Agreement not accepted',
    slug: 'contract-declined',
    audience: 'Both',
    kind: 'screen',
    annotation: {
      purpose: 'Hold a declined application without reporting completion.',
      whoSees: 'Applicants who declined the agreement.',
      entryCondition: 'Decline confirmed on S09.',
      inputs: ['None'],
      primaryAction: 'Review agreement',
      next: 'S09 Contract.',
      alternatives: ['Edit business details → S08.', 'Save and exit (resume later).'],
      backend: ['Internal CONTRACT_DECLINED flag; status CONTRACT_PENDING; not submitted.'],
      constraints: ['Final decline handling pending (D-09).'],
      uxNotes: ['Do not show success styling.'],
    },
  },
  {
    id: 'O-A',
    name: 'Outcome A — Application submitted',
    slug: 'submitted',
    audience: 'Both',
    kind: 'outcome',
    annotation: {
      purpose: 'Confirm full submission.',
      whoSees: 'Self-onboarding applicants with verified Nafath and simulated contract acceptance.',
      entryCondition: 'Contract accepted.',
      inputs: ['None'],
      primaryAction: 'None (final state)',
      next: 'End of journey.',
      alternatives: [],
      backend: ['Internal: CONTRACT_ACCEPTED, APPLICATION_SUBMITTED (+ any review flags e.g. CR_EXPIRED, IBAN pending).'],
      constraints: ['Does not state approval or merchant activation.'],
      uxNotes: ['Show application reference only.'],
    },
  },
  {
    id: 'O-B',
    name: 'Outcome B — Application received (manual verification)',
    slug: 'received',
    audience: 'Both',
    kind: 'outcome',
    annotation: {
      purpose: 'Neutral confirmation for applications that need manual verification.',
      whoSees: 'Applicants without successful Nafath, or with blocking review flags.',
      entryCondition: 'S08 submitted and contract not allowed.',
      inputs: ['None'],
      primaryAction: 'None (final state)',
      next: 'Manual verification by Madfu team.',
      alternatives: [],
      backend: ['Internal: NAFATH_MANUAL_VERIFICATION and/or certificate review, IBAN pending, APPLICATION_SUBMITTED.'],
      constraints: ['Do not disclose internal reasons.'],
      uxNotes: ['Same visual weight as success — not an error page.'],
    },
  },
  {
    id: 'O-C',
    name: 'Outcome C — Interest received (sales lead)',
    slug: 'lead',
    audience: 'Both',
    kind: 'outcome',
    annotation: {
      purpose: 'Confirm lead capture for applicants routed to Sales.',
      whoSees: 'CR outside the self-onboarding revenue range; restricted / review categories; restricted certificate after Nafath.',
      entryCondition: 'Revenue routing = sales lead, or category decision = stop.',
      inputs: ['None'],
      primaryAction: 'None (final state)',
      next: 'Sales / business review team contacts the applicant.',
      alternatives: [],
      backend: [
        'Internal: SALES_LEAD (+ CATEGORY_RESTRICTED / CATEGORY_REVIEW_REQUIRED / SALES_LEAD_REVENUE).',
        'No authorized persons, Nafath, IBAN, VAT, channels or contract requested on this path.',
      ],
      constraints: ['Neutral message — never state the restriction reason.'],
      uxNotes: ['Identical copy for all lead reasons.'],
    },
  },
];

export const screenById = (id: ScreenId) => SCREENS.find((s) => s.id === id)!;
export const screenBySlug = (slug: string) => SCREENS.find((s) => s.slug === slug);
