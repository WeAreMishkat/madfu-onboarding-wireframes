/**
 * SYNTHETIC DEMONSTRATION FIXTURES
 *
 * Every identifier, name, mobile number and IBAN in this file is invented for
 * the prototype. Numbers follow obviously artificial patterns (runs of zeros)
 * and names use "Al-Sample"/"Al-Demo" style surnames. Do not replace these with
 * real merchant or personal data.
 */
import type { Certificate, CrRecord, RelatedParty, SimSettings } from '../state/types';

export const SYNTHETIC = {
  crNew: '1010000001',
  crExisting: '1010000099',
  nidNew: '1000000001',
  nidExisting: '1000000099',
  mobile: '500000001',
  mobileAlt: '500000002',
  otpCode: '123456',
} as const;

/** Mock "already registered" identity registry (in addition to demo submissions). */
export const EXISTING_IDENTITIES: Record<'CR' | 'FREELANCER', string[]> = {
  CR: [SYNTHETIC.crExisting],
  FREELANCER: [SYNTHETIC.nidExisting],
};

/** Mobile numbers already linked to other (different) accounts — informational only. */
export const MOBILE_LINKS: Record<string, number> = { [SYNTHETIC.mobileAlt]: 2 };

const company = (id: string, name: string): RelatedParty => ({ partyId: id, kind: 'COMPANY', role: 'PARTNER', names: [name] });

export const RELATED_PARTIES: Record<SimSettings['personsFixture'], RelatedParty[]> = {
  one: [
    { partyId: 'P-01', kind: 'INDIVIDUAL', role: 'OWNER', names: ['Faisal', 'Saad', 'Ibrahim', 'Al-Sample'], nationalId: '1000000011' },
    company('E-01', 'Sample Holding Company (Demo)'),
  ],
  multiple: [
    { partyId: 'P-01', kind: 'INDIVIDUAL', role: 'OWNER', names: ['Faisal', 'Saad', 'Ibrahim', 'Al-Sample'], nationalId: '1000000011' },
    { partyId: 'P-02', kind: 'INDIVIDUAL', role: 'MANAGER', names: ['Noura', 'Khalid', 'Abdullah', 'Al-Demo'], nationalId: '1000000022' },
    { partyId: 'P-03', kind: 'INDIVIDUAL', role: 'PARTNER', names: ['Omar', 'Fahad', 'Nasser', 'Al-Test'], nationalId: '1000000033' },
    company('E-01', 'Sample Holding Company (Demo)'),
    { partyId: 'E-02', kind: 'OTHER_ENTITY', role: 'PARTNER', names: ['Demo Investment Fund'] },
  ],
  none: [company('E-01', 'Sample Holding Company (Demo)'), { partyId: 'E-02', kind: 'OTHER_ENTITY', role: 'PARTNER', names: ['Demo Investment Fund'] }],
};

export function crRecord(crNumber: string, status: CrRecord['status'], parties: RelatedParty[]): CrRecord {
  return {
    crNumber,
    businessName: 'Sample Trading Establishment (Demo)',
    status,
    expiryDate: status === 'ACTIVE' ? '2027-12-31' : '2025-06-30',
    relatedParties: parties,
  };
}

const cert = (n: string, activityCode: string, govCategory: string, govSubcategory: string, extra: Partial<Certificate> = {}): Certificate => ({
  certificateNumber: n,
  activityCode,
  govCategory,
  govSubcategory,
  status: 'ACTIVE',
  holderMatches: true,
  attachedToExistingAccount: false,
  ...extra,
});

const design = (n: string, extra: Partial<Certificate> = {}) => cert(n, 'FL-DES-01', 'Design services', 'Graphic design', extra);

export const CERTIFICATES: Record<SimSettings['certificatesFixture'], Certificate[]> = {
  none: [],
  one: [design('FL-000000101')],
  multiple: [
    design('FL-000000101'),
    cert('FL-000000102', 'FL-PHO-01', 'Media & content', 'Photography'),
    cert('FL-000000103', 'FL-EDU-01', 'Education services', 'Private tutoring'),
  ],
  expired: [design('FL-000000104', { status: 'EXPIRED' })],
  inconsistent: [design('FL-000000105', { holderMatches: false })],
  attached: [design('FL-000000106', { attachedToExistingAccount: true }), cert('FL-000000102', 'FL-PHO-01', 'Media & content', 'Photography')],
  mismatch: [cert('FL-000000107', 'FL-PHO-01', 'Media & content', 'Photography')],
  restricted: [cert('FL-000000108', 'FL-RST-01', 'Fixture — restricted activity', 'Fixture — restricted sub-activity')],
};

/** Certificate numbers already linked to an existing Madfu account (manual-entry duplicate check). */
export const ATTACHED_CERTIFICATES = ['FL-000000106'];

/** Deterministic two-digit Nafath request numbers (by request index). */
export const NAFATH_NUMBERS = [42, 17, 86, 53, 29, 61];

/** Build a structurally valid Saudi IBAN (ISO 13616 mod-97) from a synthetic BBAN. */
export function makeSaudiIban(bban: string): string {
  const rearranged = `${bban}SA00`;
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  const check = String(98 - rem).padStart(2, '0');
  return `SA${check}${bban}`;
}

export const SYNTHETIC_IBANS = {
  primary: makeSaudiIban('80000000000000000001'),
  secondary: makeSaudiIban('80000000000000000002'),
};

export const DEFAULT_SIM: SimSettings = {
  latencyMs: 700,
  nafathAutoResolveMs: 4000,
  identityExists: 'auto',
  mobileLinkedAccounts: 0,
  govOutcomes: ['valid'],
  personsFixture: 'multiple',
  personsAvailability: 'available',
  nafathOutcomes: ['verified'],
  certificatesFixture: 'one',
  certificatesAvailability: 'available',
  ibanOutcomes: ['verified'],
  contractAction: 'reviewer_choice',
};
