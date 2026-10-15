/**
 * SCREEN STATES for the gallery and the PDF.
 * Each state is produced by driving the real engine (sandboxed, zero latency)
 * and, only for transient loading states, a minimal patch. This keeps the
 * PDF faithful to the implemented prototype.
 */
import { JourneyEngine } from './engine';
import { driveTo } from './drive';
import { createMockServices } from '../mocks/services';
import { DEFAULT_SIM, SYNTHETIC, SYNTHETIC_IBANS } from '../mocks/fixtures';
import { Store, createApplication } from '../state/store';
import type { Application, ScreenId, SimSettings } from '../state/types';

export interface BuiltState {
  app: Application;
  sim: SimSettings;
}

export interface GalleryState {
  id: string;
  screen: ScreenId;
  title: string;
  /** One primary state per screen is used on the main screen page of the PDF. */
  primary?: boolean;
  build: () => Promise<BuiltState>;
}

interface BuildOpts {
  type?: 'CR' | 'FREELANCER';
  entry?: Partial<Application['entry']>;
  empty?: boolean;
  category?: { categoryId: string; subcategoryId: string } | null;
  business?: Partial<Application['business']>;
  sim?: Partial<SimSettings>;
  to?: ScreenId;
  then?: (e: JourneyEngine) => Promise<unknown> | unknown;
  patch?: (a: Application) => void;
}

const FIXED_ID = 'APP-DEMO-0A1B2C';

async function build(o: BuildOpts): Promise<BuiltState> {
  const sim: SimSettings = { ...DEFAULT_SIM, latencyMs: 0, nafathAutoResolveMs: 0, identityExists: 'force_new', ...o.sim };
  const app = createApplication(FIXED_ID);
  if (!o.empty) {
    const type = o.type ?? 'CR';
    app.entry = {
      ...app.entry,
      applicantType: type,
      identification: type === 'CR' ? SYNTHETIC.crNew : SYNTHETIC.nidNew,
      revenueBand: 'R_100K_20M',
      mobile: SYNTHETIC.mobile,
      ...o.entry,
    };
  }
  if (o.category !== null)
    app.category = { ...(o.category ?? (o.type === 'FREELANCER' ? { categoryId: 'C40', subcategoryId: 'C40-01' } : { categoryId: 'C10', subcategoryId: 'C10-01' })) };
  if (o.business) app.business = { ...app.business, ...o.business };
  const appStore = new Store(app);
  const simStore = new Store(sim);
  const engine = new JourneyEngine(appStore, createMockServices(simStore.get), { sandbox: true });
  if (o.to) await driveTo(engine, o.to);
  if (o.then) await o.then(engine);
  const out = structuredClone(appStore.get());
  o.patch?.(out);
  return { app: out, sim: { ...sim, latencyMs: 600, nafathAutoResolveMs: 0 } };
}

const bizFilled: Partial<Application['business']> = {
  iban: SYNTHETIC_IBANS.primary,
  vatRegistered: 'yes',
  vatNumber: '300000000000003',
  channel: 'both',
  websiteUrl: 'https://sample-store.example',
  mapsUrl: 'https://maps.app.goo.gl/demo-branch',
  branches: '2-3',
};
const bizMin: Partial<Application['business']> = { iban: SYNTHETIC_IBANS.primary, vatRegistered: 'no', channel: 'online', websiteUrl: 'https://sample-store.example' };
const fl = { type: 'FREELANCER' as const };

export const GALLERY_STATES: GalleryState[] = [
  // S00
  { id: 'S00--resume', screen: 'S00', title: 'Saved application found', primary: true, build: () => build({ to: 'S08', business: { iban: SYNTHETIC_IBANS.primary } }) },
  // S01
  { id: 'S01--empty', screen: 'S01', title: 'Empty form', build: () => build({ empty: true }) },
  { id: 'S01--filled-cr', screen: 'S01', title: 'Registered Business — completed', primary: true, build: () => build({}) },
  { id: 'S01--filled-freelancer', screen: 'S01', title: 'Freelancer — National ID field', build: () => build(fl) },
  { id: 'S01--errors-empty', screen: 'S01', title: 'Validation — required fields missing', build: () => build({ empty: true, then: (e) => e.submitEntry() }) },
  {
    id: 'S01--errors-format',
    screen: 'S01',
    title: 'Validation — invalid identification and mobile format',
    build: () => build({ entry: { identification: '10100', mobile: '4000' }, then: (e) => e.submitEntry() }),
  },
  { id: 'S01--checking', screen: 'S01', title: 'Loading — backend duplicate checks', build: () => build({ patch: (a) => (a.ui.busy = 'Checking your details…') }) },
  // S01-X / S01-F
  { id: 'S01-X--cr', screen: 'S01-X', title: 'Existing CR', primary: true, build: () => build({ sim: { identityExists: 'force_existing' }, to: 'S01-X' }) },
  {
    id: 'S01-X--freelancer',
    screen: 'S01-X',
    title: 'Existing National ID (with future add-certificate branch)',
    build: () => build({ ...fl, sim: { identityExists: 'force_existing' }, to: 'S01-X' }),
  },
  {
    id: 'S01-F--future',
    screen: 'S01-F',
    title: 'Future flow placeholder',
    primary: true,
    build: () => build({ ...fl, sim: { identityExists: 'force_existing' }, to: 'S01-X', then: (e) => e.openAddCertificateFlow() }),
  },
  // S02
  { id: 'S02--default', screen: 'S02', title: 'Code sent', primary: true, build: () => build({ to: 'S02' }) },
  { id: 'S02--incorrect', screen: 'S02', title: 'Incorrect code (2 attempts remaining)', build: () => build({ to: 'S02', then: (e) => e.verifyOtp('000000') }) },
  {
    id: 'S02--expired',
    screen: 'S02',
    title: 'Expired code (no attempt consumed)',
    build: () =>
      build({
        to: 'S02',
        then: async (e) => {
          e.simulateOtpExpiry();
          await e.verifyOtp('000000');
        },
      }),
  },
  { id: 'S02--resent', screen: 'S02', title: 'New code sent', build: () => build({ to: 'S02', then: (e) => e.resendOtp(true) }) },
  {
    id: 'S02-L--locked',
    screen: 'S02-L',
    title: 'Locked after 3 incorrect codes',
    primary: true,
    build: () =>
      build({
        to: 'S02',
        then: async (e) => {
          for (let i = 0; i < 3; i++) await e.verifyOtp('000000');
        },
      }),
  },
  // S03
  { id: 'S03--empty', screen: 'S03', title: 'No selection', build: () => build({ category: null, to: 'S03' }) },
  { id: 'S03--selected', screen: 'S03', title: 'Category and subcategory selected', primary: true, build: () => build({ to: 'S03' }) },
  { id: 'S03--errors', screen: 'S03', title: 'Validation — nothing selected', build: () => build({ category: null, to: 'S03', then: (e) => e.submitCategory() }) },
  // S04
  {
    id: 'S04--loading',
    screen: 'S04',
    title: 'Loading — retrieving CR',
    build: () => build({ to: 'S04', patch: (a) => ((a.gov.status = 'loading'), (a.gov.record = undefined)) }),
  },
  { id: 'S04--valid', screen: 'S04', title: 'Valid CR', primary: true, build: () => build({ to: 'S04' }) },
  { id: 'S04--expired', screen: 'S04', title: 'Expired CR (may continue, flagged)', build: () => build({ sim: { govOutcomes: ['expired'] }, to: 'S04' }) },
  { id: 'S04--not-found', screen: 'S04', title: 'CR not found', build: () => build({ sim: { govOutcomes: ['not_found'] }, to: 'S04' }) },
  { id: 'S04--unavailable', screen: 'S04', title: 'Service unavailable after automatic retries', build: () => build({ sim: { govOutcomes: ['unavailable'] }, to: 'S04' }) },
  { id: 'S04--provider-error', screen: 'S04', title: 'Unexpected provider error', build: () => build({ sim: { govOutcomes: ['provider_error'] }, to: 'S04' }) },
  {
    id: 'S04--gave-up',
    screen: 'S04',
    title: 'Retry limit reached — progress saved',
    build: () =>
      build({
        sim: { govOutcomes: ['unavailable'] },
        to: 'S04',
        then: async (e) => {
          for (let i = 0; i < 3; i++) await e.lookupCr(true);
        },
      }),
  },
  // S05
  { id: 'S05--multiple', screen: 'S05', title: 'Multiple individuals — none selected', primary: true, build: () => build({ to: 'S05' }) },
  { id: 'S05--selected', screen: 'S05', title: 'One individual selected', build: () => build({ to: 'S05', then: (e) => e.selectPerson('P-02') }) },
  { id: 'S05--one', screen: 'S05', title: 'Single individual (pre-selected)', build: () => build({ sim: { personsFixture: 'one' }, to: 'S05' }) },
  { id: 'S05--none', screen: 'S05', title: 'No eligible individual (entities only)', build: () => build({ sim: { personsFixture: 'none' }, to: 'S05' }) },
  { id: 'S05--unavailable', screen: 'S05', title: 'Related-party data unavailable', build: () => build({ sim: { personsAvailability: 'unavailable' }, to: 'S05' }) },
  {
    id: 'S05--after-failure',
    screen: 'S05',
    title: 'Changing person after a failed attempt (counter preserved)',
    build: () =>
      build({
        sim: { nafathOutcomes: ['rejected'] },
        to: 'S05',
        then: async (e) => {
          e.selectPerson('P-01');
          e.submitPerson();
          await e.startNafath();
          e.resolveNafath();
          e.changeAuthorisedPerson();
          e.selectPerson('P-02');
        },
      }),
  },
  // S06
  { id: 'S06--cr-ready', screen: 'S06', title: 'Ready to send (CR, selected person)', build: () => build({ to: 'S06' }) },
  { id: 'S06--waiting', screen: 'S06', title: 'Waiting — large matching number', primary: true, build: () => build({ to: 'S06', then: (e) => e.startNafath() }) },
  {
    id: 'S06--rejected',
    screen: 'S06',
    title: 'Rejected — 1 attempt remaining (CR)',
    build: () =>
      build({
        to: 'S06',
        then: async (e) => {
          await e.startNafath();
          e.resolveNafath('rejected');
        },
      }),
  },
  {
    id: 'S06--timeout',
    screen: 'S06',
    title: 'Timed out — 1 attempt remaining (Freelancer)',
    build: () =>
      build({
        ...fl,
        to: 'S06',
        then: async (e) => {
          await e.startNafath();
          e.resolveNafath('timeout');
        },
      }),
  },
  {
    id: 'S06--technical',
    screen: 'S06',
    title: 'Technical failure — no attempt consumed',
    build: () => build({ sim: { nafathOutcomes: ['technical_failure'] }, to: 'S06', then: (e) => e.startNafath() }),
  },
  {
    id: 'S06--verified',
    screen: 'S06',
    title: 'Verified',
    build: () =>
      build({
        to: 'S06',
        then: async (e) => {
          await e.startNafath();
          e.resolveNafath('verified');
        },
      }),
  },
  {
    id: 'S06--exhausted',
    screen: 'S06',
    title: 'Two unsuccessful attempts — manual path',
    build: () =>
      build({
        sim: { nafathOutcomes: ['rejected', 'timeout'] },
        to: 'S06',
        then: async (e) => {
          await e.startNafath();
          e.resolveNafath();
          await e.retryNafath();
          e.resolveNafath();
        },
      }),
  },
  { id: 'S06--fl-ready', screen: 'S06', title: 'Ready to send (Freelancer, National ID from entry)', build: () => build({ ...fl, to: 'S06' }) },
  // S07
  { id: 'S07--multiple', screen: 'S07', title: 'Multiple certificates', primary: true, build: () => build({ ...fl, sim: { certificatesFixture: 'multiple' }, to: 'S07' }) },
  { id: 'S07--one', screen: 'S07', title: 'One certificate (pre-selected)', build: () => build({ ...fl, sim: { certificatesFixture: 'one' }, to: 'S07' }) },
  { id: 'S07--none', screen: 'S07', title: 'No certificates found', build: () => build({ ...fl, sim: { certificatesFixture: 'none' }, to: 'S07' }) },
  { id: 'S07--unavailable', screen: 'S07', title: 'Certificate service unavailable', build: () => build({ ...fl, sim: { certificatesAvailability: 'unavailable' }, to: 'S07' }) },
  { id: 'S07--attached', screen: 'S07', title: 'Certificate already attached to an account', build: () => build({ ...fl, sim: { certificatesFixture: 'attached' }, to: 'S07' }) },
  { id: 'S07--expired', screen: 'S07', title: 'Expired certificate', build: () => build({ ...fl, sim: { certificatesFixture: 'expired' }, to: 'S07' }) },
  // S07-M
  {
    id: 'S07-M--manual',
    screen: 'S07-M',
    title: 'After two unsuccessful Nafath attempts',
    primary: true,
    build: () => build({ ...fl, sim: { nafathOutcomes: ['rejected'] }, to: 'S07-M' }),
  },
  {
    id: 'S07-M--duplicate',
    screen: 'S07-M',
    title: 'Certificate already linked to an account',
    build: () =>
      build({
        ...fl,
        sim: { nafathOutcomes: ['rejected'] },
        to: 'S07-M',
        then: async (e) => {
          e.updateManualCertificate('FL-000000106');
          await e.submitManualCertificate();
        },
      }),
  },
  // S08
  { id: 'S08--empty', screen: 'S08', title: 'Empty form', build: () => build({ to: 'S08' }) },
  {
    id: 'S08--verified',
    screen: 'S08',
    title: 'IBAN verified, VAT yes, both channels',
    primary: true,
    build: () => build({ business: bizFilled, to: 'S08', then: (e) => e.verifyIban() }),
  },
  { id: 'S08--verifying', screen: 'S08', title: 'IBAN verifying', build: () => build({ business: bizMin, to: 'S08', patch: (a) => (a.iban.status = 'verifying') }) },
  {
    id: 'S08--not-verified',
    screen: 'S08',
    title: 'IBAN not verified (1 of 2)',
    build: () => build({ business: bizMin, sim: { ibanOutcomes: ['not_verified'] }, to: 'S08', then: (e) => e.verifyIban() }),
  },
  {
    id: 'S08--failed-max',
    screen: 'S08',
    title: 'IBAN not verified twice — may continue',
    build: () =>
      build({
        business: bizMin,
        sim: { ibanOutcomes: ['not_verified'] },
        to: 'S08',
        then: async (e) => {
          await e.verifyIban();
          await e.verifyIban(true);
        },
      }),
  },
  {
    id: 'S08--technical',
    screen: 'S08',
    title: 'IBAN technical error',
    build: () => build({ business: bizMin, sim: { ibanOutcomes: ['technical_error'] }, to: 'S08', then: (e) => e.verifyIban() }),
  },
  {
    id: 'S08--pending',
    screen: 'S08',
    title: 'IBAN provider outage — pending (not a failure)',
    build: () =>
      build({
        business: bizMin,
        sim: { ibanOutcomes: ['technical_error'] },
        to: 'S08',
        then: async (e) => {
          await e.verifyIban();
          await e.verifyIban(true);
          await e.verifyIban(true);
        },
      }),
  },
  {
    id: 'S08--not-checked',
    screen: 'S08',
    title: 'Freelancer, Nafath unverified — IBAN collected only',
    build: () => build({ ...fl, business: bizMin, sim: { nafathOutcomes: ['rejected'] }, to: 'S08', then: (e) => e.verifyIban() }),
  },
  {
    id: 'S08--errors',
    screen: 'S08',
    title: 'Validation errors',
    build: () => build({ business: { iban: 'SA12', vatRegistered: 'yes', channel: 'both', websiteUrl: 'store', mapsUrl: '' }, to: 'S08', then: (e) => e.submitBusiness() }),
  },
  // S09
  { id: 'S09--default', screen: 'S09', title: 'Agreement viewer', primary: true, build: () => build({ business: bizMin, to: 'S09' }) },
  { id: 'S09--agree-error', screen: 'S09', title: 'Acceptance without confirmation', build: () => build({ business: bizMin, to: 'S09', then: (e) => e.acceptContract(false) }) },
  { id: 'S09--decline-confirm', screen: 'S09', title: 'Decline confirmation', build: () => build({ business: bizMin, to: 'S09', then: (e) => e.requestDecline() }) },
  {
    id: 'S09-D--declined',
    screen: 'S09-D',
    title: 'Agreement declined — saved, not submitted',
    primary: true,
    build: () =>
      build({
        business: bizMin,
        to: 'S09',
        then: (e) => {
          e.requestDecline();
          e.confirmDecline();
        },
      }),
  },
  // Outcomes
  { id: 'O-A--submitted', screen: 'O-A', title: 'Submitted', primary: true, build: () => build({ business: bizMin, to: 'O-A' }) },
  {
    id: 'O-B--received',
    screen: 'O-B',
    title: 'Received — manual verification',
    primary: true,
    build: () => build({ business: bizMin, sim: { nafathOutcomes: ['rejected'] }, to: 'O-B' }),
  },
  { id: 'O-C--lead', screen: 'O-C', title: 'Sales lead', primary: true, build: () => build({ entry: { revenueBand: 'GT_20M' }, to: 'O-C' }) },
];

export const galleryStateById = (id: string) => GALLERY_STATES.find((s) => s.id === id);
export const primaryStateFor = (screen: ScreenId) => GALLERY_STATES.find((s) => s.screen === screen && s.primary) ?? GALLERY_STATES.find((s) => s.screen === screen);
