/**
 * Additional per-screen detail used by the Master Board details panel.
 * Complements the annotations in `screens.ts` (same screen IDs).
 */
import type { ScreenId } from '../state/types';

export interface ScreenDetail {
  validations: string[];
  actions: string[];
  failures: string[];
}

export const SCREEN_DETAILS: Record<ScreenId, ScreenDetail> = {
  S00: {
    validations: ['Only shown for a saved, unsubmitted application'],
    actions: ['Continue application', 'Start a new application'],
    failures: ['Saved draft unavailable (storage cleared) → start at S01'],
  },
  S01: {
    validations: [
      'Applicant type required',
      'CR: 10 digits (configurable structural rule)',
      'National ID: 10 digits starting 1 or 2 (configurable)',
      'Annual revenue required',
      'Mobile: 5XXXXXXXX or 05XXXXXXXX with +966',
      'Error summary when 2+ fields fail',
    ],
    actions: ['Next', 'Switch applicant type (resets ID)'],
    failures: ['Identity already registered → S01-X', 'Validation errors → stay on S01'],
  },
  'S01-X': {
    validations: ['—'],
    actions: ['Sign in (out of scope)', 'Contact support', 'Edit details (Back → S01)', 'Freelancer: add another certificate → S01-F'],
    failures: ['None — the duplicate application is stopped'],
  },
  'S01-F': {
    validations: ['To be specified'],
    actions: ['Back → S01-X'],
    failures: ['Future flow — not implemented'],
  },
  S02: {
    validations: ['6 digits', 'Code not expired', 'Max 3 incorrect attempts', 'Resend cooldown 30 s, max 3 resends (provisional)'],
    actions: ['Verify', 'Resend code', 'Edit mobile number (→ S01)', 'Dev simulator: success / failure / expiry'],
    failures: ['Incorrect code → error with remaining attempts', 'Expired code → resend (no attempt consumed)', '3rd incorrect → S02-L'],
  },
  'S02-L': {
    validations: ['—'],
    actions: ['Start again (new application)', 'Contact support'],
    failures: ['Lockout duration pending decision (D-04)'],
  },
  S03: {
    validations: ['Category required', 'Subcategory required (enabled after category)'],
    actions: ['Next', 'Back → S01'],
    failures: ['Restricted / review subcategory → lead (O-C), no paid calls'],
  },
  S04: {
    validations: ['CR exists and is readable from the government source'],
    actions: ['Continue (valid / expired)', 'Edit CR number (not found)', 'Try again (unavailable / error)', 'Save and exit (retry limit)'],
    failures: ['Not found', 'Temporarily unavailable (auto ×2, manual ×3)', 'Unexpected provider error', 'Expired CR (continues, flagged)'],
  },
  S05: {
    validations: ['Exactly one individual selected', 'Only individuals (no companies / entities)'],
    actions: ['Select person', 'Continue', 'Try again (data unavailable)', 'Continue application (no eligible individual)'],
    failures: ['Related-party data unavailable', 'No eligible individual → manual verification path'],
  },
  S06: {
    validations: ['Attempts remaining (max 2 per application, shared)', 'Selected person / National ID present'],
    actions: ['Send verification request', 'Try again', 'Choose another authorized person (CR)', 'Continue'],
    failures: ['Rejected', 'Timed out', 'Technical failure (no attempt used)', '2 unsuccessful attempts → manual path'],
  },
  S07: {
    validations: ['Exactly one certificate selected', 'Certificates already attached to an account are not selectable'],
    actions: ['Select certificate', 'Continue', 'Try again (service unavailable)', 'Enter certificate number manually'],
    failures: ['No certificates', 'Service unavailable', 'Restricted mapping → lead', 'Expired / inconsistent / mismatch → flagged'],
  },
  'S07-M': {
    validations: ['Format FL-XXXXXXXXX (configurable)', 'Not attached to an existing account'],
    actions: ['Continue', 'Back'],
    failures: ['Invalid format', 'Certificate already linked to an account'],
  },
  S08: {
    validations: [
      'IBAN: SA + 22 digits + mod-97 (must always be corrected)',
      'VAT Yes → VAT number required (15 digits, configurable)',
      'Online → website URL; Offline → Google Maps URL; Both → both',
      'Branches optional',
    ],
    actions: ['Leave IBAN field (ownership check)', 'Retry verification', 'Next', 'Back'],
    failures: ['IBAN not verified (1st) → correct / retry', 'Not verified ×2 → continue, flagged', 'Technical error ×3 → pending (separate from failure)'],
  },
  S09: {
    validations: ['Agreement confirmation checkbox required', 'Only reachable with verified Nafath and no blocking flag'],
    actions: ['Accept and submit (simulated)', 'Decline (confirmation)', 'Back → S08'],
    failures: ['Acceptance without confirmation → inline error'],
  },
  'S09-D': {
    validations: ['—'],
    actions: ['Review agreement → S09', 'Edit business details → S08', 'Save and exit'],
    failures: ['Not submitted while declined'],
  },
  'O-A': { validations: ['—'], actions: ['None (final)'], failures: ['Resubmission blocked'] },
  'O-B': { validations: ['—'], actions: ['None (final)'], failures: ['Resubmission blocked'] },
  'O-C': { validations: ['—'], actions: ['None (final)'], failures: ['—'] },
};
