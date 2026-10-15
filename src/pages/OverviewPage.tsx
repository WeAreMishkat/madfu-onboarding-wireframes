import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SCENARIOS } from '../scenarios/scenarios';
import { loadScenario } from '../scenarios/loader';
import { SCREENS, screenById } from '../journeys/screens';
import { GALLERY_STATES } from '../journeys/galleryStates';
import { JOURNEY_MAPS } from '../journeys/maps';
import { mainRuntime, useJourney } from '../state/JourneyContext';
import { GlobalUxNote } from '../components/Handover';
import { isResumable } from './PrototypePage';
import { PDF_FILENAME } from '../app/App';

function Card({ title, children, to, cta }: { title: string; children: ReactNode; to: string; cta: string }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-md border border-neutral-300 p-5">
      <div>
        <h3 className="text-[16px] font-semibold">{title}</h3>
        <div className="mt-1 text-[13.5px] leading-relaxed text-neutral-600">{children}</div>
      </div>
      <Link to={to} className="self-start rounded bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-neutral-800">
        {cta}
      </Link>
    </div>
  );
}

export function OverviewPage() {
  const navigate = useNavigate();
  const { app } = useJourney();
  const groups = ['Registered Business', 'Freelancer', 'Any applicant'] as const;
  return (
    <div className="mx-auto max-w-[1240px] px-8 py-10">
      <div className="flex items-start justify-between gap-10">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Low-fidelity wireframe system · desktop · synthetic data</div>
          <h1 className="mt-2 text-[36px] font-semibold leading-tight">Madfu merchant onboarding</h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-relaxed text-neutral-700">
            A working, end-to-end journey demonstration for Product, Engineering, UX/UI, Risk, Compliance and Sales. Two applicant types — Registered Business (CR) and Freelancer —
            share one entry page and branch on revenue, duplicate checks, OTP, category eligibility, government verification, Nafath, IBAN and contract eligibility. All
            integrations are simulated.
          </p>
        </div>
        <a href={`./${PDF_FILENAME}`} download className="shrink-0 rounded border-2 border-black px-4 py-3 text-[13px] font-semibold hover:bg-neutral-100">
          ↓ Annotated PDF
        </a>
      </div>

      {isResumable(app) && (
        <div className="mt-6 flex items-center justify-between rounded-md border-2 border-dashed border-neutral-500 bg-neutral-50 px-5 py-4" data-testid="overview-resume">
          <div className="text-[14px]">
            <strong>Application in progress</strong> — {app.id} at {app.screen} · {screenById(app.screen).name}
          </div>
          <Link to="/prototype" className="rounded bg-black px-4 py-2 text-[13px] text-white">
            Resume
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-4 gap-4">
        <Card title="Interactive prototype" to="/prototype" cta="Open prototype">
          Click through the real screens. Prototype Controls (right) set every integration outcome and show internal statuses.
        </Card>
        <Card title="Screen gallery" to="/gallery" cta="Browse screens">
          {SCREENS.length} screens, {GALLERY_STATES.length} key states — each opens as an interactive sandbox with annotations.
        </Card>
        <Card title="Journey decision maps" to="/map/A" cta="View maps">
          {JOURNEY_MAPS.length} linked maps: master overview, entry, Registered Business, Freelancer, manual review, contract & outcomes.
        </Card>
        <Card title="Rules & decisions" to="/docs/rules" cta="Read rules">
          Decision tables rendered from the configuration, plus the decision log and UX/UI handover.
        </Card>
      </div>

      <div className="mt-8">
        <GlobalUxNote />
      </div>

      <h2 className="mt-10 text-[22px] font-semibold">Ready-made scenarios ({SCENARIOS.length})</h2>
      <p className="mt-1 text-[14px] text-neutral-600">
        Each scenario sets the simulator and pre-fills values, then hands over to the real screens. Follow the walkthrough shown in Prototype Controls.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-6">
        {groups.map((g) => (
          <section key={g}>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">{g}</h3>
            <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-300">
              {SCENARIOS.filter((s) => s.group === g).map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">
                      {s.id}. {s.title}
                    </div>
                    <div className="text-[12px] text-neutral-500">Ends at {s.expected.finalScreen}</div>
                  </div>
                  <button
                    data-testid={`run-scenario-${s.id}`}
                    className="shrink-0 rounded border border-black px-2.5 py-1 text-[12px] font-medium hover:bg-black hover:text-white"
                    onClick={async () => {
                      await loadScenario(s, mainRuntime);
                      navigate(s.startInProgress ? '/prototype' : '/prototype/start');
                    }}
                  >
                    Run
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-neutral-200 pt-4 text-[12px] text-neutral-500">
        Prototype only. No real merchant, personal, banking or government data. No real SMS, Nafath, government, IBAN or signature services are called. Contract text is a
        placeholder and not legally binding.
      </p>
    </div>
  );
}
