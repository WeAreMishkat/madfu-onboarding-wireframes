/**
 * PURE DECISION FUNCTIONS — the only place eligibility logic lives.
 * Screens and the journey engine call these; they read only from config.
 */
import {
  CATEGORY_POLICY,
  CERTIFICATE_RULES,
  CONTRACT_BLOCKING_FLAGS,
  IBAN_POLICY,
  IDENTIFICATION_RULES,
  MOBILE_RULES,
  NAFATH_POLICY,
  REVENUE_ROUTING,
  URL_RULES,
  VAT_RULES,
  type ApplicantType,
  type Journey,
  type RevenueBand,
} from './config';
import { GOV_ACTIVITY_TO_MADFU, findSubcategory, type Eligibility } from './categories';
import type { Application, Certificate, FlagCode, RelatedParty } from '../state/types';

export type FieldErrors = Record<string, string>;

// ---------- Entry ----------

export function normaliseMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

export function validateEntry(entry: Application['entry']): FieldErrors {
  const errors: FieldErrors = {};
  if (!entry.applicantType) errors.applicantType = 'Select an applicant type.';
  const id = entry.identification.trim();
  if (entry.applicantType) {
    const rule = IDENTIFICATION_RULES[entry.applicantType];
    if (!id) errors.identification = `Enter your ${rule.label}.`;
    else if (!rule.pattern.test(id)) errors.identification = rule.error;
  } else if (!id) {
    errors.identification = 'Select an applicant type, then enter your identification number.';
  }
  if (!entry.revenueBand) errors.revenueBand = 'Select your annual revenue.';
  const mobile = entry.mobile.replace(/\s/g, '');
  if (!mobile) errors.mobile = 'Enter your mobile number.';
  else if (!MOBILE_RULES.pattern.test(mobile)) errors.mobile = MOBILE_RULES.error;
  return errors;
}

export function routeByRevenue(type: ApplicantType, band: RevenueBand): Journey {
  return REVENUE_ROUTING[type][band];
}

// ---------- Category ----------

export interface CategoryDecision {
  decision: 'CONTINUE' | 'CONTINUE_FLAGGED' | 'STOP_AS_LEAD';
  eligibility: Eligibility;
  flag?: FlagCode;
  reason: string;
}

export function decideCategory(subcategoryId: string, type: ApplicantType): CategoryDecision {
  const found = findSubcategory(subcategoryId);
  if (!found) throw new Error(`Unknown subcategory ${subcategoryId}`);
  const { eligibility } = found.subcategory;
  switch (eligibility) {
    case 'BLOCKED':
      return { decision: 'STOP_AS_LEAD', eligibility, flag: 'CATEGORY_RESTRICTED', reason: 'Restricted subcategory — self-onboarding stopped before any paid verification.' };
    case 'MANUAL_REVIEW':
      return CATEGORY_POLICY.manualReviewBehaviour === 'STOP_AS_LEAD'
        ? {
            decision: 'STOP_AS_LEAD',
            eligibility,
            flag: 'CATEGORY_REVIEW_REQUIRED',
            reason: 'Subcategory requires business review — saved as review lead before any paid verification.',
          }
        : { decision: 'CONTINUE_FLAGGED', eligibility, flag: 'CATEGORY_REVIEW_REQUIRED', reason: 'Subcategory requires business review — continuing with flag.' };
    case 'CR_ONLY':
      return type === 'FREELANCER'
        ? {
            decision: 'CONTINUE_FLAGGED',
            eligibility,
            flag: 'CR_ONLY_CATEGORY_FREELANCER',
            reason: 'CR-only subcategory selected by a freelancer — not rejected; business team decides.',
          }
        : { decision: 'CONTINUE', eligibility, reason: 'CR-only subcategory selected by a registered business.' };
    default:
      return { decision: 'CONTINUE', eligibility, reason: 'Allowed subcategory.' };
  }
}

// ---------- Authorised persons ----------

export const eligibleIndividuals = (parties: RelatedParty[]) => parties.filter((p) => p.kind === 'INDIVIDUAL' && !!p.nationalId);

/** First and last names visible; second and third names masked. */
export function maskName(names: string[]): string {
  if (names.length < 3) return names.join(' ');
  const [first, ...rest] = names;
  const last = rest.pop()!;
  return [first, ...rest.map((n) => '•'.repeat(Math.max(3, Math.min(n.length, 6)))), last].join(' ');
}

/** First 3 and last 3 digits visible; middle digits hidden. */
export function maskNationalId(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 3)}${'•'.repeat(id.length - 6)}${id.slice(-3)}`;
}

export function maskMobile(countryCode: string, mobile: string): string {
  const m = normaliseMobile(mobile);
  return m.length < 4 ? `${countryCode} ${m}` : `${countryCode} ${'•'.repeat(m.length - 3)}${m.slice(-3)}`;
}

// ---------- Nafath ----------

export const nafathAttemptsUsed = (app: Application) => app.nafath.attempts.length;
export const nafathAttemptsRemaining = (app: Application) => Math.max(0, NAFATH_POLICY.maxAttemptsPerApplication - nafathAttemptsUsed(app));
export const nafathExhausted = (app: Application) => nafathAttemptsRemaining(app) === 0 || app.nafath.technicalFailures >= NAFATH_POLICY.maxTechnicalFailures;

// ---------- Certificates ----------

export interface CertificateReconciliation {
  mappedSubcategoryId: string | null;
  matchesSelection: boolean;
  eligibility?: Eligibility;
  flags: { code: FlagCode; detail: string }[];
  stop: boolean;
}

/**
 * Compare the government certificate with the preliminary Madfu category.
 * The preliminary selection is preserved; inconsistencies are flagged, never silently overwritten.
 */
export function reconcileCertificate(cert: Certificate, selectedSubcategoryId: string | undefined, type: ApplicantType): CertificateReconciliation {
  const mapped = GOV_ACTIVITY_TO_MADFU[cert.activityCode] ?? null;
  const flags: CertificateReconciliation['flags'] = [];
  const mappedSub = findSubcategory(mapped ?? undefined)?.subcategory;
  let stop = false;
  if (cert.status === 'EXPIRED') flags.push({ code: 'CERT_EXPIRED', detail: `Certificate ${cert.certificateNumber} is expired.` });
  if (!cert.holderMatches) flags.push({ code: 'CERT_INCONSISTENT', detail: `Certificate ${cert.certificateNumber} holder data is inconsistent with the verified identity.` });
  if (mappedSub?.eligibility === 'BLOCKED') {
    stop = true;
    flags.push({
      code: 'CATEGORY_RESTRICTED_POST_NAFATH',
      detail: 'Certificate activity maps to a restricted category. Nafath and certificate lookup costs were already incurred; no further paid checks will run.',
    });
  } else if (mappedSub?.eligibility === 'MANUAL_REVIEW') {
    flags.push({ code: 'CATEGORY_REVIEW_REQUIRED', detail: 'Certificate activity maps to a subcategory requiring business review.' });
  } else if (mappedSub?.eligibility === 'CR_ONLY' && type === 'FREELANCER') {
    flags.push({ code: 'CR_ONLY_CATEGORY_FREELANCER', detail: 'Certificate activity maps to a CR-only subcategory.' });
  }
  const matchesSelection = mapped !== null && mapped === selectedSubcategoryId;
  if (!matchesSelection && !stop) {
    flags.push({
      code: 'CATEGORY_MISMATCH',
      detail: mapped
        ? `Preliminary selection ${selectedSubcategoryId} differs from certificate activity (maps to ${mapped}). Preliminary selection preserved.`
        : `Certificate activity ${cert.activityCode} has no Madfu category mapping.`,
    });
  }
  return { mappedSubcategoryId: mapped, matchesSelection, eligibility: mappedSub?.eligibility, flags, stop };
}

export const validateCertificateNumber = (value: string) =>
  !value.trim() ? 'Enter your freelancing certificate number.' : CERTIFICATE_RULES.pattern.test(value.trim().toUpperCase()) ? undefined : CERTIFICATE_RULES.error;

// ---------- IBAN ----------

export const normaliseIban = (raw: string) => raw.replace(/\s/g, '').toUpperCase();

/** Structural Saudi IBAN check: SA + 22 digits + ISO 13616 mod-97 checksum. Not ownership. */
export function validateIbanFormat(raw: string): string | undefined {
  const iban = normaliseIban(raw);
  if (!iban) return 'Enter your IBAN.';
  if (!/^SA\d{22}$/.test(iban)) return 'Enter a valid Saudi IBAN: SA followed by 22 digits.';
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1 ? undefined : 'This IBAN is not valid. Please check the number.';
}

export function shouldCallIbanOwnership(app: Application): boolean {
  if (app.nafath.result === 'verified') return true;
  return IBAN_POLICY.verifyWhenNafathUnverified[app.entry.applicantType ?? 'FREELANCER'];
}

export const ibanMatchTarget = (type: ApplicantType): 'REGISTERED_BUSINESS' | 'INDIVIDUAL_NATIONAL_ID' => (type === 'CR' ? 'REGISTERED_BUSINESS' : 'INDIVIDUAL_NATIONAL_ID');

/** IBAN statuses that permit the applicant to leave the business-details step. */
export const IBAN_PROGRESSABLE = ['verified', 'failed_max', 'pending_provider', 'not_checked'] as const;

export function formatIban(raw: string) {
  return normaliseIban(raw)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

// ---------- Business details ----------

export function validateBusiness(b: Application['business']): FieldErrors {
  const errors: FieldErrors = {};
  const ibanErr = validateIbanFormat(b.iban);
  if (ibanErr) errors.iban = ibanErr;
  if (!b.vatRegistered) errors.vatRegistered = 'Select whether your business is VAT registered.';
  if (b.vatRegistered === 'yes') {
    if (!b.vatNumber.trim()) errors.vatNumber = 'Enter your VAT registration number.';
    else if (!VAT_RULES.pattern.test(b.vatNumber.trim())) errors.vatNumber = VAT_RULES.error;
  }
  if (!b.channel) errors.channel = 'Select how you sell to customers.';
  if (b.channel === 'online' || b.channel === 'both') {
    if (!b.websiteUrl.trim()) errors.websiteUrl = 'Enter your store website URL.';
    else if (!URL_RULES.website.pattern.test(b.websiteUrl.trim())) errors.websiteUrl = URL_RULES.website.error;
  }
  if (b.channel === 'offline' || b.channel === 'both') {
    if (!b.mapsUrl.trim()) errors.mapsUrl = 'Enter a Google Maps link for one branch.';
    else if (!URL_RULES.maps.pattern.test(b.mapsUrl.trim())) errors.mapsUrl = URL_RULES.maps.error;
  }
  return errors;
}

// ---------- Contract ----------

export interface ContractEligibility {
  allowed: boolean;
  reason: string;
  conditions: string[];
}

/**
 * Rule matrix — Nafath is the deciding factor:
 *  Nafath verified + IBAN verified       → allowed
 *  Nafath verified + IBAN failed twice   → allowed (IBAN queued for manual financial review)
 *  Nafath verified + IBAN pending/tech   → allowed, subject to processing rules (pending policy)
 *  Nafath not verified (any IBAN)        → not allowed
 * Plus PROVISIONAL blocking review flags (unresolved certificate eligibility etc.).
 */
export function contractEligibility(app: Application): ContractEligibility {
  if (app.nafath.result !== 'verified') return { allowed: false, reason: 'Nafath not verified — manual verification required.', conditions: [] };
  const blocking = app.flags.filter((f) => (CONTRACT_BLOCKING_FLAGS as readonly string[]).includes(f.code));
  if (blocking.length) return { allowed: false, reason: `Unresolved review flag(s): ${blocking.map((f) => f.code).join(', ')}.`, conditions: [] };
  const conditions: string[] = [];
  if (app.iban.status === 'failed_max') conditions.push('IBAN ownership unverified — manual financial verification queued.');
  if (app.iban.status === 'pending_provider') conditions.push('IBAN verification pending (provider issue) — subject to processing rules (policy pending).');
  return { allowed: true, reason: 'Nafath verified.', conditions };
}

// ---------- Internal statuses (never shown to applicants) ----------

export type InternalStatus =
  | 'SALES_LEAD'
  | 'CATEGORY_REVIEW_REQUIRED'
  | 'NAFATH_MANUAL_VERIFICATION'
  | 'IBAN_VERIFICATION_PENDING'
  | 'CR_EXPIRED'
  | 'CERTIFICATE_REVIEW_REQUIRED'
  | 'CONTRACT_PENDING'
  | 'CONTRACT_ACCEPTED'
  | 'APPLICATION_SUBMITTED';

export function internalStatuses(app: Application): InternalStatus[] {
  const has = (c: FlagCode) => app.flags.some((f) => f.code === c);
  const out: InternalStatus[] = [];
  if (app.submission.outcome === 'C_SALES_LEAD') out.push('SALES_LEAD');
  if (['CATEGORY_RESTRICTED', 'CATEGORY_REVIEW_REQUIRED', 'CATEGORY_MISMATCH', 'CR_ONLY_CATEGORY_FREELANCER', 'CATEGORY_RESTRICTED_POST_NAFATH'].some((c) => has(c as FlagCode)))
    out.push('CATEGORY_REVIEW_REQUIRED');
  if (app.nafath.result === 'unverified') out.push('NAFATH_MANUAL_VERIFICATION');
  if (['failed_max', 'pending_provider', 'not_checked'].includes(app.iban.status)) out.push('IBAN_VERIFICATION_PENDING');
  if (has('CR_EXPIRED')) out.push('CR_EXPIRED');
  if (['CERT_EXPIRED', 'CERT_INCONSISTENT', 'CERT_NOT_FOUND_MANUAL_ENTRY', 'CERT_MANUAL_ENTRY_UNVERIFIED'].some((c) => has(c as FlagCode))) out.push('CERTIFICATE_REVIEW_REQUIRED');
  if (app.contract.status === 'pending' || app.contract.status === 'declined') out.push('CONTRACT_PENDING');
  if (app.contract.status === 'accepted') out.push('CONTRACT_ACCEPTED');
  if (app.submission.state === 'submitted' && app.submission.outcome !== 'C_SALES_LEAD') out.push('APPLICATION_SUBMITTED');
  return out;
}
