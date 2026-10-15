import { describe, expect, it } from 'vitest';
import { JourneyEngine } from '../../src/journeys/engine';
import { driveTo } from '../../src/journeys/drive';
import { createMockServices } from '../../src/mocks/services';
import { DEFAULT_SIM, SYNTHETIC, SYNTHETIC_IBANS } from '../../src/mocks/fixtures';
import { Store, createApplication } from '../../src/state/store';
import type { Application, SimSettings } from '../../src/state/types';
import { SCENARIOS, type Scenario } from '../../src/scenarios/scenarios';
import { contractEligibility, internalStatuses, maskName, maskNationalId, routeByRevenue, validateEntry, validateIbanFormat } from '../../src/rules/decisions';

function setup(sim: Partial<SimSettings> = {}, entry: Partial<Application['entry']> = {}, extra?: (a: Application) => void) {
  const app = createApplication('APP-TEST');
  app.entry = { ...app.entry, applicantType: 'CR', identification: SYNTHETIC.crNew, revenueBand: 'R_100K_20M', mobile: SYNTHETIC.mobile, ...entry };
  extra?.(app);
  const simStore = new Store<SimSettings>({ ...DEFAULT_SIM, latencyMs: 0, nafathAutoResolveMs: 0, identityExists: 'force_new', ...sim });
  const appStore = new Store<Application>(app);
  const engine = new JourneyEngine(appStore, createMockServices(simStore.get), { sandbox: true });
  return { engine, simStore };
}

function fromScenario(s: Scenario) {
  return setup(s.sim, s.entry, (a) => {
    if (s.category) a.category = { ...s.category };
    if (s.business) a.business = { ...a.business, ...s.business };
  });
}

const flags = (e: JourneyEngine) => e.app.flags.map((f) => f.code);

describe('entry validation', () => {
  it('reports every missing field', () => {
    const errors = validateEntry({ identification: '', countryCode: '+966', mobile: '' });
    expect(Object.keys(errors).sort()).toEqual(['applicantType', 'identification', 'mobile', 'revenueBand']);
  });
  it('rejects invalid formats (structural only)', () => {
    const errors = validateEntry({ applicantType: 'CR', identification: '123', revenueBand: 'LT_100K', countryCode: '+966', mobile: '12345' });
    expect(errors.identification).toBeTruthy();
    expect(errors.mobile).toBeTruthy();
  });
  it('accepts 05 and 5 mobile prefixes', () => {
    for (const mobile of ['0500000001', '500000001'])
      expect(validateEntry({ applicantType: 'FREELANCER', identification: SYNTHETIC.nidNew, revenueBand: 'GT_20M', countryCode: '+966', mobile }).mobile).toBeUndefined();
  });
});

describe('revenue routing', () => {
  it('CR: only the middle band self-onboards', () => {
    expect(routeByRevenue('CR', 'LT_100K')).toBe('SALES_LEAD');
    expect(routeByRevenue('CR', 'R_100K_20M')).toBe('SELF_ONBOARDING');
    expect(routeByRevenue('CR', 'GT_20M')).toBe('SALES_LEAD');
  });
  it('Freelancer: every band self-onboards', () => {
    for (const b of ['LT_100K', 'R_100K_20M', 'GT_20M'] as const) expect(routeByRevenue('FREELANCER', b)).toBe('SELF_ONBOARDING');
  });
});

describe('masking', () => {
  it('masks second and third names and middle ID digits', () => {
    expect(maskName(['Faisal', 'Saad', 'Ibrahim', 'Al-Sample'])).toMatch(/^Faisal •+ •+ Al-Sample$/);
    expect(maskNationalId('1000000011')).toBe('100••••011');
  });
});

describe('IBAN format', () => {
  it('synthetic fixtures pass mod-97, tampered fails', () => {
    expect(validateIbanFormat(SYNTHETIC_IBANS.primary)).toBeUndefined();
    expect(validateIbanFormat(SYNTHETIC_IBANS.secondary)).toBeUndefined();
    expect(validateIbanFormat(SYNTHETIC_IBANS.primary.replace(/1$/, '2'))).toBeTruthy();
    expect(validateIbanFormat('SA12')).toBeTruthy();
  });
});

describe('duplicate detection order', () => {
  it('stops on existing identity before checking mobile', async () => {
    const { engine } = setup({ identityExists: 'force_existing' });
    await engine.submitEntry();
    expect(engine.app.screen).toBe('S01-X');
    const types = engine.app.audit.map((a) => a.type);
    const i1 = types.indexOf('DUPLICATE_CHECK_1_IDENTITY');
    const i2 = types.indexOf('DUPLICATE_CHECK_2_MOBILE');
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
    expect(engine.app.duplicate.mobileChecked).toBe(false);
    expect(engine.app.audit[i2].detail).toMatch(/SKIPPED/);
  });
  it('mobile reuse never blocks', async () => {
    const { engine } = setup({ mobileLinkedAccounts: 3 });
    await engine.submitEntry();
    expect(engine.app.screen).toBe('S02');
    expect(flags(engine)).toContain('MOBILE_LINKED_TO_OTHER_ACCOUNTS');
  });
});

describe('OTP', () => {
  it('locks after 3 incorrect codes; expiry does not consume an attempt', async () => {
    const { engine } = setup();
    await engine.submitEntry();
    await engine.verifyOtp('000000');
    engine.simulateOtpExpiry();
    await engine.verifyOtp('000000');
    expect(engine.app.otp.incorrectAttempts).toBe(1);
    expect(engine.app.otp.lastError).toBe('expired');
    await engine.resendOtp(true);
    await engine.verifyOtp('000000');
    expect(engine.app.screen).toBe('S02');
    await engine.verifyOtp('000000');
    expect(engine.app.screen).toBe('S02-L');
  });
});

describe('category screening avoids paid calls', () => {
  it('blocked category → lead with zero paid calls', async () => {
    const { engine } = setup({}, {}, (a) => (a.category = { categoryId: 'C90', subcategoryId: 'C90-01' }));
    await driveTo(engine, 'O-C');
    expect(engine.app.screen).toBe('O-C');
    expect(engine.app.costLedger).toHaveLength(0);
    expect(internalStatuses(engine.app)).toContain('SALES_LEAD');
  });
});

describe('Nafath attempt policy', () => {
  it('changing the authorised person preserves the shared counter (max 2)', async () => {
    const { engine } = setup(
      { nafathOutcomes: ['rejected', 'rejected', 'verified'], personsFixture: 'multiple' },
      {},
      (a) => (a.category = { categoryId: 'C10', subcategoryId: 'C10-01' }),
    );
    await driveTo(engine, 'S06');
    await engine.startNafath();
    engine.resolveNafath();
    expect(engine.app.nafath.attempts).toHaveLength(1);
    engine.changeAuthorisedPerson();
    expect(engine.app.screen).toBe('S05');
    engine.selectPerson('P-02');
    engine.submitPerson();
    await engine.startNafath();
    expect(engine.app.nafath.attempts).toHaveLength(2);
    expect(engine.app.nafath.attempts[1].personId).toBe('P-02');
    engine.resolveNafath();
    expect(engine.app.nafath.result).toBe('unverified');
    // a third attempt is impossible even though the sequence would verify
    await engine.startNafath();
    expect(engine.app.nafath.attempts).toHaveLength(2);
    expect(contractEligibility(engine.app).allowed).toBe(false);
  });
  it('technical failure does not consume an attempt', async () => {
    const { engine } = setup({ nafathOutcomes: ['technical_failure', 'verified'] }, {}, (a) => (a.category = { categoryId: 'C10', subcategoryId: 'C10-01' }));
    await driveTo(engine, 'S06');
    await engine.startNafath();
    expect(engine.app.nafath.attempts).toHaveLength(0);
    expect(engine.app.nafath.technicalFailures).toBe(1);
    await engine.retryNafath();
    engine.resolveNafath();
    expect(engine.app.nafath.result).toBe('verified');
  });
});

describe('IBAN verification', () => {
  it('never repeats a call for an unchanged value; editing invalidates', async () => {
    const { engine } = setup({}, {}, (a) => (a.category = { categoryId: 'C10', subcategoryId: 'C10-01' }));
    await driveTo(engine, 'S08');
    engine.updateBusiness({ iban: SYNTHETIC_IBANS.primary });
    await engine.verifyIban();
    await engine.verifyIban();
    expect(engine.app.iban.calls).toBe(1);
    expect(engine.app.iban.status).toBe('verified');
    engine.updateBusiness({ iban: SYNTHETIC_IBANS.secondary });
    expect(engine.app.iban.status).toBe('idle');
    await engine.verifyIban();
    expect(engine.app.iban.calls).toBe(2);
  });
  it('two failures allow progress and keep the contract available', async () => {
    const { engine } = setup({ ibanOutcomes: ['not_verified'] }, {}, (a) => (a.category = { categoryId: 'C10', subcategoryId: 'C10-01' }));
    await driveTo(engine, 'S08');
    engine.updateBusiness({ iban: SYNTHETIC_IBANS.primary, vatRegistered: 'no', channel: 'online', websiteUrl: 'https://sample-store.example' });
    await engine.verifyIban();
    await engine.submitBusiness();
    expect(engine.app.screen).toBe('S08');
    await engine.verifyIban(true);
    expect(engine.app.iban.status).toBe('failed_max');
    await engine.submitBusiness();
    expect(engine.app.screen).toBe('S09');
  });
  it('freelancer with failed Nafath: ownership API is not called', async () => {
    const { engine } = setup(
      { nafathOutcomes: ['rejected'] },
      { applicantType: 'FREELANCER', identification: SYNTHETIC.nidNew },
      (a) => (a.category = { categoryId: 'C40', subcategoryId: 'C40-01' }),
    );
    await driveTo(engine, 'O-B');
    expect(engine.app.screen).toBe('O-B');
    expect(engine.app.iban.calls).toBe(0);
    expect(engine.app.iban.status).toBe('not_checked');
  });
});

describe('entry changes invalidate dependents', () => {
  it('switching applicant type resets identification and CR data', async () => {
    const { engine } = setup({}, {}, (a) => (a.category = { categoryId: 'C10', subcategoryId: 'C10-01' }));
    await driveTo(engine, 'S05');
    engine.back();
    engine.back();
    engine.back();
    expect(engine.app.screen).toBe('S01');
    engine.updateEntry({ applicantType: 'FREELANCER' });
    expect(engine.app.entry.identification).toBe('');
    expect(engine.app.gov.status).toBe('idle');
    expect(engine.app.gov.record).toBeUndefined();
  });
  it('identity is locked once Nafath has started', async () => {
    const { engine } = setup({}, {}, (a) => (a.category = { categoryId: 'C10', subcategoryId: 'C10-01' }));
    await driveTo(engine, 'S06');
    await engine.startNafath();
    engine.updateEntry({ identification: '1010000002' });
    expect(engine.app.entry.identification).toBe(SYNTHETIC.crNew);
  });
});

describe('scenario catalogue (engine-level)', () => {
  for (const s of SCENARIOS) {
    it(`#${s.id} ${s.title}`, async () => {
      const { engine } = fromScenario(s);
      if (s.key === 'any-otp-errors') {
        await engine.submitEntry();
        for (let i = 0; i < 3; i++) await engine.verifyOtp('000000');
      } else if (s.key === 'any-contract-declined') {
        await driveTo(engine, 'S09');
        engine.requestDecline();
        engine.confirmDecline();
      } else {
        await driveTo(engine, s.expected.finalScreen);
      }
      expect(engine.app.screen).toBe(s.expected.finalScreen);
      for (const st of s.expected.statuses ?? []) expect(internalStatuses(engine.app)).toContain(st);
      for (const f of s.expected.flags ?? []) expect(flags(engine)).toContain(f);
      if (s.expected.noPaidCalls) expect(engine.app.costLedger).toHaveLength(0);
    });
  }
});
