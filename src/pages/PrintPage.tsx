/**
 * PRINT DOCUMENT — the source of Madfu_Merchant_Onboarding_Wireframes.pdf.
 * Renders the real screen components (sandboxed, static) at desktop width,
 * the Mermaid maps, and the rule tables from configuration. Playwright prints
 * this route to an A3-landscape PDF (scripts/generate-pdf).
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GALLERY_STATES, type GalleryState } from '../journeys/galleryStates';
import { GLOBAL_UX_NOTE, SCREENS, screenById } from '../journeys/screens';
import { JOURNEY_MAPS, LEGEND_MAP, type JourneyMap } from '../journeys/maps';
import { JourneyProvider, createSandboxRuntime, useJourney, type JourneyRuntime } from '../state/JourneyContext';
import type { ScreenId } from '../state/types';
import { CurrentScreen } from '../screens';
import { S00Resume } from '../screens/EntryScreens';
import { HostNavContext, MerchantFrame } from '../components/MerchantFrame';
import { Annotation, FitBox } from '../components/Annotation';
import { MermaidDiagram } from '../components/Mermaid';
import {
  CategoryTable,
  CertificateMappingTable,
  ContractTable,
  DecisionLogTable,
  DuplicateTable,
  GovTable,
  IbanTable,
  IntegrationTable,
  NafathTable,
  OtpTable,
  RevenueTable,
  StatusTable,
  Table,
  ValidationTable,
} from '../components/RuleTables';
import { FieldBehaviourTable, GlobalUxNote, RequiredStatesTable, ScenarioTable, ScreenInventoryTable, UxDecisionsBlock } from '../components/Handover';
import { PROJECT_META } from '../app/meta';

const PAGE_W = 1587; // A3 landscape @ 96 dpi
const PAGE_H = 1122;

declare global {
  interface Window {
    __PRINT_READY__?: boolean;
  }
}

// ---------- page model ----------

interface PageDef {
  key: string;
  section: string;
  sectionNo: number;
  title: string;
  anchor?: string;
  tocEntry?: boolean;
  render: (ctx: RenderCtx) => ReactNode;
}
interface RenderCtx {
  runtimes: Record<string, JourneyRuntime>;
  pageOf: (anchor: string) => number | undefined;
  onMapRendered: () => void;
}

const SECTIONS = [
  'Cover',
  'Contents',
  'Scope and design principles',
  'Master journey overview',
  'Entry, OTP and eligibility',
  'Registered Business journey map',
  'Registered Business wireframes',
  'Freelancer journey map',
  'Freelancer wireframes',
  'Manual-review journeys',
  'Contract and submission outcomes',
  'Validation and error-state examples',
  'Business decision tables',
  'UX/UI handover notes',
  'Scenario coverage (QA)',
  'Assumptions and pending decisions',
];
const sec = (n: number) => ({ sectionNo: n, section: SECTIONS[n - 1] });

const MAP_SCREENS: Record<string, ScreenId[]> = {
  A: ['S01', 'S01-X', 'S02', 'S02-L', 'S03', 'S08', 'S09', 'S09-D', 'O-A', 'O-B', 'O-C'],
  B: ['S00', 'S01', 'S01-X', 'S01-F', 'S02', 'S02-L', 'S03', 'O-C'],
  C1: ['S03', 'S04', 'S05', 'S01', 'O-C'],
  C2: ['S05', 'S06', 'S08'],
  D1: ['S03', 'S06', 'S07-M', 'O-C'],
  D2: ['S06', 'S07', 'S07-M', 'S08', 'O-C'],
  E: ['S09', 'O-B', 'O-C'],
  F: ['S08', 'S09', 'S09-D', 'O-A', 'O-B'],
};

/** Main screen pages: [screen, gallery state id, section number]. */
const SCREEN_PAGES: [ScreenId, string, number][] = [
  ['S00', 'S00--resume', 5],
  ['S01', 'S01--filled-cr', 5],
  ['S01-X', 'S01-X--cr', 5],
  ['S01-F', 'S01-F--future', 5],
  ['S02', 'S02--default', 5],
  ['S02-L', 'S02-L--locked', 5],
  ['S03', 'S03--selected', 5],
  ['S04', 'S04--valid', 7],
  ['S05', 'S05--multiple', 7],
  ['S06', 'S06--waiting', 7],
  ['S06', 'S06--fl-ready', 9],
  ['S07', 'S07--multiple', 9],
  ['S07-M', 'S07-M--manual', 9],
  ['S08', 'S08--verified', 11],
  ['S09', 'S09--default', 11],
  ['S09-D', 'S09-D--declined', 11],
  ['O-A', 'O-A--submitted', 11],
  ['O-B', 'O-B--received', 11],
  ['O-C', 'O-C--lead', 11],
];

// ---------- rendering helpers ----------

function StateView({ state, runtime, width, maxHeight }: { state: GalleryState; runtime: JourneyRuntime; width: number; maxHeight: number }) {
  return (
    <FitBox width={width} maxHeight={maxHeight}>
      <JourneyProvider runtime={runtime}>
        <HostNavContext.Provider value={{ sandbox: true, exitToOverview: () => {}, restart: () => {} }}>
          {state.screen === 'S00' ? (
            <MerchantFrame screen="S00">
              <S00Resume onContinue={() => {}} onStartNew={() => {}} />
            </MerchantFrame>
          ) : (
            <SandboxScreen />
          )}
        </HostNavContext.Provider>
      </JourneyProvider>
    </FitBox>
  );
}
function SandboxScreen() {
  const { app } = useJourney();
  return <CurrentScreen screen={app.screen as Exclude<ScreenId, 'S00'>} />;
}

function Page({ page, n, total, children }: { page: PageDef; n: number; total: number; children: ReactNode }) {
  return (
    <div
      id={page.anchor}
      className="print-page relative flex flex-col overflow-hidden bg-white text-black"
      style={{ width: PAGE_W, height: PAGE_H, padding: '30px 44px 0', contain: 'strict' }}
      data-page={n}
    >
      {page.sectionNo > 1 && (
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-300 text-[12px] text-neutral-500">
          <span>
            <span className="font-semibold text-black">
              {page.sectionNo - 0}. {page.section}
            </span>
            {page.title !== page.section && <span> · {page.title}</span>}
          </span>
          <a href="#toc" className="underline underline-offset-2">
            Contents
          </a>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden pt-5">{children}</div>
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-neutral-200 text-[11px] text-neutral-500">
        <span>
          {PROJECT_META.title} · v{PROJECT_META.version} · Low-fidelity wireframes · Synthetic data only
        </span>
        <span>
          Page {n} of {total}
        </span>
      </div>
    </div>
  );
}

function ScreenPage({ screen, stateId, ctx }: { screen: ScreenId; stateId: string; ctx: RenderCtx }) {
  const state = GALLERY_STATES.find((g) => g.id === stateId)!;
  const def = screenById(screen);
  const maps = Object.entries(MAP_SCREENS)
    .filter(([, ids]) => ids.includes(screen))
    .map(([id]) => id);
  const variants = GALLERY_STATES.filter((g) => g.screen === screen && g.id !== stateId && !SCREEN_PAGES.some(([, sid]) => sid === g.id));
  return (
    <div className="flex h-full gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded bg-black px-2.5 py-1 text-[16px] font-bold text-white">{screen}</span>
          <span className="text-[22px] font-semibold">{def.name}</span>
          <span className="text-[14px] text-neutral-500">· {state.title}</span>
        </div>
        <div className="rounded-lg border border-neutral-300 bg-neutral-100 p-3">
          <StateView state={state} runtime={ctx.runtimes[stateId]} width={980} maxHeight={890} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Annotation screen={screen} compact globalRef="#ux-handover" />
        <div className="rounded-md border border-neutral-300 px-4 py-3 text-[12.5px] leading-relaxed">
          <div className="font-semibold">Cross-references</div>
          <div>
            Journey maps:{' '}
            {maps.map((m, i) => (
              <Fragment key={m}>
                {i > 0 && ' · '}
                <a className="underline" href={`#map-${m}`}>
                  Map {m} (p. {ctx.pageOf(`map-${m}`)})
                </a>
              </Fragment>
            ))}
          </div>
          {variants.length > 0 && (
            <div className="mt-1">
              Other states:{' '}
              {variants.map((v, i) => (
                <Fragment key={v.id}>
                  {i > 0 && ' · '}
                  <a className="underline" href={`#state-${v.id}`}>
                    {v.title} (p. {ctx.pageOf(`state-${v.id}`)})
                  </a>
                </Fragment>
              ))}
            </div>
          )}
          <div className="mt-1 text-neutral-500">
            Interactive: {PROJECT_META.siteUrl}#/gallery/{stateId}
          </div>
        </div>
      </div>
    </div>
  );
}

function MapPage({ map, ctx }: { map: JourneyMap; ctx: RenderCtx }) {
  const screens = MAP_SCREENS[map.id] ?? [];
  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="text-[24px] font-semibold">{map.title}</h2>
        <p className="text-[14px] text-neutral-600">{map.description}</p>
      </div>
      <div className="rounded border border-neutral-300 px-3 py-0.5 [&_svg]:!max-h-[44px]">
        <MermaidDiagram code={LEGEND_MAP.code} onRendered={ctx.onMapRendered} />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: '100%' }} className="[&_svg]:!h-[790px] [&_svg]:!w-full [&_svg]:!max-w-none">
          <MermaidDiagram
            code={map.code}
            fit={{ width: 1499, height: 790 }}
            onRendered={ctx.onMapRendered}
            linkRewrite={(h) => h.replace(/^#\/gallery\/([^-]+(?:-[A-Z])?)--.*$/, '#screen-$1')}
          />
        </div>
      </div>
      <div className="text-[12.5px]">
        <span className="font-semibold">Screens in this map: </span>
        {screens.map((s, i) => (
          <Fragment key={s}>
            {i > 0 && ' · '}
            <a className="underline" href={`#screen-${s}`}>
              {s} {screenById(s).name} (p. {ctx.pageOf(`screen-${s}`)})
            </a>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function VariantsPage({ states, ctx }: { states: GalleryState[]; ctx: RenderCtx }) {
  return (
    <div className="grid h-full grid-cols-2 gap-8">
      {states.map((s) => (
        <div key={s.id} id={`state-${s.id}`} className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-black px-2 py-0.5 text-[13px] font-bold text-white">{s.screen}</span>
            <span className="text-[16px] font-semibold">{s.title}</span>
          </div>
          <div className="text-[12px] text-neutral-600">
            {screenById(s.screen).name} ·{' '}
            <a className="underline" href={`#screen-${s.screen}`}>
              main page p. {ctx.pageOf(`screen-${s.screen}`)}
            </a>
          </div>
          <div className="rounded-lg border border-neutral-300 bg-neutral-100 p-2">
            <StateView state={s} runtime={ctx.runtimes[s.id]} width={720} maxHeight={850} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- document ----------

function buildPages(): PageDef[] {
  const pages: PageDef[] = [];
  const add = (p: PageDef) => pages.push(p);

  add({ key: 'cover', ...sec(1), title: 'Cover', render: () => <Cover /> });
  add({ key: 'toc', ...sec(2), title: 'Contents', anchor: 'toc', render: (ctx) => <Toc pages={pages} ctx={ctx} /> });
  add({ key: 'scope', ...sec(3), title: 'Scope and design principles', anchor: 'sec-3', tocEntry: true, render: () => <Scope /> });
  const mapPage = (id: string, n: number) => {
    const map = JOURNEY_MAPS.find((m) => m.id === id)!;
    add({ key: `map-${id}`, ...sec(n), title: map.title, anchor: `map-${id}`, render: (ctx) => <MapPage map={map} ctx={ctx} /> });
  };
  mapPage('A', 4);
  mapPage('B', 5);

  const screenPagesFor = (n: number) =>
    SCREEN_PAGES.filter(([, , s]) => s === n).forEach(([screen, stateId], i, arr) => {
      const first = SCREEN_PAGES.findIndex(([sc]) => sc === screen) === SCREEN_PAGES.indexOf(arr[i]);
      add({
        key: `screen-${screen}-${stateId}`,
        ...sec(n),
        title: `${screen} ${screenById(screen).name}`,
        anchor: first ? `screen-${screen}` : `screen-${screen}-${stateId}`,
        render: (ctx) => <ScreenPage screen={screen} stateId={stateId} ctx={ctx} />,
      });
    });

  screenPagesFor(5);
  mapPage('C1', 6);
  mapPage('C2', 6);
  screenPagesFor(7);
  mapPage('D1', 8);
  mapPage('D2', 8);
  screenPagesFor(9);
  mapPage('E', 10);
  add({ key: 'manual-table', ...sec(10), title: 'Manual-review routes — detail', render: () => <ManualRoutes /> });
  mapPage('F', 11);
  screenPagesFor(11);

  const used = new Set(SCREEN_PAGES.map(([, id]) => id));
  const variants = GALLERY_STATES.filter((g) => !used.has(g.id));
  for (let i = 0; i < variants.length; i += 2) {
    const pair = variants.slice(i, i + 2);
    add({
      key: `variants-${i}`,
      ...sec(12),
      title: pair.map((p) => p.screen).join(' / '),
      anchor: i === 0 ? 'sec-12' : undefined,
      render: (ctx) => <VariantsPage states={pair} ctx={ctx} />,
    });
  }

  const tablePage = (key: string, title: string, body: ReactNode, anchor?: string) =>
    add({ key, ...sec(13), title, anchor, render: () => <div className="flex flex-col gap-6">{body}</div> });
  tablePage(
    'rules-1',
    'Routing, duplicates, validation, OTP',
    <>
      <RevenueTable />
      <DuplicateTable />
      <ValidationTable />
      <OtpTable />
    </>,
    'sec-13',
  );
  tablePage(
    'rules-2',
    'Categories and certificate mapping',
    <>
      <CategoryTable dense />
      <CertificateMappingTable />
    </>,
  );
  tablePage(
    'rules-3',
    'Government, Nafath, IBAN',
    <>
      <GovTable />
      <NafathTable />
      <IbanTable />
    </>,
  );
  tablePage(
    'rules-4',
    'Contract and statuses',
    <>
      <ContractTable />
      <StatusTable />
    </>,
  );
  tablePage('rules-5', 'Integration adapters', <IntegrationTable />);

  add({
    key: 'ux-1',
    ...sec(14),
    title: 'Global note and design decisions',
    anchor: 'ux-handover',
    render: () => (
      <div className="flex flex-col gap-6">
        <GlobalUxNote id="g-ux" />
        <UxDecisionsBlock dense />
      </div>
    ),
  });
  add({ key: 'ux-inventory', ...sec(14), title: 'Screen inventory', render: () => <ScreenInventoryTable dense /> });
  add({ key: 'ux-2', ...sec(14), title: 'Field behaviour', render: () => <FieldBehaviourTable /> });
  add({
    key: 'ux-3',
    ...sec(14),
    title: 'Required state designs',
    render: () => <RequiredStatesTable />,
  });
  add({
    key: 'qa',
    ...sec(15),
    title: 'Scenario coverage (QA)',
    anchor: 'sec-15',
    render: () => (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-neutral-700">
          Each scenario is loaded from Prototype Controls and walked through the real screens by the automated Playwright suite (see docs/QA_REPORT.md for the latest results).
        </p>
        <ScenarioTable dense />
      </div>
    ),
  });
  add({
    key: 'decisions-1',
    ...sec(16),
    title: 'Confirmed requirements',
    anchor: 'sec-16',
    render: () => <DecisionLogTable dense types={['Confirmed requirement']} />,
  });
  add({
    key: 'decisions-2',
    ...sec(16),
    title: 'Provisional assumptions and product decisions',
    render: () => <DecisionLogTable dense types={['Provisional assumption', 'Product decision needed']} />,
  });
  add({
    key: 'decisions-3',
    ...sec(16),
    title: 'UX/UI and engineering questions',
    render: () => <DecisionLogTable dense types={['UX/UI decision needed', 'Engineering integration question']} />,
  });
  return pages;
}

function Cover() {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="flex h-full flex-col justify-between py-16" style={{ paddingLeft: 60, paddingRight: 60 }}>
      <div>
        <div className="flex h-12 w-44 items-center justify-center border border-neutral-400 bg-neutral-100 text-[16px] font-bold tracking-[0.35em] text-neutral-700">MADFU</div>
        <h1 className="mt-16 text-[64px] font-semibold leading-[1.05] tracking-tight">
          Merchant Onboarding
          <br />
          Wireframe System
        </h1>
        <p className="mt-6 max-w-[900px] text-[22px] leading-relaxed text-neutral-700">
          Complete, annotated low-fidelity desktop wireframes, journey decision maps and business rules for Registered Business (CR) and Freelancer onboarding.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-8 border-t-2 border-black pt-6 text-[15px]">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">Version</div>
          <div className="mt-1">
            v{PROJECT_META.version} · {date}
          </div>
          <div className="text-neutral-600">Generated from the implemented prototype (single source of truth)</div>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">Interactive prototype</div>
          <a className="mt-1 block underline" href={PROJECT_META.siteUrl}>
            {PROJECT_META.siteUrl}
          </a>
          <a className="block underline" href={PROJECT_META.repoUrl}>
            {PROJECT_META.repoUrl}
          </a>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">Status</div>
          <div className="mt-1">
            Wireframe prototype — not a production application. Synthetic data only. All integrations simulated. Provisional items are listed in section 16.
          </div>
        </div>
      </div>
    </div>
  );
}

function Toc({ pages, ctx }: { pages: PageDef[]; ctx: RenderCtx }) {
  const firstOfSection = SECTIONS.map((name, i) => ({
    name,
    n: i + 1,
    page: pages.findIndex((p) => p.sectionNo === i + 1) + 1,
    anchor: pages.find((p) => p.sectionNo === i + 1 && p.anchor)?.anchor,
  }));
  const screenPages = SCREEN_PAGES.filter(([s], i) => SCREEN_PAGES.findIndex(([x]) => x === s) === i);
  return (
    <div className="grid h-full grid-cols-2 gap-12">
      <div>
        <h2 className="text-[30px] font-semibold">Contents</h2>
        <ol className="mt-6 flex flex-col">
          {firstOfSection.slice(2).map((s) => (
            <li key={s.n} className="flex items-baseline gap-3 border-b border-neutral-200 py-2.5 text-[16px]">
              <span className="w-8 font-semibold">{s.n}.</span>
              <a className="flex-1 underline-offset-2 hover:underline" href={`#${s.anchor ?? ''}`}>
                {s.name}
              </a>
              <span className="tabular-nums text-neutral-600">{s.page}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="text-[18px] font-semibold">Screen index</h3>
        <ol className="mt-4 grid grid-cols-1 text-[13.5px]">
          {screenPages.map(([s]) => (
            <li key={s} className="flex items-baseline gap-3 border-b border-neutral-200 py-1.5">
              <span className="w-14 font-bold">{s}</span>
              <a className="flex-1 hover:underline" href={`#screen-${s}`}>
                {screenById(s).name}
              </a>
              <span className="tabular-nums text-neutral-600">{ctx.pageOf(`screen-${s}`)}</span>
            </li>
          ))}
        </ol>
        <h3 className="mt-6 text-[18px] font-semibold">Journey maps</h3>
        <ol className="mt-2 text-[13.5px]">
          {JOURNEY_MAPS.map((m) => (
            <li key={m.id} className="flex items-baseline gap-3 border-b border-neutral-200 py-1.5">
              <a className="flex-1 hover:underline" href={`#map-${m.id}`}>
                {m.title}
              </a>
              <span className="tabular-nums text-neutral-600">{ctx.pageOf(`map-${m.id}`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Scope() {
  return (
    <div className="grid h-full grid-cols-[1.1fr_1fr] gap-12">
      <div className="flex flex-col gap-5 text-[14.5px] leading-relaxed">
        <h2 className="text-[26px] font-semibold">Scope and design principles</h2>
        <div>
          <h3 className="font-semibold">Purpose</h3>
          <p>
            Show Product, Engineering, UX/UI, Risk, Compliance and Sales exactly how a merchant moves through onboarding — every branch, decision and fallback — as a working
            journey rather than disconnected screens.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">In scope</h3>
          <ul className="list-disc pl-5">
            <li>Shared entry, duplicate detection, OTP, revenue routing, category screening.</li>
            <li>Registered Business: government CR lookup, authorized-person selection, Nafath (2 shared attempts).</li>
            <li>Freelancer: Nafath on the entry National ID, certificate retrieval, selection, reconciliation, manual entry.</li>
            <li>Shared business details with IBAN ownership verification, contract eligibility, simulated acceptance, three neutral outcomes.</li>
            <li>Resume, refresh-safe persistence, invalidation of dependent verifications.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Out of scope</h3>
          <p>
            Merchant activation and post-onboarding journeys; sign-in to existing accounts; the add-certificate flow (marked FUTURE); real integrations, real contract text and
            legally binding signatures.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Design principles</h3>
          <ul className="list-disc pl-5">
            <li>Desktop-first (1440 px), black and white, low fidelity, English only, no marketing imagery.</li>
            <li>Consistent structure: header, progress, single-column form, Back bottom-left, primary action bottom-right.</li>
            <li>Avoid unnecessary third-party cost: category screening happens before CR lookup and Nafath.</li>
            <li>Internal statuses are separate from applicant-facing messages.</li>
            <li>Every screen page shows: screen ID, wireframe, entry condition, next and alternative destinations, backend behaviour, business rules.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">How this PDF was produced</h3>
          <p>
            Rendered by Playwright from the prototype’s own print route: the wireframes are the live React screens driven into each state by the journey engine; tables are
            generated from the rule configuration. Screen IDs match the prototype and gallery.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <div className="rounded-md border-[3px] border-black p-6">
          <div className="text-[12px] font-bold uppercase tracking-[0.2em]">G-UX · Global UX/UI handover note</div>
          <p className="mt-3 text-[17px] font-semibold leading-relaxed">{GLOBAL_UX_NOTE}</p>
          <p className="mt-3 text-[12.5px] text-neutral-600">
            Referenced from every screen annotation. Full handover in{' '}
            <a className="underline" href="#ux-handover">
              section 14
            </a>
            .
          </p>
        </div>
        <div className="rounded-md border border-neutral-300 p-5 text-[13.5px] leading-relaxed">
          <h3 className="font-semibold">Applicant journeys at a glance</h3>
          <Table
            dense
            head={['', 'Registered Business', 'Freelancer']}
            rows={[
              ['Identification at entry', 'CR number', 'National ID'],
              ['Revenue routing', 'Only SAR 100K–20M self-onboards', 'All bands self-onboard'],
              ['Government data', 'CR lookup + related parties', 'Certificates (after Nafath)'],
              ['Nafath subject', 'Selected authorized individual', 'Entry National ID'],
              ['IBAN ownership match', 'Registered business', 'Individual National ID'],
              ['Without Nafath', 'Details → manual verification', 'Manual certificate → details → manual verification'],
            ]}
          />
        </div>
        <div className="rounded-md border border-neutral-300 p-5 text-[13px]">
          <h3 className="font-semibold">Screen count</h3>
          <p>
            {SCREENS.length} screens ({SCREENS.filter((s) => s.kind === 'screen').length} journey screens, {SCREENS.filter((s) => s.kind === 'outcome').length} outcomes, 1
            future-flow placeholder) · {GALLERY_STATES.length} documented states · {JOURNEY_MAPS.length} journey maps.
          </p>
        </div>
      </div>
    </div>
  );
}

function ManualRoutes() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[24px] font-semibold">Manual-review routes — detail</h2>
      <Table
        head={['Route', 'Trigger', 'Paid calls already made', 'Contract', 'Applicant outcome', 'Internal flags / status']}
        rows={[
          ['Revenue lead (CR)', 'Revenue below SAR 100K or above SAR 20M', 'None', '—', 'O-C', 'SALES_LEAD_REVENUE · SALES_LEAD'],
          ['Restricted category', 'Fixture BLOCKED subcategory', 'None', '—', 'O-C', 'CATEGORY_RESTRICTED · SALES_LEAD'],
          ['Category review', 'MANUAL_REVIEW subcategory (config: stop)', 'None', '—', 'O-C', 'CATEGORY_REVIEW_REQUIRED · SALES_LEAD'],
          ['Restricted certificate', 'Certificate activity maps to BLOCKED', 'Nafath + certificate lookup (recorded)', '—', 'O-C', 'CATEGORY_RESTRICTED_POST_NAFATH'],
          ['No eligible individual (CR)', 'CR lists only companies / entities', 'CR lookup', 'Disabled', 'O-B', 'NO_ELIGIBLE_AUTHORISED_PERSON · NAFATH_MANUAL_VERIFICATION'],
          ['Nafath exhausted (CR)', '2 unsuccessful attempts (any persons)', 'CR lookup + 2 Nafath', 'Disabled', 'O-B', 'NAFATH_MANUAL_VERIFICATION · IBAN not checked (config)'],
          [
            'Nafath exhausted (Freelancer)',
            '2 unsuccessful attempts',
            '2 Nafath',
            'Disabled',
            'O-B',
            'NAFATH_MANUAL_VERIFICATION · CERT_MANUAL_ENTRY_UNVERIFIED · IBAN_NOT_CHECKED',
          ],
          ['No certificate (verified freelancer)', 'Certificate lookup returns none', 'Nafath + lookup', 'Disabled (provisional)', 'O-B', 'CERT_NOT_FOUND_MANUAL_ENTRY'],
          ['Expired / inconsistent certificate', 'Certificate status / holder mismatch', 'Nafath + lookup', 'Disabled (provisional)', 'O-B', 'CERT_EXPIRED / CERT_INCONSISTENT'],
          ['IBAN failed twice', '2 not-verified ownership results', '+ 2 IBAN checks', 'Allowed', 'O-A', 'IBAN_UNVERIFIED_MANUAL_FINANCIAL_REVIEW'],
          ['IBAN provider outage', '3 technical errors', '+ IBAN calls', 'Allowed (policy pending)', 'O-A', 'IBAN_VERIFICATION_PENDING_PROVIDER'],
          ['CR expired', 'CR lookup EXPIRED', 'CR lookup', 'Allowed', 'O-A', 'CR_EXPIRED'],
          ['CR-only category (freelancer)', 'Freelancer picks CR-only subcategory', '—', 'Allowed', 'O-A', 'CR_ONLY_CATEGORY_FREELANCER'],
          ['Category mismatch', 'Certificate maps to a different / no subcategory', 'Nafath + lookup', 'Allowed', 'O-A', 'CATEGORY_MISMATCH'],
          ['Contract declined', 'Applicant declines on S09', 'All', 'Pending', 'S09-D (not submitted)', 'CONTRACT_DECLINED · CONTRACT_PENDING'],
        ]}
      />
    </div>
  );
}

export function PrintPage() {
  const pages = useMemo(buildPages, []);
  const [runtimes, setRuntimes] = useState<Record<string, JourneyRuntime>>();
  const mapsRendered = useRef(0);
  const [mapsDone, setMapsDone] = useState(false);
  const mapCount = pages.filter((p) => p.key.startsWith('map-')).length * 2; // diagram + legend

  useEffect(() => {
    document.title = PROJECT_META.title;
    Promise.all(GALLERY_STATES.map(async (g) => [g.id, await g.build()] as const)).then((built) => {
      const r: Record<string, JourneyRuntime> = {};
      for (const [id, { app, sim }] of built) r[id] = createSandboxRuntime(app, sim, true);
      setRuntimes(r);
    });
  }, []);

  useEffect(() => {
    if (!runtimes || !mapsDone) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      for (let i = 0; i < 30 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const pending = document.querySelectorAll('[data-fit-ready="0"]').length;
        if (pending === 0) break;
      }
      if (!cancelled) {
        window.__PRINT_READY__ = true;
        document.body.dataset.printReady = '1';
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runtimes, mapsDone]);

  const anchorPage = useMemo(() => {
    const m = new Map<string, number>();
    pages.forEach((p, i) => p.anchor && m.set(p.anchor, i + 1));
    const used = new Set(SCREEN_PAGES.map(([, id]) => id));
    const variants = GALLERY_STATES.filter((g) => !used.has(g.id));
    const firstVariantPage = pages.findIndex((p) => p.key === 'variants-0') + 1;
    variants.forEach((v, i) => m.set(`state-${v.id}`, firstVariantPage + Math.floor(i / 2)));
    return m;
  }, [pages]);

  if (!runtimes) return <div className="p-10 text-[14px]">Building {GALLERY_STATES.length} screen states…</div>;

  const ctx: RenderCtx = {
    runtimes,
    pageOf: (a) => anchorPage.get(a),
    onMapRendered: () => {
      mapsRendered.current += 1;
      if (mapsRendered.current >= mapCount) setMapsDone(true);
    },
  };
  return (
    <div className="bg-neutral-300 print:bg-white" data-testid="print-document">
      <style>{`@page { size: A3 landscape; margin: 0; } body { background: white; margin: 0; } @media print { body > :not(#root) { display: none !important; } }`}</style>
      {pages.map((p, i) => (
        <Page key={p.key} page={p} n={i + 1} total={pages.length}>
          {p.render(ctx)}
        </Page>
      ))}
    </div>
  );
}
