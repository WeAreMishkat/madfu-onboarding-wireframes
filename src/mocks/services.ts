/**
 * INTEGRATION ADAPTERS (typed interfaces) + DETERMINISTIC MOCK IMPLEMENTATIONS
 *
 * No real government, Nafath, SMS, banking or e-signature service is called.
 * Each mock reads the Prototype Controls settings and returns a configurable,
 * deterministic outcome. Outcome sequences are indexed by call number, and the
 * last entry repeats — e.g. Nafath ['rejected', 'verified'] = fail then succeed.
 *
 * The interfaces document what the real integrations must provide; they do not
 * claim real API behaviour has been proven (see docs/business-rules).
 */
import type { ApplicantType } from '../rules/config';
import { CATEGORY_CATALOGUE, type Category } from '../rules/categories';
import type { Certificate, CrRecord, NafathOutcome, RelatedParty, SimSettings } from '../state/types';
import { ATTACHED_CERTIFICATES, CERTIFICATES, EXISTING_IDENTITIES, MOBILE_LINKS, NAFATH_NUMBERS, RELATED_PARTIES, SYNTHETIC, crRecord } from './fixtures';

// ---------- Interfaces ----------

export interface IdentityRegistryService {
  /** Check 1 — is the CR / National ID already registered with Madfu? */
  identityExists(type: ApplicantType, identification: string): Promise<boolean>;
  /** Check 2 — how many other accounts use this mobile (informational, never blocks). */
  mobileLinkedAccounts(mobile: string): Promise<number>;
  /** Manual-entry certificate duplicate check (internal DB, no third-party cost). */
  certificateAttached(certificateNumber: string): Promise<boolean>;
}

export interface OtpService {
  send(mobile: string): Promise<{ code: string; ttlSeconds: number }>;
}

export type CrLookupResult = { kind: 'valid' | 'expired'; record: CrRecord } | { kind: 'not_found' | 'unavailable' | 'provider_error' };

export interface GovernmentCrService {
  lookup(crNumber: string, callIndex: number): Promise<CrLookupResult>;
  relatedParties(crNumber: string, callIndex: number): Promise<{ kind: 'ok'; parties: RelatedParty[] } | { kind: 'unavailable' }>;
}

export interface CertificateService {
  listByNationalId(nationalId: string, callIndex: number): Promise<{ kind: 'ok'; certificates: Certificate[] } | { kind: 'unavailable' }>;
}

export interface NafathService {
  /** Create a request. Returns the two-digit number the user must pick in the Nafath app. */
  createRequest(nationalId: string, requestIndex: number): Promise<{ kind: 'created'; requestNumber: number } | { kind: 'technical_failure' }>;
  /** Final status of a request (polled / pushed in production). */
  status(requestIndex: number): Exclude<NafathOutcome, 'technical_failure'>;
}

export interface IbanOwnershipService {
  verify(iban: string, target: 'REGISTERED_BUSINESS' | 'INDIVIDUAL_NATIONAL_ID', callIndex: number): Promise<'verified' | 'not_verified' | 'technical_error'>;
}

export interface CategoryService {
  catalogue(): Promise<Category[]>;
}

export interface ContractService {
  document(): { version: string; title: string; sections: { heading: string; body: string }[] };
  recordAcceptance(applicationId: string): Promise<{ acceptanceId: string }>;
}

export interface Services {
  registry: IdentityRegistryService;
  otp: OtpService;
  gov: GovernmentCrService;
  certificates: CertificateService;
  nafath: NafathService;
  iban: IbanOwnershipService;
  category: CategoryService;
  contract: ContractService;
}

// ---------- Mock implementation ----------

const pick = <T>(seq: T[], index: number): T => seq[Math.min(index, seq.length - 1)];
const wait = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export const DEMO_REGISTRY_KEY = 'madfu-demo:submitted-identities:v1';

/** Identities of demo applications submitted in this browser (prevents accidental resubmission). */
export function readSubmittedRegistry(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_REGISTRY_KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function addToSubmittedRegistry(key: string) {
  try {
    const list = readSubmittedRegistry();
    if (!list.includes(key)) localStorage.setItem(DEMO_REGISTRY_KEY, JSON.stringify([...list, key]));
  } catch {
    /* storage unavailable — demo still works without it */
  }
}

export const CONTRACT_DOCUMENT = {
  version: 'PLACEHOLDER-v0',
  title: 'Merchant Agreement — placeholder text (not a legal document)',
  sections: [
    {
      heading: '1. About this placeholder',
      body: 'This wireframe shows where the Madfu merchant agreement will be displayed. The final contract text, versioning and signature technology are pending legal and product decisions. Nothing on this page is legally binding.',
    },
    {
      heading: '2. Parties',
      body: 'The agreement will identify Madfu and the applying merchant using the verified business or freelancer details captured earlier in the application.',
    },
    { heading: '3. Services', body: 'Placeholder for the description of the Buy Now, Pay Later services Madfu provides to the merchant and their customers.' },
    {
      heading: '4. Fees and settlement',
      body: 'Placeholder for commercial terms. Settlement will be made to the IBAN provided in the business details step, subject to verification.',
    },
    { heading: '5. Merchant obligations', body: 'Placeholder for merchant obligations, permitted business activities, and compliance requirements.' },
    { heading: '6. Data and privacy', body: 'Placeholder for data protection, consent and record-keeping terms.' },
    { heading: '7. Term and termination', body: 'Placeholder for agreement duration and termination rights.' },
    { heading: '8. Acceptance', body: 'In this prototype, acceptance is simulated. The production signature/acceptance mechanism has not been decided.' },
  ],
};

export function createMockServices(getSim: () => SimSettings): Services {
  const latency = () => wait(getSim().latencyMs);
  return {
    registry: {
      async identityExists(type, identification) {
        await latency();
        const sim = getSim();
        if (sim.identityExists === 'force_existing') return true;
        if (sim.identityExists === 'force_new') return false;
        return EXISTING_IDENTITIES[type].includes(identification) || readSubmittedRegistry().includes(`${type}:${identification}`);
      },
      async mobileLinkedAccounts(mobile) {
        await latency();
        return Math.max(getSim().mobileLinkedAccounts, MOBILE_LINKS[mobile] ?? 0);
      },
      async certificateAttached(certificateNumber) {
        await latency();
        return ATTACHED_CERTIFICATES.includes(certificateNumber);
      },
    },
    otp: {
      async send() {
        await latency();
        return { code: SYNTHETIC.otpCode, ttlSeconds: 120 };
      },
    },
    gov: {
      async lookup(crNumber, callIndex) {
        await latency();
        const outcome = pick(getSim().govOutcomes, callIndex);
        if (outcome === 'valid') return { kind: 'valid', record: crRecord(crNumber, 'ACTIVE', []) };
        if (outcome === 'expired') return { kind: 'expired', record: crRecord(crNumber, 'EXPIRED', []) };
        return { kind: outcome };
      },
      async relatedParties(_cr, callIndex) {
        await latency();
        const sim = getSim();
        if (sim.personsAvailability === 'unavailable' || (sim.personsAvailability === 'unavailable_once' && callIndex === 0)) return { kind: 'unavailable' };
        return { kind: 'ok', parties: RELATED_PARTIES[sim.personsFixture] };
      },
    },
    certificates: {
      async listByNationalId(_nid, callIndex) {
        await latency();
        const sim = getSim();
        if (sim.certificatesAvailability === 'unavailable' || (sim.certificatesAvailability === 'unavailable_once' && callIndex === 0)) return { kind: 'unavailable' };
        return { kind: 'ok', certificates: CERTIFICATES[sim.certificatesFixture] };
      },
    },
    nafath: {
      async createRequest(_nid, requestIndex) {
        await latency();
        if (pick(getSim().nafathOutcomes, requestIndex) === 'technical_failure') return { kind: 'technical_failure' };
        return { kind: 'created', requestNumber: NAFATH_NUMBERS[requestIndex % NAFATH_NUMBERS.length] };
      },
      status(requestIndex) {
        const outcome = pick(getSim().nafathOutcomes, requestIndex);
        return outcome === 'technical_failure' ? 'timeout' : outcome;
      },
    },
    iban: {
      async verify(_iban, _target, callIndex) {
        await latency();
        return pick(getSim().ibanOutcomes, callIndex);
      },
    },
    category: {
      async catalogue() {
        return CATEGORY_CATALOGUE;
      },
    },
    contract: {
      document: () => CONTRACT_DOCUMENT,
      async recordAcceptance(applicationId) {
        await latency();
        return { acceptanceId: `SIM-ACC-${applicationId}` };
      },
    },
  };
}
