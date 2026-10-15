/**
 * MASTER BOARD MODEL — nodes and edges of the unified onboarding flow board.
 *
 * Screen nodes reference the implemented screens (screenId) and render a real
 * gallery state (stateId) built by the journey engine. Every edge carries the
 * business condition and a guard evaluated against engine runs; journeys are
 * derived from those runs (see journeys.ts) and the unit tests fail if any
 * transition the engine performs is missing from this board.
 */
import type { Application } from '../state/types';
import type { BoardEdgeDef, BoardNodeDef, GuardCtx, HandleId, LaneDef } from './types';

// ---------- geometry ----------

export const SIZE = {
  screen: { w: 380, h: 330 },
  small: { w: 210, h: 92 },
  connector: { w: 210, h: 64 },
};

export const LANES: LaneDef[] = [
  { id: 'shared', title: 'Shared entry & eligibility', subtitle: 'Both applicant types · entry → duplicate checks → OTP → revenue → category', y: 0, height: 900 },
  { id: 'cr', title: 'Path A — Registered Business (CR)', subtitle: 'CR verification → authorized person → Nafath → details → contract', y: 940, height: 900 },
  { id: 'fl', title: 'Path B — Freelancer', subtitle: 'Nafath on National ID → certificates → details → contract', y: 1880, height: 900 },
  { id: 'manual', title: 'Manual review & sales leads', subtitle: 'Applications leaving self-onboarding', y: 2820, height: 320 },
  { id: 'outcome', title: 'Final outcomes', subtitle: 'What the applicant sees (internal statuses stay internal)', y: 3180, height: 480 },
];
/** Horizontal spread factor applied to authored x positions (keeps labels clear of nodes). */
const KX = 1.3;
const sx = (x: number) => Math.round(60 + (x - 60) * KX);
export const BOARD_X0 = -180;
export const BOARD_X1 = sx(10420);

const laneY = (id: string) => LANES.find((l) => l.id === id)!.y;
/** Row tops for screens (A/B) and small nodes centred on them. */
const rowA = (lane: string) => laneY(lane) + 130;
const rowB = (lane: string) => laneY(lane) + (lane === 'shared' ? 520 : 520);
const smallA = (lane: string) => rowA(lane) + (SIZE.screen.h - SIZE.small.h) / 2;
const smallB = (lane: string) => rowB(lane);

export function nodeSize(n: Pick<BoardNodeDef, 'kind'>) {
  if (n.kind === 'screen' || n.kind === 'outcome' || n.kind === 'future') return SIZE.screen;
  if (n.kind === 'connector') return SIZE.connector;
  return SIZE.small;
}

// ---------- guard helpers ----------

const has = (app: Application, type: string, includes?: string) => app.audit.some((a) => a.type === type && (!includes || a.detail.includes(includes)));
const flag = (c: GuardCtx, ...codes: string[]) => codes.some((x) => c.flags.has(x));
const isCR = (app: Application) => app.entry.applicantType === 'CR';
const failedAttempts = (app: Application) => app.nafath.attempts.filter((a) => a.outcome === 'rejected' || a.outcome === 'timeout').length;

// ---------- nodes ----------

const N: BoardNodeDef[] = [];
const screen = (
  id: string,
  lane: BoardNodeDef['lane'],
  x: number,
  y: number,
  screenId: BoardNodeDef['screenId'],
  stateId: string,
  title: string,
  applicant: BoardNodeDef['applicant'],
  extra: Partial<BoardNodeDef> = {},
) => N.push({ id, kind: 'screen', lane, x, y, screenId, stateId, title, applicant, ...extra });
const small = (
  id: string,
  kind: BoardNodeDef['kind'],
  lane: BoardNodeDef['lane'],
  x: number,
  y: number,
  title: string,
  applicant: BoardNodeDef['applicant'],
  details: BoardNodeDef['details'],
  subtitle?: string,
) => N.push({ id, kind, lane, x, y, title, subtitle, applicant, details });

// Shared entry & eligibility
screen('s.S01', 'shared', 60, rowA('shared'), 'S01', 'S01--filled-cr', 'S01 Start application', 'Both', { badge: 'START · new applicant (both types)' });
small(
  'd.identity',
  'decision',
  'shared',
  520,
  smallA('shared'),
  'Identity already registered?',
  'Both',
  {
    rule: 'Duplicate check 1 runs first: CR number (business) or National ID (freelancer). If it exists the application stops and the mobile check is skipped.',
    source: 'engine.submitEntry → IdentityRegistryService.identityExists',
  },
  'Check 1 · CR / National ID',
);
small(
  'p.mobile',
  'process',
  'shared',
  790,
  smallA('shared'),
  'Check 2 · mobile linkage',
  'Both',
  {
    rule: 'Only runs for a new identity. Records how many other accounts use the mobile (flag MOBILE_LINKED_TO_OTHER_ACCOUNTS). Never blocks — the same mobile may serve several CRs / identities.',
    source: 'IdentityRegistryService.mobileLinkedAccounts',
  },
  'informational · never blocks',
);
small(
  'x.sms',
  'external',
  'shared',
  1060,
  smallA('shared'),
  'Send SMS OTP',
  'Both',
  { rule: 'Simulated SMS OTP. The code is never shown in the customer UI.', source: 'OtpService.send' },
  'simulated',
);
screen('s.S02', 'shared', 1330, rowA('shared'), 'S02', 'S02--default', 'S02 Mobile OTP', 'Both');
small(
  'd.otp',
  'decision',
  'shared',
  1790,
  smallA('shared'),
  'Code correct?',
  'Both',
  { rule: 'Correct code → verified. Max 3 incorrect attempts; expired codes do not consume an attempt.', source: 'engine.verifyOtp · OTP_POLICY' },
  'max 3 incorrect',
);
small(
  'd.revenue',
  'decision',
  'shared',
  2060,
  smallA('shared'),
  'Revenue routing',
  'Both',
  {
    rule: 'Registered Business: SAR 100,000–20,000,000 self-onboards; below / above becomes a sales lead. Freelancer: every band self-onboards. Exactly SAR 100,000 = self-onboarding (provisional D-01).',
    source: 'decisions.routeByRevenue · REVENUE_ROUTING',
  },
  'CR range 100K–20M',
);
screen('s.S03', 'shared', 2330, rowA('shared'), 'S03', 'S03--selected', 'S03 Business category', 'Both');
small(
  'd.category',
  'decision',
  'shared',
  2790,
  smallA('shared'),
  'Category eligibility',
  'Both',
  {
    rule: 'Madfu catalogue screening BEFORE any paid verification. Restricted → lead. Pending review → lead (configurable). CR-only chosen by a freelancer → flagged, not rejected.',
    source: 'decisions.decideCategory · CATEGORY_POLICY · categories.ts (fixture)',
  },
  'before paid checks',
);
screen('s.S00', 'shared', 60, rowB('shared'), 'S00', 'S00--resume', 'S00 Resume application', 'Both', { badge: 'START · returning applicant' });
N.push({
  id: 'c.resume',
  kind: 'connector',
  lane: 'shared',
  x: 520,
  y: rowB('shared') + (SIZE.screen.h - SIZE.connector.h) / 2,
  title: '↪ Continue at the last saved step',
  applicant: 'Both',
  details: { rule: 'Resumes the saved application at its current screen (any step).', source: 'engine.resume · browser-storage persistence' },
});
screen('s.S01X', 'shared', 790, rowB('shared'), 'S01-X', 'S01-X--freelancer', 'S01-X Existing account', 'Both');
N.push({
  id: 's.S01F',
  kind: 'future',
  lane: 'shared',
  x: 1250,
  y: rowB('shared'),
  screenId: 'S01-F',
  stateId: 'S01-F--future',
  title: 'S01-F Add another certificate',
  applicant: 'FREELANCER',
  badge: 'FUTURE FLOW · pending specification',
});
screen('s.S02L', 'shared', 1705, rowB('shared'), 'S02-L', 'S02-L--locked', 'S02-L Verification locked', 'Both');

// Path A — Registered Business
small(
  'x.gov',
  'external',
  'cr',
  3120,
  smallA('cr'),
  'Government CR lookup',
  'CR',
  { rule: 'Retrieves CR data. Each call recorded in the paid-call ledger.', source: 'GovernmentCrService.lookup' },
  'paid call',
);
screen('cr.S04', 'cr', 3400, rowA('cr'), 'S04', 'S04--valid', 'S04 Business verification', 'CR');
small('d.crResult', 'decision', 'cr', 3860, smallA('cr'), 'CR result', 'CR', {
  rule: 'Valid → continue. Expired → continue with flag CR_EXPIRED. Not found → correct the CR. Unavailable → 2 automatic + 3 manual retries, then save & exit. Provider error → retry.',
  source: 'engine.lookupCr · GOV_POLICY',
});
N.push({
  id: 'c.editCR',
  kind: 'connector',
  lane: 'cr',
  x: 3400,
  y: rowB('cr') + 108,
  title: '↩ Edit CR number → S01',
  applicant: 'CR',
  details: { rule: 'Invalid / not-found CR cannot proceed; the applicant corrects it on S01 (identity checks re-run).', source: 'engine.editCrNumber' },
});
small(
  'f.crExpired',
  'manual',
  'cr',
  4130,
  smallB('cr'),
  'Flag CR_EXPIRED',
  'CR',
  { rule: 'Applicant may proceed; marked for subsequent review.', source: 'engine.lookupCr' },
  'continue · review later',
);
small('p.parties', 'process', 'cr', 4130, smallA('cr'), 'Related parties → individuals only', 'CR', {
  rule: 'Owners / managers from the CR. Companies and other entities are filtered out — never Nafath candidates.',
  source: 'GovernmentCrService.relatedParties · decisions.eligibleIndividuals',
});
screen('cr.S05', 'cr', 4410, rowA('cr'), 'S05', 'S05--selected', 'S05 Authorized person', 'CR');
small('d.individuals', 'decision', 'cr', 4870, smallA('cr'), 'Eligible individual selected?', 'CR', {
  rule: 'Exactly one individual must be selected. If the CR lists no individuals → manual identity verification.',
  source: 'engine.submitPerson / continueWithoutEligiblePerson',
});
small(
  'm.noIndividual',
  'manual',
  'cr',
  4870,
  smallB('cr') + 140,
  'No eligible individual',
  'CR',
  { rule: 'Nafath not possible. Flag NO_ELIGIBLE_AUTHORISED_PERSON; manual identity verification; contract disabled.', source: 'engine.continueWithoutEligiblePerson' },
  'entities only on CR',
);
screen('cr.S06', 'cr', 5150, rowA('cr'), 'S06', 'S06--waiting', 'S06 Nafath (authorized person)', 'CR');
small(
  'x.nafathCR',
  'external',
  'cr',
  5610,
  smallA('cr'),
  'Nafath request',
  'CR',
  { rule: 'Request to the selected person’s National ID; two-digit matching number. Recorded in the paid-call ledger.', source: 'NafathService.createRequest / status' },
  'paid call · 2-digit number',
);
small('d.nafathCR', 'decision', 'cr', 5880, smallA('cr'), 'Nafath result', 'CR', {
  rule: 'Verified, rejected, timed out or technical failure (technical failure uses no attempt — provisional D-11).',
  source: 'engine.resolveNafath',
});
small(
  'd.attemptsCR',
  'decision',
  'cr',
  5880,
  smallB('cr'),
  'Attempts used (max 2)',
  'CR',
  { rule: 'Two attempts per application, shared across individuals. Changing the person never resets the counter.', source: 'NAFATH_POLICY · decisions.nafathExhausted' },
  'shared counter',
);
small(
  'm.nafathCR',
  'manual',
  'cr',
  6245,
  smallB('cr'),
  'Nafath unverified',
  'CR',
  { rule: 'NAFATH_MANUAL_VERIFICATION. Applicant continues to business details; contract signing disabled.', source: 'engine.resolveNafath' },
  'manual verification · no contract',
);
screen('cr.S08', 'cr', 6160, rowA('cr'), 'S08', 'S08--verified', 'S08 Business details', 'CR');
small(
  'd.ibanEligCR',
  'decision',
  'cr',
  6620,
  smallA('cr'),
  'Call IBAN ownership API?',
  'CR',
  { rule: 'Only when Nafath is verified (CR without Nafath: not called — provisional D-12).', source: 'decisions.shouldCallIbanOwnership · IBAN_POLICY' },
  'Nafath verified?',
);
small(
  'x.ibanCR',
  'external',
  'cr',
  6890,
  smallA('cr'),
  'IBAN ownership API',
  'CR',
  { rule: 'Matches the IBAN to the registered business. Runs when the field is left; never repeated for an unchanged value.', source: 'IbanOwnershipService.verify' },
  'match: registered business',
);
small('d.ibanCR', 'decision', 'cr', 7160, smallA('cr'), 'Ownership result', 'CR', {
  rule: 'Verified → continue. 1st failure / technical error → correct or retry. 2 failures or 3 technical errors → continue flagged.',
  source: 'engine.verifyIban',
});
small(
  'm.ibanCR',
  'manual',
  'cr',
  7160,
  smallB('cr'),
  'IBAN unverified / pending',
  'CR',
  {
    rule: 'Failed twice → manual financial verification. Provider outage → pending (separate, policy D-10). Not checked → manual review.',
    source: 'engine.verifyIban / submitBusiness',
  },
  'flagged · does not block contract',
);
small(
  'd.contractCR',
  'decision',
  'cr',
  7430,
  smallA('cr'),
  'Contract eligible?',
  'CR',
  { rule: 'Nafath verified AND no blocking review flag. IBAN status never blocks when Nafath succeeded.', source: 'decisions.contractEligibility' },
  'Nafath is decisive',
);
screen('cr.S09', 'cr', 7710, rowA('cr'), 'S09', 'S09--default', 'S09 Merchant agreement', 'CR');
small('d.acceptCR', 'decision', 'cr', 8170, smallA('cr'), 'Accept or decline?', 'CR', {
  rule: 'Simulated acceptance with confirmation. Decline keeps the application saved and unsubmitted.',
  source: 'engine.acceptContract / confirmDecline',
});
small(
  'p.acceptCR',
  'process',
  'cr',
  8440,
  smallA('cr'),
  'Record acceptance',
  'CR',
  { rule: 'Simulated, not legally binding. Signature technology pending (D-02).', source: 'ContractService.recordAcceptance' },
  'simulated',
);
screen('cr.S09D', 'cr', 8085, rowB('cr'), 'S09-D', 'S09-D--declined', 'S09-D Agreement not accepted', 'CR');

// Path B — Freelancer
small(
  'f.crOnly',
  'manual',
  'fl',
  3120,
  smallB('fl'),
  'Flag CR-only category',
  'FREELANCER',
  { rule: 'CR_ONLY_CATEGORY_FREELANCER — never auto-rejected; business team decides.', source: 'decisions.decideCategory' },
  'continue · business decides',
);
screen('fl.S06', 'fl', 3400, rowA('fl'), 'S06', 'S06--fl-waiting', 'S06 Nafath (National ID)', 'FREELANCER');
small(
  'x.nafathFL',
  'external',
  'fl',
  3860,
  smallA('fl'),
  'Nafath request',
  'FREELANCER',
  { rule: 'Request to the National ID entered on S01.', source: 'NafathService.createRequest / status' },
  'paid call · 2-digit number',
);
small('d.nafathFL', 'decision', 'fl', 4130, smallA('fl'), 'Nafath result', 'FREELANCER', {
  rule: 'Verified, rejected, timed out or technical failure.',
  source: 'engine.resolveNafath',
});
small('d.attemptsFL', 'decision', 'fl', 4130, smallB('fl'), 'Attempts used (max 2)', 'FREELANCER', {
  rule: 'Two attempts per application. After two unsuccessful attempts the freelancer continues via manual certificate entry.',
  source: 'NAFATH_POLICY',
});
small(
  'x.certs',
  'external',
  'fl',
  4410,
  smallA('fl'),
  'Certificate lookup',
  'FREELANCER',
  { rule: 'Freelancing certificates for the verified National ID. Missing certificates are never invented.', source: 'CertificateService.listByNationalId' },
  'paid call',
);
screen('fl.S07', 'fl', 4690, rowA('fl'), 'S07', 'S07--multiple', 'S07 Certificate selection', 'FREELANCER');
small('d.certs', 'decision', 'fl', 5150, smallA('fl'), 'Certificate available?', 'FREELANCER', {
  rule: 'Exactly one selectable certificate chosen → reconcile. None found (or all already attached) → manual entry.',
  source: 'engine.submitCertificate / enterCertificateManually',
});
screen('fl.S07M', 'fl', 4410, rowB('fl'), 'S07-M', 'S07-M--manual', 'S07-M Manual certificate entry', 'FREELANCER');
small(
  'm.manualCert',
  'manual',
  'fl',
  4870,
  rowB('fl') + 119,
  'Certificate entered manually',
  'FREELANCER',
  {
    rule: 'Identity and/or certificate association unverified → manual review; contract disabled. IBAN collected without the ownership API when Nafath failed.',
    source: 'engine.submitManualCertificate',
  },
  'manual review · no contract',
);
small('p.recon', 'process', 'fl', 5420, smallA('fl'), 'Reconcile with Madfu category', 'FREELANCER', {
  rule: 'Maps certificate activity to the Madfu catalogue (taxonomies differ). Preliminary selection is preserved.',
  source: 'decisions.reconcileCertificate · GOV_ACTIVITY_TO_MADFU',
});
small('d.recon', 'decision', 'fl', 5690, smallA('fl'), 'Reconciliation result', 'FREELANCER', {
  rule: 'Match → continue. Mismatch / expired / inconsistent → flagged. Restricted mapping → lead (Nafath cost already incurred, no further paid checks).',
  source: 'decisions.reconcileCertificate',
});
small(
  'f.certFlag',
  'manual',
  'fl',
  5690,
  smallB('fl'),
  'Certificate flagged',
  'FREELANCER',
  { rule: 'CATEGORY_MISMATCH continues normally; CERT_EXPIRED / CERT_INCONSISTENT keep the contract disabled (provisional D-06).', source: 'decisions.reconcileCertificate' },
  'mismatch / expired / inconsistent',
);
screen('fl.S08', 'fl', 6160, rowA('fl'), 'S08', 'S08--fl-verified', 'S08 Business details', 'FREELANCER');
small(
  'd.ibanEligFL',
  'decision',
  'fl',
  6620,
  smallA('fl'),
  'Call IBAN ownership API?',
  'FREELANCER',
  { rule: 'Only when Nafath is verified. Freelancer without Nafath: IBAN collected, API never called (confirmed).', source: 'decisions.shouldCallIbanOwnership' },
  'Nafath verified?',
);
small(
  'x.ibanFL',
  'external',
  'fl',
  6890,
  smallA('fl'),
  'IBAN ownership API',
  'FREELANCER',
  { rule: 'Matches the IBAN to the individual National ID.', source: 'IbanOwnershipService.verify' },
  'match: National ID',
);
small('d.ibanFL', 'decision', 'fl', 7160, smallA('fl'), 'Ownership result', 'FREELANCER', {
  rule: 'Same rules as Path A: max 2 unsuccessful checks, 3 technical errors → pending.',
  source: 'engine.verifyIban',
});
small(
  'm.ibanFL',
  'manual',
  'fl',
  7160,
  smallB('fl'),
  'IBAN unverified / pending',
  'FREELANCER',
  { rule: 'Flagged for manual financial verification or pending provider; does not block the contract when Nafath succeeded.', source: 'engine.verifyIban' },
  'flagged',
);
small(
  'd.contractFL',
  'decision',
  'fl',
  7430,
  smallA('fl'),
  'Contract eligible?',
  'FREELANCER',
  { rule: 'Nafath verified AND no blocking certificate flag.', source: 'decisions.contractEligibility' },
  'Nafath is decisive',
);
screen('fl.S09', 'fl', 7710, rowA('fl'), 'S09', 'S09--fl', 'S09 Merchant agreement', 'FREELANCER');
small('d.acceptFL', 'decision', 'fl', 8170, smallA('fl'), 'Accept or decline?', 'FREELANCER', {
  rule: 'Simulated acceptance with confirmation.',
  source: 'engine.acceptContract / confirmDecline',
});
small(
  'p.acceptFL',
  'process',
  'fl',
  8440,
  smallA('fl'),
  'Record acceptance',
  'FREELANCER',
  { rule: 'Simulated, not legally binding.', source: 'ContractService.recordAcceptance' },
  'simulated',
);
screen('fl.S09D', 'fl', 8085, rowB('fl'), 'S09-D', 'S09-D--fl', 'S09-D Agreement not accepted', 'FREELANCER');

// Manual review & sales leads
const mY = laneY('manual') + 110;
small(
  'l.revenue',
  'manual',
  'manual',
  2060,
  mY,
  'Revenue outside CR range',
  'CR',
  { rule: 'SALES_LEAD_REVENUE. Saved after OTP; no authorized persons, Nafath, IBAN, VAT, channels or contract requested.', source: 'engine.afterOtpVerified' },
  'lead · no paid calls',
);
small(
  'l.category',
  'manual',
  'manual',
  2790,
  mY,
  'Restricted / review category',
  'Both',
  { rule: 'CATEGORY_RESTRICTED or CATEGORY_REVIEW_REQUIRED. Stopped before CR lookup and Nafath (no paid calls).', source: 'decisions.decideCategory' },
  'lead · no paid calls',
);
small(
  'l.cert',
  'manual',
  'manual',
  5690,
  mY,
  'Certificate maps to restricted',
  'FREELANCER',
  { rule: 'CATEGORY_RESTRICTED_POST_NAFATH. Records that Nafath / lookup cost was already incurred; no further paid checks.', source: 'decisions.reconcileCertificate' },
  'lead · cost recorded',
);
small(
  'm.saveLead',
  'process',
  'manual',
  7990,
  mY,
  'Save sales / review lead',
  'Both',
  { rule: 'Internal status SALES_LEAD. Neutral confirmation; restriction reasons are never shown.', source: 'engine.submit(C_SALES_LEAD)' },
  'SALES_LEAD',
);
small(
  'm.manualFL',
  'process',
  'manual',
  9115,
  mY,
  'Submit for manual verification',
  'FREELANCER',
  { rule: 'Submitted without contract (Nafath unverified and/or certificate review). Neutral confirmation.', source: 'engine.submit(B_RECEIVED)' },
  'Path B · APPLICATION_SUBMITTED',
);
small(
  'm.manualCR',
  'process',
  'manual',
  9955,
  mY,
  'Submit for manual verification',
  'CR',
  { rule: 'Submitted without contract (Nafath unverified / no eligible individual). Neutral confirmation.', source: 'engine.submit(B_RECEIVED)' },
  'Path A · APPLICATION_SUBMITTED',
);

// Final outcomes — one instance per path keeps every connector vertical (same screen ID, same component).
const oY = laneY('outcome') + 80;
const outcome = (id: string, x: number, screenId: 'O-A' | 'O-B' | 'O-C', stateId: string, title: string, applicant: BoardNodeDef['applicant']) =>
  N.push({ id, kind: 'outcome', lane: 'outcome', x, y: oY, screenId, stateId, title, applicant, badge: 'END' });
outcome('o.OC', 7905, 'O-C', 'O-C--lead', 'O-C Interest received (sales lead)', 'Both');
outcome('o.OA.fl', 8610, 'O-A', 'O-A--submitted', 'O-A Submitted · Freelancer', 'FREELANCER');
outcome('o.OB.fl', 9030, 'O-B', 'O-B--received', 'O-B Received · Freelancer', 'FREELANCER');
outcome('o.OA.cr', 9450, 'O-A', 'O-A--submitted', 'O-A Submitted · Registered Business', 'CR');
outcome('o.OB.cr', 9870, 'O-B', 'O-B--received', 'O-B Received · Registered Business', 'CR');

// Apply the horizontal spread once, before any handle / route is computed.
for (const n of N) n.x = sx(n.x + nodeSize(n).w / 2) - nodeSize(n).w / 2; // scale centres so stacked nodes stay aligned
export const BOARD_NODES = N;
export const nodeById = (id: string) => N.find((n) => n.id === id)!;

/** Absolute coordinate of a handle. */
export function H(id: string, h: HandleId): [number, number] {
  const n = nodeById(id);
  const { w, h: ht } = nodeSize(n);
  const map: Record<HandleId, [number, number]> = {
    t: [w / 2, 0],
    b: [w / 2, ht],
    l: [0, ht / 2],
    r: [w, ht / 2],
    tl: [w * 0.3, 0],
    tr: [w * 0.7, 0],
    bl: [w * 0.3, ht],
    br: [w * 0.7, ht],
  };
  return [n.x + map[h][0], n.y + map[h][1]];
}

// ---------- edges ----------

const E: BoardEdgeDef[] = [];
const edge = (e: Omit<BoardEdgeDef, 'kind'> & { kind?: BoardEdgeDef['kind'] }) => E.push({ kind: 'flow', ...e });
/** Small loop drawn above a node or between two neighbouring nodes (retry). */
const arcAbove = (from: string, fh: HandleId, to: string, th: HandleId, lift = 56): [number, number][] => {
  const [x1, y1] = H(from, fh);
  const [x2, y2] = H(to, th);
  const y = Math.min(y1, y2) - lift;
  return [
    [x1, y],
    [x2, y],
  ];
};
const arcBelow = (from: string, fh: HandleId, to: string, th: HandleId, drop = 40): [number, number][] => {
  const [x1, y1] = H(from, fh);
  const [x2, y2] = H(to, th);
  const y = Math.max(y1, y2) + drop;
  return [
    [x1, y],
    [x2, y],
  ];
};

// Shared
edge({ id: 'e.s01-identity', source: 's.S01', target: 'd.identity', label: 'Next · fields valid', condition: 'All four fields pass structural validation.', guard: () => true });
edge({
  id: 'e.s01-loop',
  source: 's.S01',
  sh: 'tr',
  target: 's.S01',
  th: 'tl',
  kind: 'loop',
  label: 'Validation errors',
  condition: 'Missing or invalid fields — inline errors and summary.',
  via: arcAbove('s.S01', 'tr', 's.S01', 'tl', 84),
  guard: ({ app }) => has(app, 'VALIDATION_FAILED', 'S01'),
});
edge({
  id: 'e.identity-yes',
  source: 'd.identity',
  sh: 'b',
  target: 's.S01X',
  th: 't',
  via: [
    [H('d.identity', 'b')[0], 470],
    [H('s.S01X', 't')[0], 470],
  ],
  labelAt: [H('s.S01X', 't')[0] - 150, 470],
  label: 'Yes · stop (mobile check skipped)',
  condition: 'CR / National ID already registered.',
  guard: ({ app }) => app.duplicate.identityExists,
});
edge({ id: 'e.identity-no', source: 'd.identity', target: 'p.mobile', label: 'No', condition: 'New identity.', guard: ({ app }) => app.duplicate.mobileChecked });
edge({
  id: 'e.mobile-sms',
  source: 'p.mobile',
  target: 'x.sms',
  label: 'Needs OTP',
  condition: 'OTP required for this mobile.',
  guard: ({ app }) => has(app, 'OTP_SENT'),
});
edge({
  id: 'e.mobile-skip',
  source: 'p.mobile',
  sh: 't',
  target: 'd.revenue',
  th: 't',
  label: 'Same mobile already verified in this application → skip OTP',
  condition: 'Applicant returned to S01 after OTP and did not change the mobile.',
  via: [
    [H('p.mobile', 't')[0], 40],
    [H('d.revenue', 't')[0], 40],
  ],
  guard: ({ app }) => has(app, 'OTP_REUSED'),
});
edge({ id: 'e.sms-s02', source: 'x.sms', target: 's.S02', label: '', condition: 'SMS OTP sent.', guard: () => true });
edge({
  id: 'e.s02-loop',
  source: 's.S02',
  sh: 'tr',
  target: 's.S02',
  th: 'tl',
  kind: 'loop',
  label: 'Incorrect (< 3) · expired → resend',
  condition: 'Incorrect code shows remaining attempts; expired code offers a resend (no attempt used).',
  via: arcAbove('s.S02', 'tr', 's.S02', 'tl'),
  guard: ({ app }) => has(app, 'OTP_INCORRECT') || has(app, 'OTP_EXPIRED') || has(app, 'OTP_RESENT'),
});
edge({ id: 'e.s02-otp', source: 's.S02', target: 'd.otp', label: 'Verify', condition: 'Code submitted.', guard: () => true });
edge({
  id: 'e.otp-locked',
  source: 'd.otp',
  sh: 'b',
  target: 's.S02L',
  th: 't',
  label: '3rd incorrect → locked',
  condition: 'Maximum incorrect attempts reached.',
  guard: ({ app }) => app.otp.status === 'locked',
});
edge({ id: 'e.otp-revenue', source: 'd.otp', target: 'd.revenue', label: 'Verified', condition: 'Correct, unexpired code.', guard: ({ app }) => has(app, 'OTP_VERIFIED') });
edge({
  id: 'e.revenue-lead',
  source: 'd.revenue',
  sh: 'b',
  target: 'l.revenue',
  th: 't',
  label: 'CR below SAR 100K or above SAR 20M',
  condition: 'Registered Business outside the self-onboarding range.',
  labelAt: [H('d.revenue', 'b')[0], 1600],
  guard: ({ app }) => app.routing.journey === 'SALES_LEAD',
});
edge({
  id: 'e.revenue-s03',
  source: 'd.revenue',
  target: 's.S03',
  label: 'Self-onboarding',
  condition: 'Registered Business with SAR 100,000–20,000,000, or a Freelancer in any revenue band.',
  guard: ({ app }) => app.routing.journey === 'SELF_ONBOARDING',
});
edge({ id: 'e.s03-category', source: 's.S03', target: 'd.category', label: 'Next', condition: 'Category and subcategory selected.', guard: ({ app }) => !!app.category.decision });
edge({
  id: 'e.s03-loop',
  source: 's.S03',
  sh: 'tr',
  target: 's.S03',
  th: 'tl',
  kind: 'loop',
  label: 'Selection missing',
  condition: 'Category or subcategory not selected.',
  via: arcAbove('s.S03', 'tr', 's.S03', 'tl'),
  guard: () => false,
});
edge({
  id: 'e.category-lead',
  source: 'd.category',
  sh: 'b',
  target: 'l.category',
  th: 't',
  label: 'Restricted · pending review',
  condition: 'BLOCKED or MANUAL_REVIEW (config: stop) subcategory.',
  labelAt: [H('d.category', 'b')[0], 1600],
  guard: ({ app }) => app.category.decision === 'STOP_AS_LEAD',
});
const busX = sx(3060);
edge({
  id: 'e.category-cr',
  source: 'd.category',
  target: 'x.gov',
  label: 'Registered Business · allowed / CR-only',
  condition: 'Category decision continue, applicant is a Registered Business.',
  via: [
    [busX, H('d.category', 'r')[1]],
    [busX, H('x.gov', 'l')[1]],
  ],
  labelAt: [busX, 760],
  guard: ({ app }) => isCR(app) && app.category.decision !== 'STOP_AS_LEAD',
});
edge({
  id: 'e.category-fl',
  source: 'd.category',
  target: 'fl.S06',
  label: 'Freelancer · allowed',
  condition: 'Category decision CONTINUE for a freelancer.',
  via: [
    [busX, H('d.category', 'r')[1]],
    [busX, H('fl.S06', 'l')[1]],
  ],
  labelAt: [busX, 1700],
  guard: ({ app }) => !isCR(app) && app.category.decision === 'CONTINUE',
});
edge({
  id: 'e.category-crOnly',
  source: 'd.category',
  target: 'f.crOnly',
  label: 'Freelancer · CR-only subcategory',
  condition: 'Freelancer picked a CR-only subcategory — flagged, not rejected.',
  via: [
    [busX, H('d.category', 'r')[1]],
    [busX, H('f.crOnly', 'l')[1]],
  ],
  labelAt: [busX, 2330],
  guard: ({ app }) => !isCR(app) && app.category.decision === 'CONTINUE_FLAGGED',
});
edge({
  id: 'e.crOnly-s06',
  source: 'f.crOnly',
  target: 'fl.S06',
  th: 'b',
  label: 'Continue',
  condition: 'Flag recorded.',
  via: [[H('fl.S06', 'b')[0], H('f.crOnly', 'r')[1]]],
  guard: () => true,
});
edge({
  id: 'e.s00-start',
  source: 's.S00',
  sh: 't',
  target: 's.S01',
  th: 'b',
  kind: 'back',
  labelAt: [H('s.S00', 't')[0] + 150, 474],
  label: 'Start a new application',
  condition: 'Saved draft discarded.',
  guard: () => false,
});
edge({ id: 'e.s00-resume', source: 's.S00', target: 'c.resume', label: 'Continue application', condition: 'Saved, unsubmitted application exists.', guard: () => false });
edge({
  id: 'e.s01x-future',
  source: 's.S01X',
  target: 's.S01F',
  label: 'Freelancer · add certificate',
  condition: 'Existing freelancer wants to add another certificate (future flow).',
  guard: ({ trace }) => trace.includes('S01-F'),
});

// Path A — Registered Business
edge({ id: 'e.gov-s04', source: 'x.gov', target: 'cr.S04', label: '', condition: 'CR lookup called (auto-retries on unavailability).', guard: () => true });
edge({ id: 'e.s04-result', source: 'cr.S04', target: 'd.crResult', label: '', condition: 'Lookup completed.', guard: () => true });
edge({
  id: 'e.crResult-retry',
  source: 'd.crResult',
  sh: 't',
  target: 'cr.S04',
  th: 'tr',
  kind: 'loop',
  label: 'Unavailable / error → retry (auto ×2, manual ×3)',
  condition: 'Temporary failure; progress saved; save & exit after the retry limit.',
  via: arcAbove('d.crResult', 't', 'cr.S04', 'tr', 70),
  guard: ({ app }) => has(app, 'GOV_CR_LOOKUP', 'unavailable') || has(app, 'GOV_CR_LOOKUP', 'provider_error'),
});
edge({ id: 'e.crResult-valid', source: 'd.crResult', target: 'p.parties', label: 'Valid', condition: 'CR active.', guard: ({ app }) => app.gov.status === 'valid' });
edge({
  id: 'e.crResult-expired',
  source: 'd.crResult',
  sh: 'br',
  target: 'f.crExpired',
  th: 'l',
  via: [[H('d.crResult', 'br')[0], H('f.crExpired', 'l')[1]]],
  label: 'Expired',
  condition: 'CR expired — may proceed.',
  guard: ({ app }) => app.gov.status === 'expired',
});
edge({
  id: 'e.crResult-notfound',
  source: 'd.crResult',
  sh: 'bl',
  target: 'c.editCR',
  th: 'r',
  kind: 'back',
  label: 'Not found',
  condition: 'Invalid / non-existent CR.',
  via: [[H('d.crResult', 'bl')[0], H('c.editCR', 'r')[1]]],
  guard: ({ app }) => has(app, 'GOV_CR_LOOKUP', 'not_found'),
});
edge({ id: 'e.crExpired-parties', source: 'f.crExpired', sh: 't', target: 'p.parties', th: 'b', label: 'Continue', condition: 'Flag CR_EXPIRED recorded.', guard: () => true });
edge({ id: 'e.parties-s05', source: 'p.parties', target: 'cr.S05', label: '', condition: 'Related parties loaded.', guard: () => true });
edge({
  id: 'e.s05-loop',
  source: 'cr.S05',
  sh: 'tr',
  target: 'cr.S05',
  th: 'tl',
  kind: 'loop',
  label: 'Data unavailable → try again',
  condition: 'Related-party data unavailable; never fabricated.',
  via: arcAbove('cr.S05', 'tr', 'cr.S05', 'tl'),
  guard: ({ app }) => has(app, 'GOV_RELATED_PARTIES', 'unavailable'),
});
edge({ id: 'e.s05-individuals', source: 'cr.S05', target: 'd.individuals', label: 'Continue', condition: 'Selection submitted.', guard: () => true });
edge({
  id: 'e.individuals-yes',
  source: 'd.individuals',
  target: 'cr.S06',
  label: 'One selected',
  condition: 'Exactly one individual selected.',
  guard: ({ app }) => has(app, 'AUTHORISED_PERSON_CONFIRMED'),
});
edge({
  id: 'e.individuals-none',
  source: 'd.individuals',
  sh: 'b',
  target: 'm.noIndividual',
  th: 't',
  label: 'None on CR',
  condition: 'CR lists only companies / entities.',
  guard: (c) => flag(c, 'NO_ELIGIBLE_AUTHORISED_PERSON'),
});
edge({
  id: 'e.noIndividual-manual',
  source: 'm.noIndividual',
  target: 'm.nafathCR',
  th: 'b',
  label: 'Manual identity verification',
  condition: 'Nafath not possible.',
  via: [
    [H('m.noIndividual', 'r')[0] + 40, H('m.noIndividual', 'r')[1]],
    [H('m.noIndividual', 'r')[0] + 40, rowB('cr') + 300],
    [H('m.nafathCR', 'b')[0], rowB('cr') + 300],
  ],
  guard: () => true,
});
edge({
  id: 'e.s06-nafath',
  source: 'cr.S06',
  target: 'x.nafathCR',
  label: 'Send request',
  condition: 'Attempts remain.',
  guard: ({ app }) => app.nafath.attempts.length > 0 || app.nafath.technicalFailures > 0,
});
edge({
  id: 'e.nafathCR-tech',
  source: 'x.nafathCR',
  sh: 't',
  target: 'cr.S06',
  th: 'tr',
  kind: 'loop',
  label: 'Technical failure → retry (no attempt used)',
  condition: 'Request could not be created (provisional D-11).',
  via: arcAbove('x.nafathCR', 't', 'cr.S06', 'tr', 70),
  guard: ({ app }) => app.nafath.technicalFailures > 0,
});
edge({
  id: 'e.nafathCR-result',
  source: 'x.nafathCR',
  target: 'd.nafathCR',
  label: 'Approve in Nafath',
  condition: 'Request created; user acts in the Nafath app.',
  guard: ({ app }) => app.nafath.attempts.length > 0,
});
edge({ id: 'e.nafathCR-verified', source: 'd.nafathCR', target: 'cr.S08', label: 'Verified', condition: 'Nafath verified.', guard: ({ app }) => app.nafath.result === 'verified' });
edge({
  id: 'e.nafathCR-failed',
  source: 'd.nafathCR',
  sh: 'b',
  target: 'd.attemptsCR',
  th: 't',
  label: 'Rejected / timed out',
  condition: 'Unsuccessful attempt.',
  guard: ({ app }) => failedAttempts(app) > 0,
});
edge({
  id: 'e.attemptsCR-retry',
  source: 'd.attemptsCR',
  sh: 'l',
  target: 'cr.S06',
  th: 'br',
  kind: 'loop',
  label: '1 of 2 used · retry same person',
  condition: 'One attempt left.',
  via: [[H('cr.S06', 'br')[0], H('d.attemptsCR', 'l')[1]]],
  guard: ({ app }) => app.nafath.attempts.length >= 2 && !has(app, 'CHANGE_AUTHORISED_PERSON'),
});
edge({
  id: 'e.attemptsCR-change',
  source: 'd.attemptsCR',
  sh: 'b',
  target: 'cr.S05',
  th: 'b',
  kind: 'back',
  label: '1 of 2 used · choose another person (counter kept)',
  condition: 'One attempt left; the shared counter is not reset.',
  via: [
    [H('d.attemptsCR', 'b')[0], rowB('cr') + 260],
    [H('cr.S05', 'b')[0], rowB('cr') + 260],
  ],
  guard: ({ app }) => has(app, 'CHANGE_AUTHORISED_PERSON'),
});
edge({
  id: 'e.attemptsCR-manual',
  source: 'd.attemptsCR',
  target: 'm.nafathCR',
  label: '2 of 2 used',
  condition: 'Attempts exhausted.',
  guard: ({ app }) => app.nafath.result === 'unverified' && app.nafath.attempts.length > 0,
});
edge({
  id: 'e.nafathCR-manual-s08',
  source: 'm.nafathCR',
  sh: 't',
  target: 'cr.S08',
  th: 'b',
  label: 'Continue (no contract)',
  condition: 'Applicant continues collecting business information.',
  guard: () => true,
});
edge({
  id: 'e.s08cr-iban',
  source: 'cr.S08',
  target: 'd.ibanEligCR',
  label: 'Next · fields valid',
  condition: 'Business details valid.',
  guard: ({ app }) => has(app, 'BUSINESS_DETAILS_SAVED') || app.iban.calls > 0,
});
edge({ id: 'e.ibanEligCR-yes', source: 'd.ibanEligCR', target: 'x.ibanCR', label: 'Yes', condition: 'Nafath verified.', guard: ({ app }) => app.iban.calls > 0 });
edge({
  id: 'e.ibanEligCR-no',
  source: 'd.ibanEligCR',
  sh: 'b',
  target: 'm.ibanCR',
  th: 'l',
  label: 'No · collect only',
  condition: 'Nafath unverified: IBAN collected, API not called.',
  via: [[H('d.ibanEligCR', 'b')[0], H('m.ibanCR', 'l')[1]]],
  guard: ({ app }) => app.iban.status === 'not_checked',
});
edge({ id: 'e.ibanCR-check', source: 'x.ibanCR', target: 'd.ibanCR', label: '', condition: 'Ownership API called.', guard: () => true });
edge({
  id: 'e.ibanCR-retry',
  source: 'd.ibanCR',
  sh: 't',
  target: 'cr.S08',
  th: 'tr',
  kind: 'loop',
  label: '1st failure / error → correct or retry',
  condition: 'Not verified once, or technical error (< 3).',
  via: arcAbove('d.ibanCR', 't', 'cr.S08', 'tr', 70),
  guard: ({ app }) => app.iban.failedAttempts > 0 || app.iban.technicalErrors > 0,
});
edge({
  id: 'e.ibanCR-verified',
  source: 'd.ibanCR',
  target: 'd.contractCR',
  label: 'Verified',
  condition: 'Ownership confirmed.',
  guard: ({ app }) => app.iban.status === 'verified',
});
edge({
  id: 'e.ibanCR-flag',
  source: 'd.ibanCR',
  sh: 'b',
  target: 'm.ibanCR',
  th: 't',
  label: 'Failed ×2 · outage ×3',
  condition: 'Continue with manual financial verification / pending.',
  guard: ({ app }) => app.iban.status === 'failed_max' || app.iban.status === 'pending_provider',
});
edge({
  id: 'e.ibanFlagCR-contract',
  source: 'm.ibanCR',
  target: 'd.contractCR',
  th: 'b',
  label: 'Continue',
  condition: 'Flag recorded.',
  via: [[H('d.contractCR', 'b')[0], H('m.ibanCR', 'r')[1]]],
  guard: () => true,
});
edge({
  id: 'e.contractCR-yes',
  source: 'd.contractCR',
  target: 'cr.S09',
  label: 'Eligible',
  condition: 'Nafath verified and no blocking flag.',
  guard: ({ app }) => app.contract.status !== 'not_available',
});
edge({
  id: 'e.contractCR-no',
  source: 'd.contractCR',
  sh: 't',
  target: 'm.manualCR',
  th: 't',
  label: 'Not eligible → submit for manual review',
  condition: 'Nafath unverified or blocking review flag.',
  via: [
    [H('d.contractCR', 't')[0], laneY('cr') + 34],
    [H('m.manualCR', 't')[0], laneY('cr') + 34],
  ],
  labelAt: [sx(8900), laneY('cr') + 34],
  guard: ({ app }) => app.submission.outcome === 'B_RECEIVED',
});
edge({
  id: 'e.s09cr-accept',
  source: 'cr.S09',
  target: 'd.acceptCR',
  label: '',
  condition: 'Agreement reviewed.',
  guard: ({ app }) => app.contract.status === 'accepted' || app.contract.status === 'declined' || has(app, 'CONTRACT_ACCEPTED'),
});
edge({
  id: 'e.acceptCR-yes',
  source: 'd.acceptCR',
  target: 'p.acceptCR',
  label: 'Accept',
  condition: 'Confirmation ticked.',
  guard: ({ app }) => app.contract.status === 'accepted',
});
edge({
  id: 'e.acceptCR-no',
  source: 'd.acceptCR',
  sh: 'b',
  target: 'cr.S09D',
  th: 't',
  label: 'Decline → confirm',
  condition: 'Applicant confirmed decline.',
  guard: (c) => flag(c, 'CONTRACT_DECLINED'),
});
edge({
  id: 'e.s09dcr-review',
  source: 'cr.S09D',
  target: 'cr.S09',
  sh: 'l',
  th: 'b',
  kind: 'back',
  label: 'Review agreement',
  condition: 'Applicant returns to the agreement.',
  via: [[H('cr.S09', 'b')[0], H('cr.S09D', 'l')[1]]],
  guard: ({ trace }) => trace.join(',').includes('S09-D,S09'),
});
edge({
  id: 'e.acceptCR-OA',
  source: 'p.acceptCR',
  target: 'o.OA.cr',
  th: 't',
  label: 'Submitted',
  condition: 'Simulated acceptance recorded.',
  via: [[H('o.OA.cr', 't')[0], H('p.acceptCR', 'r')[1]]],
  guard: ({ app }) => app.submission.outcome === 'A_SUBMITTED',
});

// Path B — Freelancer
edge({
  id: 'e.s06fl-nafath',
  source: 'fl.S06',
  target: 'x.nafathFL',
  label: 'Send request',
  condition: 'Attempts remain.',
  guard: ({ app }) => app.nafath.attempts.length > 0 || app.nafath.technicalFailures > 0,
});
edge({
  id: 'e.nafathFL-tech',
  source: 'x.nafathFL',
  sh: 't',
  target: 'fl.S06',
  th: 'tr',
  kind: 'loop',
  label: 'Technical failure → retry (no attempt used)',
  condition: 'Request could not be created.',
  via: arcAbove('x.nafathFL', 't', 'fl.S06', 'tr', 70),
  guard: ({ app }) => app.nafath.technicalFailures > 0,
});
edge({
  id: 'e.nafathFL-result',
  source: 'x.nafathFL',
  target: 'd.nafathFL',
  label: 'Approve in Nafath',
  condition: 'Request created.',
  guard: ({ app }) => app.nafath.attempts.length > 0,
});
edge({
  id: 'e.nafathFL-verified',
  source: 'd.nafathFL',
  target: 'x.certs',
  label: 'Verified',
  condition: 'Nafath verified.',
  guard: ({ app }) => app.nafath.result === 'verified',
});
edge({
  id: 'e.nafathFL-failed',
  source: 'd.nafathFL',
  sh: 'b',
  target: 'd.attemptsFL',
  th: 't',
  label: 'Rejected / timed out',
  condition: 'Unsuccessful attempt.',
  guard: ({ app }) => failedAttempts(app) > 0,
});
edge({
  id: 'e.attemptsFL-retry',
  source: 'd.attemptsFL',
  sh: 'l',
  target: 'fl.S06',
  th: 'br',
  kind: 'loop',
  label: '1 of 2 used · retry',
  condition: 'One attempt left.',
  via: [[H('fl.S06', 'br')[0], H('d.attemptsFL', 'l')[1]]],
  guard: ({ app }) => app.nafath.attempts.length >= 2,
});
edge({
  id: 'e.attemptsFL-manual',
  source: 'd.attemptsFL',
  target: 'fl.S07M',
  label: '2 of 2 used',
  condition: 'Attempts exhausted → manual certificate path.',
  via: [
    [H('d.attemptsFL', 'r')[0] + 35, H('d.attemptsFL', 'r')[1]],
    [H('d.attemptsFL', 'r')[0] + 35, H('fl.S07M', 'l')[1]],
  ],
  guard: ({ app }) => app.nafath.result === 'unverified',
});
edge({ id: 'e.certs-s07', source: 'x.certs', target: 'fl.S07', label: '', condition: 'Lookup by verified National ID.', guard: () => true });
edge({
  id: 'e.s07-loop',
  source: 'fl.S07',
  sh: 'tr',
  target: 'fl.S07',
  th: 'tl',
  kind: 'loop',
  label: 'Service unavailable → try again',
  condition: 'Certificate service unavailable.',
  via: arcAbove('fl.S07', 'tr', 'fl.S07', 'tl'),
  guard: ({ app }) => has(app, 'CERTIFICATE_LOOKUP', 'unavailable'),
});
edge({ id: 'e.s07-certs', source: 'fl.S07', target: 'd.certs', label: 'Continue', condition: 'Selection or manual-entry choice.', guard: () => true });
edge({
  id: 'e.certs-none',
  source: 'd.certs',
  sh: 'b',
  target: 'fl.S07M',
  th: 't',
  label: 'None found / all attached',
  condition: 'No selectable certificate → manual entry (manual review).',
  via: [
    [H('d.certs', 'b')[0], rowB('fl') - 30],
    [H('fl.S07M', 't')[0], rowB('fl') - 30],
  ],
  guard: ({ app }) => app.certificates.source === 'MANUAL_ENTRY' && app.nafath.result === 'verified',
});
edge({
  id: 'e.certs-selected',
  source: 'd.certs',
  target: 'p.recon',
  label: 'One selected',
  condition: 'Exactly one certificate selected.',
  guard: ({ app }) => app.certificates.source === 'GOVERNMENT',
});
edge({
  id: 'e.s07m-loop',
  source: 'fl.S07M',
  sh: 'bl',
  target: 'fl.S07M',
  th: 'br',
  kind: 'loop',
  label: 'Invalid / already linked',
  condition: 'Format error or certificate attached to an existing account.',
  via: arcBelow('fl.S07M', 'bl', 'fl.S07M', 'br'),
  guard: ({ app }) => has(app, 'CERTIFICATE_DUPLICATE'),
});
edge({
  id: 'e.s07m-manual',
  source: 'fl.S07M',
  target: 'm.manualCert',
  label: 'Continue',
  condition: 'Certificate number accepted.',
  guard: ({ app }) => app.certificates.source === 'MANUAL_ENTRY',
});
edge({
  id: 'e.manualCert-s08',
  source: 'm.manualCert',
  target: 'fl.S08',
  th: 'b',
  label: 'Continue (no contract)',
  condition: 'Certificate review required; contract disabled.',
  via: [
    [H('m.manualCert', 'r')[0] + 30, H('m.manualCert', 'r')[1]],
    [H('m.manualCert', 'r')[0] + 30, rowB('fl') + 300],
    [H('fl.S08', 'b')[0], rowB('fl') + 300],
  ],
  guard: () => true,
});
edge({ id: 'e.recon-check', source: 'p.recon', target: 'd.recon', label: '', condition: 'Mapping applied.', guard: () => true });
edge({
  id: 'e.recon-match',
  source: 'd.recon',
  target: 'fl.S08',
  label: 'Match',
  condition: 'Certificate maps to the selected Madfu subcategory.',
  guard: (c) => c.app.certificates.reconciliation?.matchesSelection === true && !flag(c, 'CERT_EXPIRED', 'CERT_INCONSISTENT'),
});
edge({
  id: 'e.recon-flag',
  source: 'd.recon',
  sh: 'b',
  target: 'f.certFlag',
  th: 't',
  label: 'Mismatch / expired / inconsistent',
  condition: 'Flagged for review; preliminary category preserved.',
  guard: (c) => flag(c, 'CATEGORY_MISMATCH', 'CERT_EXPIRED', 'CERT_INCONSISTENT'),
});
edge({
  id: 'e.recon-restricted',
  source: 'd.recon',
  sh: 'bl',
  target: 'l.cert',
  th: 'tl',
  label: 'Restricted mapping',
  condition: 'Certificate activity maps to a restricted category (post-Nafath).',
  via: [
    [H('d.recon', 'bl')[0], rowB('fl') - 22],
    [H('d.recon', 'l')[0] - 50, rowB('fl') - 22],
    [H('d.recon', 'l')[0] - 50, H('l.cert', 'tl')[1] - 40],
    [H('l.cert', 'tl')[0], H('l.cert', 'tl')[1] - 40],
  ],
  labelAt: [H('d.recon', 'l')[0] - 50, 2800],
  guard: (c) => flag(c, 'CATEGORY_RESTRICTED_POST_NAFATH'),
});
edge({
  id: 'e.certFlag-s08',
  source: 'f.certFlag',
  target: 'fl.S08',
  th: 'bl',
  label: 'Continue',
  condition: 'Flag recorded.',
  via: [[H('fl.S08', 'bl')[0], H('f.certFlag', 'r')[1]]],
  guard: () => true,
});
edge({
  id: 'e.s08fl-iban',
  source: 'fl.S08',
  target: 'd.ibanEligFL',
  label: 'Next · fields valid',
  condition: 'Business details valid.',
  guard: ({ app }) => has(app, 'BUSINESS_DETAILS_SAVED') || app.iban.calls > 0,
});
edge({ id: 'e.ibanEligFL-yes', source: 'd.ibanEligFL', target: 'x.ibanFL', label: 'Yes', condition: 'Nafath verified.', guard: ({ app }) => app.iban.calls > 0 });
edge({
  id: 'e.ibanEligFL-no',
  source: 'd.ibanEligFL',
  sh: 'b',
  target: 'm.ibanFL',
  th: 'l',
  label: 'No · collect without API',
  condition: 'Freelancer without Nafath: IBAN collected only.',
  via: [[H('d.ibanEligFL', 'b')[0], H('m.ibanFL', 'l')[1]]],
  guard: ({ app }) => app.iban.status === 'not_checked',
});
edge({ id: 'e.ibanFL-check', source: 'x.ibanFL', target: 'd.ibanFL', label: '', condition: 'Ownership API called.', guard: () => true });
edge({
  id: 'e.ibanFL-retry',
  source: 'd.ibanFL',
  sh: 't',
  target: 'fl.S08',
  th: 'tr',
  kind: 'loop',
  label: '1st failure / error → correct or retry',
  condition: 'Not verified once, or technical error (< 3).',
  via: arcAbove('d.ibanFL', 't', 'fl.S08', 'tr', 70),
  guard: ({ app }) => app.iban.failedAttempts > 0 || app.iban.technicalErrors > 0,
});
edge({
  id: 'e.ibanFL-verified',
  source: 'd.ibanFL',
  target: 'd.contractFL',
  label: 'Verified',
  condition: 'Ownership confirmed.',
  guard: ({ app }) => app.iban.status === 'verified',
});
edge({
  id: 'e.ibanFL-flag',
  source: 'd.ibanFL',
  sh: 'b',
  target: 'm.ibanFL',
  th: 't',
  label: 'Failed ×2 · outage ×3',
  condition: 'Continue flagged.',
  guard: ({ app }) => app.iban.status === 'failed_max' || app.iban.status === 'pending_provider',
});
edge({
  id: 'e.ibanFlagFL-contract',
  source: 'm.ibanFL',
  target: 'd.contractFL',
  th: 'b',
  label: 'Continue',
  condition: 'Flag recorded.',
  via: [[H('d.contractFL', 'b')[0], H('m.ibanFL', 'r')[1]]],
  guard: () => true,
});
edge({
  id: 'e.contractFL-yes',
  source: 'd.contractFL',
  target: 'fl.S09',
  label: 'Eligible',
  condition: 'Nafath verified and no blocking flag.',
  guard: ({ app }) => app.contract.status !== 'not_available',
});
edge({
  id: 'e.contractFL-no',
  source: 'd.contractFL',
  sh: 't',
  target: 'm.manualFL',
  th: 't',
  label: 'Not eligible → submit for manual review',
  condition: 'Nafath unverified or unresolved certificate review.',
  via: [
    [H('d.contractFL', 't')[0], laneY('fl') + 34],
    [H('m.manualFL', 't')[0], laneY('fl') + 34],
  ],
  labelAt: [sx(8900), laneY('fl') + 34],
  guard: ({ app }) => app.submission.outcome === 'B_RECEIVED',
});
edge({
  id: 'e.s09fl-accept',
  source: 'fl.S09',
  target: 'd.acceptFL',
  label: '',
  condition: 'Agreement reviewed.',
  guard: ({ app }) => app.contract.status === 'accepted' || app.contract.status === 'declined',
});
edge({
  id: 'e.acceptFL-yes',
  source: 'd.acceptFL',
  target: 'p.acceptFL',
  label: 'Accept',
  condition: 'Confirmation ticked.',
  guard: ({ app }) => app.contract.status === 'accepted',
});
edge({
  id: 'e.acceptFL-no',
  source: 'd.acceptFL',
  sh: 'b',
  target: 'fl.S09D',
  th: 't',
  label: 'Decline → confirm',
  condition: 'Applicant confirmed decline.',
  guard: (c) => flag(c, 'CONTRACT_DECLINED'),
});
edge({
  id: 'e.s09dfl-review',
  source: 'fl.S09D',
  target: 'fl.S09',
  sh: 'l',
  th: 'b',
  kind: 'back',
  label: 'Review agreement',
  condition: 'Applicant returns to the agreement.',
  via: [[H('fl.S09', 'b')[0], H('fl.S09D', 'l')[1]]],
  guard: ({ trace }) => trace.join(',').includes('S09-D,S09'),
});
edge({
  id: 'e.acceptFL-OA',
  source: 'p.acceptFL',
  target: 'o.OA.fl',
  th: 't',
  label: 'Submitted',
  condition: 'Simulated acceptance recorded.',
  via: [[H('o.OA.fl', 't')[0], H('p.acceptFL', 'r')[1]]],
  guard: ({ app }) => app.submission.outcome === 'A_SUBMITTED',
});

// Manual review & leads → outcomes
const leadBusY = laneY('manual') + 270;
for (const id of ['l.revenue', 'l.category', 'l.cert'] as const) {
  edge({
    id: `e.${id}-save`,
    source: id,
    sh: 'b',
    target: 'm.saveLead',
    th: 'l',
    label: id === 'l.cert' ? 'Save lead' : '',
    condition: 'Lead saved with its internal reason.',
    via: [
      [H(id, 'b')[0], leadBusY],
      [H('m.saveLead', 'l')[0] - 40, leadBusY],
      [H('m.saveLead', 'l')[0] - 40, H('m.saveLead', 'l')[1]],
    ],
    guard:
      id === 'l.revenue'
        ? (c) => flag(c, 'SALES_LEAD_REVENUE')
        : id === 'l.category'
          ? ({ app }) => app.category.decision === 'STOP_AS_LEAD'
          : (c) => flag(c, 'CATEGORY_RESTRICTED_POST_NAFATH'),
  });
}
edge({
  id: 'e.saveLead-OC',
  source: 'm.saveLead',
  sh: 'b',
  target: 'o.OC',
  th: 't',
  label: 'Lead confirmation',
  condition: 'Outcome C.',
  guard: ({ app }) => app.submission.outcome === 'C_SALES_LEAD',
});
edge({
  id: 'e.manualFL-OB',
  source: 'm.manualFL',
  sh: 'b',
  target: 'o.OB.fl',
  th: 't',
  label: 'Received',
  condition: 'Outcome B.',
  guard: ({ app }) => app.submission.outcome === 'B_RECEIVED',
});
edge({
  id: 'e.manualCR-OB',
  source: 'm.manualCR',
  sh: 'b',
  target: 'o.OB.cr',
  th: 't',
  label: 'Received',
  condition: 'Outcome B.',
  guard: ({ app }) => app.submission.outcome === 'B_RECEIVED',
});

export const BOARD_EDGES = E;
