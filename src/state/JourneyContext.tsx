import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { JourneyEngine } from '../journeys/engine';
import { createMockServices } from '../mocks/services';
import { DEFAULT_SIM } from '../mocks/fixtures';
import { Store, createApplication, loadPersistedApplication, loadPersistedSim, persistApplication, persistSim } from './store';
import type { Application, SimSettings } from './types';

export interface JourneyRuntime {
  appStore: Store<Application>;
  simStore: Store<SimSettings>;
  engine: JourneyEngine;
  /** Static mode (print / thumbnails): no timers, no auto-started integrations. */
  staticMode: boolean;
}

export function createRuntime(opts: { app: Application; sim: SimSettings; persist: boolean; sandbox: boolean; staticMode?: boolean }): JourneyRuntime {
  const appStore = new Store(opts.app, opts.persist ? persistApplication : undefined);
  const simStore = new Store(opts.sim, opts.persist ? persistSim : undefined);
  const engine = new JourneyEngine(appStore, createMockServices(simStore.get), { sandbox: opts.sandbox });
  return { appStore, simStore, engine, staticMode: !!opts.staticMode };
}

/** The live, persisted prototype runtime (one per browser tab). */
export const mainRuntime = createRuntime({
  app: loadPersistedApplication() ?? createApplication(),
  sim: loadPersistedSim(),
  persist: true,
  sandbox: false,
});

export function createSandboxRuntime(app: Application, sim: Partial<SimSettings> = {}, staticMode = false) {
  return createRuntime({ app, sim: { ...DEFAULT_SIM, ...sim }, persist: false, sandbox: true, staticMode });
}

const Ctx = createContext<JourneyRuntime>(mainRuntime);

export function JourneyProvider({ runtime, children }: { runtime: JourneyRuntime; children: ReactNode }) {
  return <Ctx.Provider value={runtime}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const runtime = useContext(Ctx);
  const app = useSyncExternalStore(runtime.appStore.subscribe, runtime.appStore.get);
  const sim = useSyncExternalStore(runtime.simStore.subscribe, runtime.simStore.get);
  return useMemo(() => ({ app, sim, engine: runtime.engine, staticMode: runtime.staticMode, runtime }), [app, sim, runtime]);
}

// Test / debugging hook (prototype only): read state from Playwright.
declare global {
  interface Window {
    __madfu?: { getApp: () => Application; getSim: () => SimSettings };
  }
}
if (typeof window !== 'undefined') {
  window.__madfu = { getApp: mainRuntime.appStore.get, getSim: mainRuntime.simStore.get };
}
