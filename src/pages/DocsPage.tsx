import { Link, useParams } from 'react-router-dom';
import { BoardCoverage } from '../components/BoardCoverage';
import { PROJECT_META } from '../app/meta';
import { AllRuleTables, DecisionLogTable } from '../components/RuleTables';
import { FieldBehaviourTable, GlobalUxNote, RequiredStatesTable, ScenarioTable, ScreenInventoryTable, UxDecisionsBlock } from '../components/Handover';

const CONTENTS = [
  { to: '/', title: 'Master Board', body: 'The whole onboarding on one canvas: live wireframes, decisions, retries, outcomes, journey highlighting.' },
  { to: '/prototype', title: 'Interactive Journey', body: 'Click through the real screens with Prototype Controls (scenarios, simulated integrations, internal state).' },
  { to: '/overview', title: 'Scenarios', body: '29 ready-made scenarios — run any of them in the prototype.' },
  { to: '/gallery', title: 'Screen gallery', body: 'Every screen state as an interactive sandbox with its annotation.' },
  { to: '/map/A', title: 'Journey maps', body: 'Sectioned Mermaid decision maps (master, entry, Path A, Path B, manual review, contract).' },
  { to: '/docs/rules', title: 'Business rules', body: 'Decision tables rendered from the rule configuration.' },
  { to: '/docs/decisions', title: 'Decision log', body: 'Confirmed requirements vs provisional assumptions and open decisions.' },
  { to: '/docs/handover', title: 'UX/UI handover', body: 'Global UX note, screen inventory, field behaviour, required states.' },
  { to: '/docs/coverage', title: 'Board coverage', body: 'Board vs implementation: screens, decisions, connections, journeys, problems.' },
  { to: '/docs/scenarios', title: 'QA', body: 'Scenario catalogue covered by the automated test suites.' },
];

function DocsContents() {
  return (
    <div>
      <h1 className="text-[28px] font-semibold">Documentation</h1>
      <p className="mt-2 text-[14px] text-neutral-600">
        Downloads:{' '}
        <a className="underline" href={`./${PROJECT_META.pdfFilename}`} download>
          Annotated wireframes PDF
        </a>{' '}
        ·{' '}
        <a className="underline" href="./Madfu_Onboarding_Master_Board.pdf" download>
          Master Board PDF
        </a>{' '}
        ·{' '}
        <a className="underline" href="./Madfu_Onboarding_Master_Board.svg" download>
          Master Board SVG
        </a>{' '}
        ·{' '}
        <a className="underline" href={PROJECT_META.repoUrl}>
          GitHub repository
        </a>
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {CONTENTS.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-md border border-neutral-300 p-4 hover:border-black">
            <div className="text-[16px] font-semibold">{c.title}</div>
            <div className="mt-1 text-[13px] text-neutral-600">{c.body}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DocsPage() {
  const { tab = 'contents' } = useParams();
  return (
    <div className="mx-auto max-w-[1240px] px-8 py-8">
      <div className="mt-6">
        {tab === 'contents' && <DocsContents />}
        {tab === 'coverage' && <BoardCoverage />}
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
