/**
 * Runs a scenario on a sandboxed engine (no UI) using the same actions a
 * reviewer performs. Shared by the unit tests and the Master Board, which
 * derives each journey's highlighted route from the resulting engine trace.
 */
import { JourneyEngine } from '../journeys/engine';
import { driveTo } from '../journeys/drive';
import { createMockServices } from '../mocks/services';
import { DEFAULT_SIM, SYNTHETIC_IBANS } from '../mocks/fixtures';
import { Store, createApplication } from '../state/store';
import type { Application, ScreenId, SimSettings } from '../state/types';
import type { Scenario } from './scenarios';

export function sandboxEngine(scenario: Scenario) {
  const app = createApplication(`APP-TRACE-${String(scenario.id).padStart(2, '0')}`);
  app.entry = { ...app.entry, ...scenario.entry };
  if (scenario.category) app.category = { ...scenario.category };
  if (scenario.business) app.business = { ...app.business, ...scenario.business };
  const simStore = new Store<SimSettings>({ ...DEFAULT_SIM, latencyMs: 0, nafathAutoResolveMs: 0, identityExists: 'force_new', ...scenario.sim });
  const appStore = new Store<Application>(app);
  return new JourneyEngine(appStore, createMockServices(simStore.get), { sandbox: true });
}

/** Scenario-specific reviewer actions; everything else follows the default forward action per screen. */
export async function runScenario(engine: JourneyEngine, s: Scenario): Promise<void> {
  switch (s.key) {
    case 'any-otp-errors':
      await engine.submitEntry();
      for (let i = 0; i < 3; i++) await engine.verifyOtp('000000');
      return;
    case 'any-contract-declined':
      await driveTo(engine, 'S09');
      engine.requestDecline();
      engine.confirmDecline();
      return;
    case 'cr-nafath-rejected-twice':
      await driveTo(engine, 'S05');
      engine.selectPerson('P-01');
      engine.submitPerson();
      await engine.startNafath();
      engine.resolveNafath();
      engine.changeAuthorisedPerson();
      engine.selectPerson('P-02');
      engine.submitPerson();
      await engine.startNafath();
      engine.resolveNafath();
      await driveTo(engine, s.expected.finalScreen);
      return;
    case 'cr-iban-failed-twice':
      await driveTo(engine, 'S08');
      await engine.verifyIban();
      engine.updateBusiness({ iban: SYNTHETIC_IBANS.secondary });
      await engine.verifyIban();
      await driveTo(engine, s.expected.finalScreen);
      return;
    case 'fl-duplicate':
      await driveTo(engine, 'S01-X');
      engine.openAddCertificateFlow();
      return;
    default:
      await driveTo(engine, s.expected.finalScreen);
  }
}

/** Screen sequence visited by the engine (from its NAVIGATE audit events). */
export function screenTrace(app: Application): ScreenId[] {
  const trace: ScreenId[] = ['S01'];
  for (const a of app.audit) {
    if (a.type !== 'NAVIGATE') continue;
    const to = a.detail.split('→')[1]?.trim() as ScreenId | undefined;
    if (to && to !== trace[trace.length - 1]) trace.push(to);
  }
  return trace;
}

export async function traceScenario(s: Scenario) {
  const engine = sandboxEngine(s);
  await runScenario(engine, s);
  return { app: engine.app, trace: screenTrace(engine.app) };
}
