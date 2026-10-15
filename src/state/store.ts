import type { Application, SimSettings } from './types';
import { DEFAULT_SIM } from '../mocks/fixtures';

export const APP_STORAGE_KEY = 'madfu-demo:application:v1';
export const SIM_STORAGE_KEY = 'madfu-demo:sim:v1';

/** Minimal observable store (works with React's useSyncExternalStore). */
export class Store<T> {
  private listeners = new Set<() => void>();
  constructor(
    private state: T,
    private persist?: (state: T) => void,
  ) {}
  get = (): T => this.state;
  set = (next: T) => {
    this.state = next;
    this.persist?.(next);
    this.listeners.forEach((l) => l());
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export function newApplicationId(): string {
  const n = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0');
  return `APP-DEMO-${n}`;
}

export function createApplication(id = newApplicationId(), now = new Date().toISOString()): Application {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    screen: 'S01',
    synthetic: true,
    entry: { identification: '', countryCode: '+966', mobile: '' },
    identityLocked: false,
    duplicate: { identityChecked: false, identityExists: false, mobileChecked: false, mobileLinkedAccounts: 0 },
    otp: { status: 'not_sent', incorrectAttempts: 0, resendCount: 0, lastError: null },
    routing: {},
    category: {},
    gov: { status: 'idle', calls: 0, manualRetries: 0, personsStatus: 'idle', personsCalls: 0 },
    persons: {},
    nafath: { status: 'idle', attempts: [], technicalFailures: 0, result: 'not_started' },
    certificates: { status: 'idle', calls: 0, list: [] },
    business: { iban: '', vatNumber: '', websiteUrl: '', mapsUrl: '' },
    iban: { status: 'idle', failedAttempts: 0, technicalErrors: 0, calls: 0 },
    contract: { status: 'not_available', version: 'PLACEHOLDER-v0' },
    submission: { state: 'draft' },
    flags: [],
    audit: [],
    costLedger: [],
    ui: { errors: {} },
  };
}

function safeRead<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function safeWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: demo continues in memory */
  }
}

export function loadPersistedApplication(): Application | undefined {
  const app = safeRead<Application>(APP_STORAGE_KEY);
  if (!app || app.synthetic !== true || !app.entry) return undefined;
  // Transient busy states cannot survive a reload; the screen offers a retry instead.
  return { ...app, ui: { ...app.ui, busy: undefined, showDeclineConfirm: false } };
}

export const persistApplication = (app: Application) => safeWrite(APP_STORAGE_KEY, app);
export const loadPersistedSim = (): SimSettings => ({ ...DEFAULT_SIM, ...(safeRead<SimSettings>(SIM_STORAGE_KEY) ?? {}) });
export const persistSim = (sim: SimSettings) => safeWrite(SIM_STORAGE_KEY, sim);
export function clearPersistedApplication() {
  try {
    localStorage.removeItem(APP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
