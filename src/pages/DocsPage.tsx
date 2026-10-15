import { Link, useParams } from 'react-router-dom';
import { AllRuleTables, DecisionLogTable } from '../components/RuleTables';
import { FieldBehaviourTable, GlobalUxNote, RequiredStatesTable, ScenarioTable, ScreenInventoryTable, UxDecisionsBlock } from '../components/Handover';

const TABS = [
  { id: 'rules', label: 'Business rules' },
  { id: 'decisions', label: 'Decision log' },
  { id: 'handover', label: 'UX/UI handover' },
  { id: 'scenarios', label: 'Scenarios & QA' },
];

export function DocsPage() {
  const { tab = 'rules' } = useParams();
  return (
    <div className="mx-auto max-w-[1240px] px-8 py-8">
      <nav className="flex gap-2" aria-label="Documentation sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={`/docs/${t.id}`}
            className={`rounded border px-3 py-1.5 text-[13px] ${t.id === tab ? 'border-black bg-black text-white' : 'border-neutral-400 hover:bg-neutral-100'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {tab === 'rules' && (
          <>
            <h1 className="text-[28px] font-semibold">Business rules</h1>
            <p className="mb-6 mt-2 text-[14px] text-neutral-600">
              Rendered from <code>src/rules/config.ts</code>, <code>categories.ts</code> and <code>decisions.ts</code> — the same configuration the prototype runs on.
            </p>
            <AllRuleTables />
          </>
        )}
        {tab === 'decisions' && (
          <>
            <h1 className="text-[28px] font-semibold">Decision log</h1>
            <p className="mb-6 mt-2 text-[14px] text-neutral-600">
              Confirmed requirements are separated from provisional assumptions and open product, UX/UI and engineering questions.
            </p>
            <DecisionLogTable />
          </>
        )}
        {tab === 'handover' && (
          <div className="flex flex-col gap-8">
            <h1 className="text-[28px] font-semibold">UX/UI handover</h1>
            <GlobalUxNote />
            <ScreenInventoryTable />
            <FieldBehaviourTable />
            <RequiredStatesTable />
            <UxDecisionsBlock />
          </div>
        )}
        {tab === 'scenarios' && (
          <>
            <h1 className="text-[28px] font-semibold">Scenarios & QA</h1>
            <p className="mb-6 mt-2 text-[14px] text-neutral-600">
              Every scenario is exercised by the automated Playwright suite through the real UI. See <code>docs/QA_REPORT.md</code> in the repository for results.
            </p>
            <ScenarioTable />
          </>
        )}
      </div>
    </div>
  );
}
