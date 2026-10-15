import type { ApplicantType, Journey, PaidService, RevenueBand } from '../rules/config';
import type { Eligibility } from '../rules/categories';

export type ScreenId = 'S00' | 'S01' | 'S01-X' | 'S01-F' | 'S02' | 'S02-L' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S07-M' | 'S08' | 'S09' | 'S09-D' | 'O-A' | 'O-B' | 'O-C';

/** Internal review flags. Never shown to the applicant. */
export type FlagCode =
  | 'MOBILE_LINKED_TO_OTHER_ACCOUNTS'
  | 'SALES_LEAD_REVENUE'
  | 'CATEGORY_RESTRICTED'
  | 'CATEGORY_REVIEW_REQUIRED'
  | 'CR_ONLY_CATEGORY_FREELANCER'
  | 'CR_EXPIRED'
  | 'NO_ELIGIBLE_AUTHORISED_PERSON'
  | 'NAFATH_MANUAL_VERIFICATION'
  | 'CERT_EXPIRED'
  | 'CERT_INCONSISTENT'
  | 'CERT_NOT_FOUND_MANUAL_ENTRY'
  | 'CERT_MANUAL_ENTRY_UNVERIFIED'
  | 'CATEGORY_MISMATCH'
  | 'CATEGORY_RESTRICTED_POST_NAFATH'
  | 'IBAN_UNVERIFIED_MANUAL_FINANCIAL_REVIEW'
  | 'IBAN_VERIFICATION_PENDING_PROVIDER'
  | 'IBAN_NOT_CHECKED_NAFATH_UNVERIFIED'
  | 'CONTRACT_DECLINED';

export interface Flag {
  code: FlagCode;
  detail: string;
  at: string;
}

export interface AuditEvent {
  at: string;
  type: string;
  detail: string;
}

export interface RelatedParty {
  partyId: string;
  kind: 'INDIVIDUAL' | 'COMPANY' | 'OTHER_ENTITY';
  role: 'OWNER' | 'MANAGER' | 'PARTNER';
  /** Individuals: [first, second, third, last]. Entities: [entity name]. */
  names: string[];
  nationalId?: string;
}

export interface CrRecord {
  crNumber: string;
  businessName: string;
  status: 'ACTIVE' | 'EXPIRED';
  expiryDate: string;
  relatedParties: RelatedParty[];
}

export interface Certificate {
  certificateNumber: string;
  activityCode: string;
  govCategory: string;
  govSubcategory: string;
  status: 'ACTIVE' | 'EXPIRED';
  holderMatches: boolean;
  attachedToExistingAccount: boolean;
}

export type GovStatus = 'idle' | 'loading' | 'valid' | 'expired' | 'not_found' | 'unavailable' | 'provider_error' | 'gave_up';
export type NafathOutcome = 'verified' | 'rejected' | 'timeout' | 'technical_failure';
export type IbanStatus = 'idle' | 'verifying' | 'verified' | 'not_verified' | 'technical_error' | 'failed_max' | 'pending_provider' | 'not_checked';

export interface NafathAttempt {
  attemptNo: number;
  /** Index into the request sequence (attempts + technical failures). */
  requestIndex: number;
  personId?: string;
  maskedName: string;
  maskedId: string;
  requestNumber: number;
  outcome?: NafathOutcome;
  at: string;
}

export interface Application {
  id: string;
  createdAt: string;
  updatedAt: string;
  screen: ScreenId;
  /** Synthetic demo marker — this store must never hold real identities. */
  synthetic: true;

  entry: {
    applicantType?: ApplicantType;
    identification: string;
    revenueBand?: RevenueBand;
    countryCode: string;
    mobile: string;
  };
  /** Identity fields lock once a Nafath request has been made for this application. */
  identityLocked: boolean;

  duplicate: {
    identityChecked: boolean;
    identityExists: boolean;
    mobileChecked: boolean;
    mobileLinkedAccounts: number;
    /** Values the checks were last run against (re-run if changed). */
    checkedKey?: string;
  };

  otp: {
    status: 'not_sent' | 'sent' | 'verified' | 'locked';
    incorrectAttempts: number;
    resendCount: number;
    sentAt?: string;
    expiresAt?: string;
    lastError?: 'incorrect' | 'expired' | 'format' | null;
    verifiedMobile?: string;
    /** Prototype-only: the simulated code. Never rendered in the customer UI. */
    simulatedCode?: string;
  };

  routing: { journey?: Journey; reason?: string };

  category: {
    categoryId?: string;
    subcategoryId?: string;
    eligibility?: Eligibility;
    decision?: 'CONTINUE' | 'CONTINUE_FLAGGED' | 'STOP_AS_LEAD';
  };

  gov: {
    status: GovStatus;
    calls: number;
    manualRetries: number;
    record?: CrRecord;
    personsStatus: 'idle' | 'loading' | 'loaded' | 'unavailable';
    personsCalls: number;
  };

  persons: { selectedId?: string };

  nafath: {
    status: 'idle' | 'waiting' | 'result';
    attempts: NafathAttempt[];
    technicalFailures: number;
    lastOutcome?: NafathOutcome;
    result: 'not_started' | 'verified' | 'unverified';
    /** Why Nafath could not be completed (CR without eligible individuals). */
    notPossibleReason?: string;
  };

  certificates: {
    status: 'idle' | 'loading' | 'loaded' | 'unavailable';
    calls: number;
    list: Certificate[];
    selectedNumber?: string;
    manualNumber?: string;
    source?: 'GOVERNMENT' | 'MANUAL_ENTRY';
    reconciliation?: { mappedSubcategoryId: string | null; matchesSelection: boolean; eligibility?: Eligibility };
  };

  business: {
    iban: string;
    vatRegistered?: 'yes' | 'no';
    vatNumber: string;
    channel?: 'online' | 'offline' | 'both';
    websiteUrl: string;
    mapsUrl: string;
    branches?: '1' | '2-3' | '4+';
  };

  iban: {
    status: IbanStatus;
    checkedValue?: string;
    /** Last ownership result for `checkedValue` — reused instead of re-calling for an unchanged value. */
    lastResult?: 'verified' | 'not_verified' | 'technical_error';
    failedAttempts: number;
    technicalErrors: number;
    calls: number;
    /** Ownership target used for matching. */
    matchTarget?: 'REGISTERED_BUSINESS' | 'INDIVIDUAL_NATIONAL_ID';
  };

  contract: { status: 'not_available' | 'pending' | 'accepted' | 'declined'; acceptedAt?: string; declinedAt?: string; version: string };

  submission: { state: 'draft' | 'submitted'; outcome?: 'A_SUBMITTED' | 'B_RECEIVED' | 'C_SALES_LEAD'; submittedAt?: string };

  flags: Flag[];
  audit: AuditEvent[];
  costLedger: { service: PaidService; at: string; detail: string }[];

  /** Transient UI state (still serialisable so every state can be rendered/printed). */
  ui: {
    busy?: string;
    errors: Record<string, string>;
    notice?: string;
    showDeclineConfirm?: boolean;
    resendAvailableAt?: string;
  };
}

/** Prototype Controls — simulation settings for the mock integrations. */
export interface SimSettings {
  latencyMs: number;
  nafathAutoResolveMs: number;
  identityExists: 'auto' | 'force_existing' | 'force_new';
  mobileLinkedAccounts: number;
  govOutcomes: ('valid' | 'expired' | 'not_found' | 'unavailable' | 'provider_error')[];
  personsFixture: 'one' | 'multiple' | 'none';
  personsAvailability: 'available' | 'unavailable_once' | 'unavailable';
  nafathOutcomes: NafathOutcome[];
  certificatesFixture: 'none' | 'one' | 'multiple' | 'expired' | 'inconsistent' | 'attached' | 'mismatch' | 'restricted';
  certificatesAvailability: 'available' | 'unavailable_once' | 'unavailable';
  ibanOutcomes: ('verified' | 'not_verified' | 'technical_error')[];
  contractAction: 'reviewer_choice' | 'accept' | 'decline';
}
