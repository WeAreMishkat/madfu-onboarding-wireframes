import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deriveAllJourneys } from '../board/journeys';
import { buildCoverage, type CoverageReport } from '../board/coverage';
import { Table, TableBlock } from './RuleTables';

export function BoardCoverage() {
  const [report, setReport] = useState<CoverageReport>();
  useEffect(() => {
    deriveAllJourneys().then((j) => setReport(buildCoverage(j)));
  }, []);
  if (!report) return <div className="text-neutral-500">Running all journeys through the engine…</div>;
  const c = report.counts;
  return (
    <div className="flex flex-col gap-8" data-testid="board-coverage">
      <div>
        <h1 className="text-[28px] font-semibold">Master Board coverage</h1>
        <p className="mt-2 max-w-[900px] text-[14px] text-neutral-600">
          Computed live: every scenario is executed on the journey engine and its screen trace is mapped onto the board through edge conditions. Any transition the board cannot
          represent, unreachable node, dead end, overlap or missing wireframe appears under Problems.
        </p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[
          ['Screen nodes', c.screenNodes],
          ['Distinct screens', c.distinctScreens],
          ['Decision nodes', c.decisionNodes],
          ['Backend / integration', c.processNodes],
          ['Manual-review nodes', c.manualNodes],
          ['Connections', c.edges],
          ['Retry loops', c.loops],
          ['Connectors', c.connectorNodes],
          ['Journeys', c.journeys],
          ['Problems', report.problems.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-neutral-300 p-3">
            <div
              className="text-[24px] font-bold"
              data-testid={`coverage-${String(k)
                .toLowerCase()
                .replace(/[^a-z]+/g, '-')}`}
            >
              {v}
            </div>
            <div className="text-[12px] text-neutral-600">{k}</div>
          </div>
        ))}
      </div>
      <TableBlock title="Problems">
        {report.problems.length ? (
          <Table head={['Problem']} rows={report.problems.map((p) => [p])} />
        ) : (
          <p className="text-[14px]">None — every engine transition is represented, every node is reachable and connected.</p>
        )}
      </TableBlock>
      <TableBlock title="Screens">
        <Table
          head={['Screen', 'Name', 'Board instances', 'Incoming connections', 'Reachable', 'Journeys through it']}
          rows={report.screens.map((s) => [s.id, s.name, s.instances.join(', '), s.incoming, s.reachable ? 'Yes' : 'No', s.journeys])}
        />
      </TableBlock>
      <TableBlock title="Decisions">
        <Table
          head={['Node', 'Decision', 'Branches', 'Journeys']}
          rows={report.decisions.map((d) => [d.id, d.title, d.outgoing.map((o) => `${o.label} → ${o.target}`).join(' · '), d.journeys])}
        />
      </TableBlock>
      <TableBlock title="Journeys (derived from engine runs)">
        <Table
          head={['Journey', 'Engine screen trace', 'Ends at', 'Board steps', 'Status']}
          rows={report.journeys.map((j) => [
            <Link key="j" className="underline" to={`/detailed?journey=${j.id}`}>
              {j.title}
            </Link>,
            j.trace,
            j.outcome,
            j.steps,
            j.ok ? 'Mapped' : j.errors.join('; '),
          ])}
        />
      </TableBlock>
      <TableBlock title="Observed screen-to-screen transitions">
        <Table head={['From', 'To', 'Journeys']} rows={report.transitions.map((t) => [t.from, t.to, t.journeys])} />
      </TableBlock>
      <TableBlock title="Connections">
        <Table dense head={['Edge', 'Label', 'From', 'To', 'Kind', 'Journeys']} rows={report.edges.map((e) => [e.id, e.label, e.from, e.to, e.kind, e.journeys])} />
      </TableBlock>
    </div>
  );
}
