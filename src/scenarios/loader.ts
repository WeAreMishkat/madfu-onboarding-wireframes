import { DEFAULT_SIM } from '../mocks/fixtures';
import { DEMO_REGISTRY_KEY } from '../mocks/services';
import { driveTo } from '../journeys/drive';
import { createApplication } from '../state/store';
import type { JourneyRuntime } from '../state/JourneyContext';
import type { Scenario } from './scenarios';

export const ACTIVE_SCENARIO_KEY = 'madfu-demo:active-scenario:v1';

export function readActiveScenario(): string | undefined {
  try {
    return localStorage.getItem(ACTIVE_SCENARIO_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeActiveScenario(key?: string) {
  try {
    if (key) localStorage.setItem(ACTIVE_SCENARIO_KEY, key);
    else localStorage.removeItem(ACTIVE_SCENARIO_KEY);
  } catch {
    /* ignore */
  }
}

/** Initialise settings + pre-filled values for a scenario; the reviewer then uses the real screens. */
export async function loadScenario(s: Scenario, runtime: JourneyRuntime) {
  const sim = { ...DEFAULT_SIM, ...runtime.simStore.get(), ...pickLatency(runtime), ...resetSim(), ...s.sim };
  const app = createApplication();
  app.entry = { ...app.entry, ...s.entry };
  if (s.category) app.category = { ...s.category };
  if (s.business) app.business = { ...app.business, ...s.business };
  app.audit.push({ at: new Date().toISOString(), type: 'SCENARIO_LOADED', detail: `#${s.id} ${s.title}` });
  runtime.simStore.set(sim);
  runtime.appStore.set(app);
  writeActiveScenario(s.key);
  if (s.startInProgress) {
    runtime.simStore.set({ ...sim, latencyMs: 0 });
    await driveTo(runtime.engine, 'S08');
    runtime.simStore.set(sim);
  }
}

/** Keep the reviewer's latency / auto-resolve preferences when switching scenarios. */
function pickLatency(runtime: JourneyRuntime) {
  const { latencyMs, nafathAutoResolveMs } = runtime.simStore.get();
  return { latencyMs, nafathAutoResolveMs };
}
function resetSim() {
  const { latencyMs: _l, nafathAutoResolveMs: _n, ...rest } = DEFAULT_SIM;
  return rest;
}

export function restartDemo(runtime: JourneyRuntime) {
  runtime.engine.restart();
  runtime.simStore.set({ ...DEFAULT_SIM, ...pickLatency(runtime) });
  writeActiveScenario(undefined);
}

export function clearDemoRegistry() {
  try {
    localStorage.removeItem(DEMO_REGISTRY_KEY);
  } catch {
    /* ignore */
  }
}
