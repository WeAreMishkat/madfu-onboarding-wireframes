/**
 * PROTOTYPE CONTROLS — reviewer-only panel, docked beside (never over) the
 * customer wireframe. Sets mock-integration outcomes, loads scenarios and
 * exposes internal state that is never shown to applicants.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { REVENUE_BANDS, NAFATH_POLICY, IBAN_POLICY, type RevenueBand } from '../rules/config';
import { contractEligibility, internalStatuses } from '../rules/decisions';
import { SYNTHETIC, SYNTHETIC_IBANS } from '../mocks/fixtures';
import { SCENARIOS, scenarioByKey } from '../scenarios/scenarios';
import { clearDemoRegistry, loadScenario, readActiveScenario, restartDemo } from '../scenarios/loader';
import { useJourney } from '../state/JourneyContext';
import type { NafathOutcome, SimSettings } from '../state/types';
import { screenById } from '../journeys/screens';

function Section({ title, children, defaultOpen = true, testId }: { title: string; children: ReactNode; defaultOpen?: boolean; testId?: string }) {
  return (
    <details open={defaultOpen} className="border-b border-neutral-300" data-testid={testId}>
      <summary className="cursor-pointer select-none px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-neutral-700 hover:bg-neutral-100">{title}</summary>
      <div className="flex flex-col gap-2.5 px-4 pb-4">{children}</div>
    </details>
  );
}

function Ctl({ label, value, onChange, options, testId }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; testId?: string }) {
  return (
    <label className="grid grid-cols-[130px_1fr] items-center gap-2 text-[12px]">
      <span className="text-neutral-600">{label}</span>
      <select data-testid={testId} className="h-7 rounded border border-neutral-400 bg-white px-1.5 text-[12px]" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

const GOV_PRESETS: Record<string, { label: string; seq: SimSettings['govOutcomes'] }> = {
  valid: { label: 'Valid', seq: ['valid'] },
  expired: { label: 'Expired', seq: ['expired'] },
  not_found: { label: 'Invalid / not found', seq: ['not_found'] },
  unavailable_then_valid: { label: 'Unavailable → valid on manual retry', seq: ['unavailable', 'unavailable', 'unavailable', 'valid'] },
  unavailable: { label: 'Unavailable (persistent)', seq: ['unavailable'] },
  provider_error: { label: 'Unexpected provider error', seq: ['provider_error'] },
  provider_error_then_valid: { label: 'Provider error → valid', seq: ['provider_error', 'valid'] },
};

const NAFATH_OPTS: [NafathOutcome, string][] = [
  ['verified', 'Verified'],
  ['rejected', 'Rejected'],
  ['timeout', 'Timed out'],
  ['technical_failure', 'Technical failure'],
];
const IBAN_OPTS: [SimSettings['ibanOutcomes'][number], string][] = [
  ['verified', 'Verified'],
  ['not_verified', 'Not verified'],
  ['technical_error', 'Technical error'],
];

function seqAt<T>(seq: T[], i: number): T {
  return seq[Math.min(i, seq.length - 1)];
}
function setSeqAt<T>(seq: T[], i: number, v: T, len: number): T[] {
  const full = Array.from({ length: len }, (_, k) => seqAt(seq, k));
  full[i] = v;
  return full;
}

export function PrototypeControls({ onCollapse }: { onCollapse: () => void }) {
  const { app, sim, engine, runtime } = useJourney();
  const navigate = useNavigate();
  const [scenarioKey, setScenarioKey] = useState<string>(() => readActiveScenario() ?? SCENARIOS[0].key);
  const active = scenarioByKey(readActiveScenario() ?? '');
  const setSim = (patch: Partial<SimSettings>) => runtime.simStore.set({ ...sim, ...patch });
  const govPreset = Object.entries(GOV_PRESETS).find(([, p]) => JSON.stringify(p.seq) === JSON.stringify(sim.govOutcomes))?.[0] ?? 'custom';
  const statuses = internalStatuses(app);
  const elig = contractEligibility(app);
  const costByService = app.costLedger.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.service]: (acc[c.service] ?? 0) + 1 }), {});
  const [entryType, setEntryType] = useState<'CR' | 'FREELANCER'>('CR');
  const [entryIdentity, setEntryIdentity] = useState<'new' | 'existing'>('new');
  const [entryRevenue, setEntryRevenue] = useState<RevenueBand>('R_100K_20M');

  return (
    <aside
      data-testid="prototype-controls"
      aria-label="Prototype Controls"
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-neutral-300 bg-neutral-50 text-[13px]"
    >
      <div className="flex items-center justify-between border-b border-neutral-300 bg-white px-4 py-3">
        <div>
          <div className="text-[14px] font-semibold">Prototype Controls</div>
          <div className="text-[11px] text-neutral-500">Reviewer-only · not part of the customer UI</div>
        </div>
        <button className="rounded border border-neutral-400 px-2 py-1 text-[12px] hover:bg-neutral-100" onClick={onCollapse} data-testid="controls-collapse">
          Hide ▸
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Section title="Scenarios" testId="controls-scenarios">
          <select
            data-testid="scenario-select"
            className="h-8 w-full rounded border border-neutral-400 bg-white px-1.5 text-[12px]"
            value={scenarioKey}
            onChange={(e) => setScenarioKey(e.target.value)}
          >
            {SCENARIOS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.id}. {s.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              data-testid="scenario-load"
              className="h-8 flex-1 rounded bg-black text-[12px] font-medium text-white hover:bg-neutral-800"
              onClick={async () => {
                const s = scenarioByKey(scenarioKey)!;
                await loadScenario(s, runtime);
                navigate(s.startInProgress ? '/prototype' : '/prototype/start');
              }}
            >
              Load scenario
            </button>
            <button
              data-testid="restart-demo"
              className="h-8 flex-1 rounded border border-neutral-500 bg-white text-[12px] hover:bg-neutral-100"
              onClick={() => {
                restartDemo(runtime);
                navigate('/prototype/start');
              }}
            >
              Restart demo
            </button>
          </div>
          {active && (
            <div className="rounded border border-neutral-300 bg-white p-3" data-testid="active-scenario">
              <div className="text-[12px] font-semibold">
                Active: #{active.id} {active.title}
              </div>
              <p className="mt-1 text-[12px] text-neutral-600">{active.summary}</p>
              <ol className="mt-2 list-decimal pl-4 text-[12px] text-neutral-800">
                {active.walkthrough.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ol>
              <div className="mt-2 text-[12px]">
                Expected end: <strong>{active.expected.finalScreen}</strong> — {screenById(active.expected.finalScreen).name}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
            <button className="underline" data-testid="show-resume" onClick={() => navigate('/prototype')}>
              Show resume screen
            </button>
            <button className="underline" onClick={() => navigate('/')}>
              Journey overview
            </button>
            <button className="underline" onClick={() => clearDemoRegistry()} title="Forget identities of demo applications submitted in this browser">
              Clear demo registry
            </button>
          </div>
        </Section>

        <Section title="Entry pre-fill (S01)" defaultOpen={false}>
          <Ctl
            label="Applicant type"
            value={entryType}
            onChange={(v) => setEntryType(v as 'CR' | 'FREELANCER')}
            options={[
              ['CR', 'Registered Business'],
              ['FREELANCER', 'Freelancer'],
            ]}
          />
          <Ctl
            label="Identity"
            value={entryIdentity}
            onChange={(v) => setEntryIdentity(v as 'new' | 'existing')}
            options={[
              ['new', 'New (synthetic)'],
              ['existing', 'Already registered (synthetic)'],
            ]}
          />
          <Ctl label="Revenue band" value={entryRevenue} onChange={(v) => setEntryRevenue(v as RevenueBand)} options={REVENUE_BANDS.map((b) => [b.value, b.label])} />
          <button
            className="h-7 rounded border border-neutral-500 bg-white text-[12px] hover:bg-neutral-100 disabled:opacity-50"
            disabled={app.screen !== 'S01' || app.identityLocked}
            onClick={() => {
              const id =
                entryType === 'CR' ? (entryIdentity === 'new' ? SYNTHETIC.crNew : SYNTHETIC.crExisting) : entryIdentity === 'new' ? SYNTHETIC.nidNew : SYNTHETIC.nidExisting;
              engine.updateEntry({ applicantType: entryType });
              engine.updateEntry({ identification: id, revenueBand: entryRevenue, mobile: SYNTHETIC.mobile });
              setSim({ identityExists: entryIdentity === 'existing' ? 'auto' : sim.identityExists });
            }}
          >
            Fill S01 form
          </button>
          <span className="text-[11px] text-neutral-500">Available on S01 before Nafath has started.</span>
        </Section>

        <Section title="Simulation settings" testId="controls-sim">
          <Ctl
            label="Simulated latency"
            value={String(sim.latencyMs)}
            onChange={(v) => setSim({ latencyMs: Number(v) })}
            options={[
              ['0', 'None'],
              ['300', '0.3 s'],
              ['700', '0.7 s'],
              ['1500', '1.5 s'],
            ]}
            testId="sim-latency"
          />
          <Ctl
            label="Nafath auto-resolve"
            value={String(sim.nafathAutoResolveMs)}
            onChange={(v) => setSim({ nafathAutoResolveMs: Number(v) })}
            options={[
              ['0', 'Off (use dev buttons)'],
              ['1500', '1.5 s'],
              ['4000', '4 s'],
              ['8000', '8 s'],
            ]}
            testId="sim-nafath-auto"
          />
          <Ctl
            label="Existing identity"
            value={sim.identityExists}
            onChange={(v) => setSim({ identityExists: v as SimSettings['identityExists'] })}
            options={[
              ['auto', 'Auto (fixture registry)'],
              ['force_existing', 'Force existing'],
              ['force_new', 'Force new'],
            ]}
            testId="sim-identity"
          />
          <Ctl
            label="Mobile linked to"
            value={String(sim.mobileLinkedAccounts)}
            onChange={(v) => setSim({ mobileLinkedAccounts: Number(v) })}
            options={[
              ['0', '0 other accounts'],
              ['1', '1 other account'],
              ['3', '3 other accounts'],
            ]}
          />
          <Ctl
            label="CR lookup"
            value={govPreset}
            onChange={(v) => v !== 'custom' && setSim({ govOutcomes: GOV_PRESETS[v].seq })}
            options={[
              ...Object.entries(GOV_PRESETS).map(([k, p]) => [k, p.label] as [string, string]),
              ...(govPreset === 'custom' ? [['custom', 'Custom sequence'] as [string, string]] : []),
            ]}
            testId="sim-gov"
          />
          <Ctl
            label="Authorized persons"
            value={sim.personsFixture}
            onChange={(v) => setSim({ personsFixture: v as SimSettings['personsFixture'] })}
            options={[
              ['one', '1 individual'],
              ['multiple', '3 individuals + 2 entities'],
              ['none', 'Entities only (none eligible)'],
            ]}
            testId="sim-persons"
          />
          <Ctl
            label="Related-party data"
            value={sim.personsAvailability}
            onChange={(v) => setSim({ personsAvailability: v as SimSettings['personsAvailability'] })}
            options={[
              ['available', 'Available'],
              ['unavailable_once', 'Unavailable once'],
              ['unavailable', 'Unavailable'],
            ]}
          />
          {[0, 1].map((i) => (
            <Ctl
              key={i}
              label={`Nafath request ${i + 1}`}
              value={seqAt(sim.nafathOutcomes, i)}
              onChange={(v) => setSim({ nafathOutcomes: setSeqAt(sim.nafathOutcomes, i, v as NafathOutcome, Math.max(2, sim.nafathOutcomes.length)) })}
              options={NAFATH_OPTS}
              testId={`sim-nafath-${i + 1}`}
            />
          ))}
          <Ctl
            label="Certificates"
            value={sim.certificatesFixture}
            onChange={(v) => setSim({ certificatesFixture: v as SimSettings['certificatesFixture'] })}
            options={[
              ['none', 'None found'],
              ['one', '1 certificate'],
              ['multiple', '3 certificates'],
              ['expired', 'Expired certificate'],
              ['inconsistent', 'Inconsistent holder data'],
              ['attached', 'One already attached'],
              ['mismatch', 'Category mismatch'],
              ['restricted', 'Maps to restricted category'],
            ]}
            testId="sim-certs"
          />
          <Ctl
            label="Certificate service"
            value={sim.certificatesAvailability}
            onChange={(v) => setSim({ certificatesAvailability: v as SimSettings['certificatesAvailability'] })}
            options={[
              ['available', 'Available'],
              ['unavailable_once', 'Unavailable once'],
              ['unavailable', 'Unavailable'],
            ]}
          />
          {[0, 1, 2].map((i) => (
            <Ctl
              key={i}
              label={`IBAN check ${i + 1}`}
              value={seqAt(sim.ibanOutcomes, i)}
              onChange={(v) => setSim({ ibanOutcomes: setSeqAt(sim.ibanOutcomes, i, v as SimSettings['ibanOutcomes'][number], Math.max(3, sim.ibanOutcomes.length)) })}
              options={IBAN_OPTS}
              testId={`sim-iban-${i + 1}`}
            />
          ))}
          <Ctl
            label="Contract (hint)"
            value={sim.contractAction}
            onChange={(v) => setSim({ contractAction: v as SimSettings['contractAction'] })}
            options={[
              ['reviewer_choice', 'Reviewer chooses'],
              ['accept', 'Expect acceptance'],
              ['decline', 'Expect decline'],
            ]}
          />
          <p className="text-[11px] leading-snug text-neutral-500">Sequences apply per call; the last value repeats. Changes take effect on the next integration call.</p>
        </Section>

        <Section title="Demo data (synthetic)" defaultOpen={false}>
          <div className="grid grid-cols-[130px_1fr] gap-y-1 text-[12px]">
            <span className="text-neutral-600">OTP code</span>
            <code data-testid="demo-otp">{SYNTHETIC.otpCode}</code>
            <span className="text-neutral-600">New CR</span>
            <code>{SYNTHETIC.crNew}</code>
            <span className="text-neutral-600">Registered CR</span>
            <code>{SYNTHETIC.crExisting}</code>
            <span className="text-neutral-600">New National ID</span>
            <code>{SYNTHETIC.nidNew}</code>
            <span className="text-neutral-600">Registered NID</span>
            <code>{SYNTHETIC.nidExisting}</code>
            <span className="text-neutral-600">Mobile</span>
            <code>{SYNTHETIC.mobile}</code>
            <span className="text-neutral-600">IBAN A / B</span>
            <code className="break-all">
              {SYNTHETIC_IBANS.primary}
              <br />
              {SYNTHETIC_IBANS.secondary}
            </code>
            <span className="text-neutral-600">Attached cert.</span>
            <code>FL-000000106</code>
          </div>
          <p className="text-[11px] text-neutral-500">All values are invented. The OTP code is shown here only — never in the customer UI.</p>
        </Section>

        <Section title="Internal state (never shown to applicant)" testId="controls-internal">
          <div className="grid grid-cols-[130px_1fr] gap-y-1 text-[12px]" data-testid="internal-state">
            <span className="text-neutral-600">Application</span>
            <code>{app.id}</code>
            <span className="text-neutral-600">Screen</span>
            <code data-testid="internal-screen">{app.screen}</code>
            <span className="text-neutral-600">Journey</span>
            <code>{app.routing.journey ?? '—'}</code>
            <span className="text-neutral-600">Mobile</span>
            <code>
              {app.otp.status} · wrong {app.otp.incorrectAttempts}/3
            </code>
            <span className="text-neutral-600">Category</span>
            <code>
              {app.category.subcategoryId ?? '—'} {app.category.eligibility ? `· ${app.category.eligibility}` : ''}
            </code>
            <span className="text-neutral-600">Gov CR</span>
            <code>{app.gov.status}</code>
            <span className="text-neutral-600">Nafath</span>
            <code data-testid="internal-nafath">
              {app.nafath.result} · {app.nafath.attempts.length}/{NAFATH_POLICY.maxAttemptsPerApplication} used
            </code>
            <span className="text-neutral-600">IBAN</span>
            <code data-testid="internal-iban">
              {app.iban.status} · failed {app.iban.failedAttempts}/{IBAN_POLICY.maxUnsuccessfulOwnershipAttempts}
            </code>
            <span className="text-neutral-600">Contract</span>
            <code data-testid="internal-contract">
              {app.contract.status} · {elig.allowed ? 'eligible' : 'not eligible'}
            </code>
            <span className="text-neutral-600">Submission</span>
            <code>
              {app.submission.state}
              {app.submission.outcome ? ` · ${app.submission.outcome}` : ''}
            </code>
            <span className="text-neutral-600">Paid calls</span>
            <code data-testid="internal-cost">
              {app.costLedger.length
                ? Object.entries(costByService)
                    .map(([k, v]) => `${k}×${v}`)
                    .join(', ')
                : 'none'}
            </code>
          </div>
          <div className="flex flex-wrap gap-1" data-testid="internal-statuses">
            {statuses.length ? (
              statuses.map((s) => (
                <span key={s} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-neutral-500">No internal statuses yet</span>
            )}
          </div>
          {app.flags.length > 0 && (
            <ul className="flex flex-col gap-1" data-testid="internal-flags">
              {app.flags.map((f) => (
                <li key={f.code} className="rounded border border-dashed border-neutral-500 bg-white px-2 py-1 text-[11.5px]">
                  <span className="font-semibold">{f.code}</span>
                  <span className="block text-neutral-600">{f.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Audit log (${app.audit.length})`} defaultOpen={false}>
          <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto" data-testid="audit-log">
            {[...app.audit].reverse().map((a, i) => (
              <li key={i} className="border-b border-neutral-200 pb-1 text-[11.5px]">
                <span className="font-semibold">{a.type}</span> <span className="text-neutral-600">{a.detail}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </aside>
  );
}
