/**
 * React Flow node + edge renderers for the Master Board.
 * Screen nodes render the REAL screen components (sandboxed, static) at
 * desktop width, scaled into the card — the same source as the prototype.
 */
import { Fragment, createContext, memo, useContext, type CSSProperties, type ReactNode } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getSmoothStepPath, type EdgeProps, type NodeProps } from '@xyflow/react';
import { JourneyProvider, useJourney, type JourneyRuntime } from '../state/JourneyContext';
import { HostNavContext, MerchantFrame } from '../components/MerchantFrame';
import { FitBox } from '../components/Annotation';
import { CurrentScreen } from '../screens';
import { S00Resume } from '../screens/EntryScreens';
import type { ScreenId } from '../state/types';
import { DECISIONS } from '../rules/decisionLog';
import type { BoardNodeDef, HandleId, LaneDef } from './types';
import { SIZE } from './model';

// ---------- shared context ----------

export interface BoardUiState {
  runtimes: Record<string, JourneyRuntime>;
  compact: boolean;
  highlighted?: Set<string>;
  currentStep?: string;
  journeyStart?: string;
  journeyEnd?: string;
  onPreview?: (nodeId: string) => void;
}
export const BoardUiContext = createContext<BoardUiState>({ runtimes: {}, compact: false });

const HANDLE_POS: Record<HandleId, { position: Position; style: CSSProperties }> = {
  t: { position: Position.Top, style: { left: '50%' } },
  tl: { position: Position.Top, style: { left: '30%' } },
  tr: { position: Position.Top, style: { left: '70%' } },
  b: { position: Position.Bottom, style: { left: '50%' } },
  bl: { position: Position.Bottom, style: { left: '30%' } },
  br: { position: Position.Bottom, style: { left: '70%' } },
  l: { position: Position.Left, style: { top: '50%' } },
  r: { position: Position.Right, style: { top: '50%' } },
};

function Handles() {
  return (
    <>
      {(Object.keys(HANDLE_POS) as HandleId[]).map((h) => (
        <Fragment key={h}>
          <Handle
            id={h}
            type="source"
            position={HANDLE_POS[h].position}
            style={{ ...HANDLE_POS[h].style, opacity: 0, width: 4, height: 4, minWidth: 0, minHeight: 0, border: 0 }}
            isConnectable={false}
          />
          <Handle
            id={h}
            type="target"
            position={HANDLE_POS[h].position}
            style={{ ...HANDLE_POS[h].style, opacity: 0, width: 4, height: 4, minWidth: 0, minHeight: 0, border: 0 }}
            isConnectable={false}
          />
        </Fragment>
      ))}
    </>
  );
}

function useNodeEmphasis(id: string) {
  const ui = useContext(BoardUiContext);
  const dim = ui.highlighted ? !ui.highlighted.has(id) : false;
  const current = ui.currentStep === id;
  const marker = ui.journeyStart === id ? 'JOURNEY START' : ui.journeyEnd === id ? 'JOURNEY END' : undefined;
  return { dim, current, marker, ui };
}

function Badge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'outline' | 'dashed' }) {
  return (
    <span
      className={`absolute -top-[30px] left-0 whitespace-nowrap rounded px-2 py-1 text-[12px] font-bold tracking-wider ${
        tone === 'dark'
          ? 'bg-black text-white'
          : tone === 'dashed'
            ? 'border-2 border-dashed border-neutral-600 bg-white text-neutral-700'
            : 'border-2 border-black bg-white text-black'
      }`}
    >
      {children}
    </span>
  );
}

function JourneyMarker({ marker }: { marker?: string }) {
  if (!marker) return null;
  return <span className="absolute -top-[30px] right-0 whitespace-nowrap rounded bg-[#d4380d] px-2 py-1 text-[12px] font-bold tracking-wider text-white">{marker}</span>;
}

// ---------- screen miniature ----------

function SandboxScreen() {
  const { app } = useJourney();
  return <CurrentScreen screen={app.screen as Exclude<ScreenId, 'S00'>} />;
}

const noop = () => {};
export const MiniWireframe = memo(function MiniWireframe({
  runtime,
  screenId,
  width,
  maxHeight,
}: {
  runtime?: JourneyRuntime;
  screenId: ScreenId;
  width: number;
  maxHeight: number;
}) {
  if (!runtime) return <div className="flex h-full items-center justify-center text-[12px] text-neutral-400">Rendering wireframe…</div>;
  return (
    <FitBox width={width} maxHeight={maxHeight}>
      <JourneyProvider runtime={runtime}>
        <HostNavContext.Provider value={{ sandbox: true, exitToOverview: noop, restart: noop }}>
          {screenId === 'S00' ? (
            <MerchantFrame screen="S00">
              <S00Resume onContinue={noop} onStartNew={noop} />
            </MerchantFrame>
          ) : (
            <SandboxScreen />
          )}
        </HostNavContext.Provider>
      </JourneyProvider>
    </FitBox>
  );
});

export function ScreenNode({ id, data }: NodeProps) {
  const def = data.def as BoardNodeDef;
  const { dim, current, marker, ui } = useNodeEmphasis(id);
  const isOutcome = def.kind === 'outcome';
  const isFuture = def.kind === 'future';
  const appTag = def.applicant === 'Both' ? 'Both' : def.applicant === 'CR' ? 'Business' : 'Freelancer';
  return (
    <div
      data-testid={`board-node-${id}`}
      data-kind={def.kind}
      className={`relative flex h-full w-full flex-col rounded-lg bg-white transition-opacity ${dim ? 'opacity-[0.16]' : ''} ${
        isOutcome ? 'border-[3px] border-black' : isFuture ? 'border-2 border-dashed border-neutral-500' : 'border-[1.5px] border-neutral-800'
      } ${current ? 'shadow-[0_0_0_6px_rgba(212,56,13,0.85)]' : 'shadow-sm'}`}
      style={{ width: SIZE.screen.w, height: SIZE.screen.h }}
    >
      {def.badge && <Badge tone={isOutcome ? 'dark' : isFuture ? 'dashed' : 'outline'}>{def.badge}</Badge>}
      <JourneyMarker marker={marker} />
      <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-neutral-300 px-2.5">
        <span className={`rounded px-1.5 py-0.5 text-[12px] font-bold ${isOutcome ? 'bg-black text-white' : 'bg-neutral-900 text-white'}`}>{def.screenId}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={def.title}>
          {def.title.replace(/^\S+\s/, '')}
        </span>
        <span className="shrink-0 rounded border border-neutral-400 px-1.5 text-[10.5px] text-neutral-600">{appTag}</span>
        {ui.onPreview && (
          <button
            type="button"
            title="Open full wireframe preview"
            data-testid={`board-preview-${id}`}
            className="nodrag shrink-0 rounded border border-neutral-500 px-1.5 text-[11px] hover:bg-neutral-100"
            onClick={(e) => {
              e.stopPropagation();
              ui.onPreview?.(id);
            }}
          >
            ⤢
          </button>
        )}
      </div>
      <div className="pointer-events-none flex flex-1 items-center justify-center overflow-hidden bg-neutral-100 p-1.5" data-testid={`board-mini-${id}`}>
        {ui.compact ? (
          <span className="text-[12px] text-neutral-500">Wireframe hidden (compact view)</span>
        ) : (
          <MiniWireframe runtime={def.stateId ? ui.runtimes[def.stateId] : undefined} screenId={def.screenId!} width={SIZE.screen.w - 16} maxHeight={SIZE.screen.h - 52} />
        )}
      </div>
      <Handles />
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  decision: 'DECISION',
  process: 'BACKEND',
  external: 'INTEGRATION',
  manual: 'MANUAL REVIEW',
  connector: 'CONNECTOR',
};

export function SmallNode({ id, data }: NodeProps) {
  const def = data.def as BoardNodeDef;
  const { dim, current, marker } = useNodeEmphasis(id);
  const k = def.kind;
  const base =
    k === 'decision'
      ? 'border-[1.5px] border-black bg-white'
      : k === 'process'
        ? 'border border-neutral-500 bg-neutral-200 rounded-xl'
        : k === 'external'
          ? 'border-[3px] border-double border-black bg-neutral-100'
          : k === 'manual'
            ? 'border-2 border-dashed border-neutral-700 bg-[#fafafa]'
            : 'border border-dotted border-neutral-600 bg-white rounded-full';
  const size = k === 'connector' ? SIZE.connector : SIZE.small;
  return (
    <div
      data-testid={`board-node-${id}`}
      data-kind={k}
      className={`relative flex items-center gap-2.5 rounded-md px-3 transition-opacity ${base} ${dim ? 'opacity-[0.16]' : ''} ${current ? 'shadow-[0_0_0_6px_rgba(212,56,13,0.85)]' : ''}`}
      style={{ width: size.w, height: size.h }}
    >
      <JourneyMarker marker={marker} />
      {k === 'decision' && <span aria-hidden className="h-5 w-5 shrink-0 rotate-45 border-2 border-black bg-white" />}
      {k === 'external' && (
        <span aria-hidden className="shrink-0 text-[15px]">
          ⇄
        </span>
      )}
      {k === 'process' && (
        <span aria-hidden className="shrink-0 text-[14px]">
          ⚙
        </span>
      )}
      {k === 'manual' && (
        <span aria-hidden className="shrink-0 text-[14px]">
          ✎
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        {k !== 'connector' && <span className="text-[9.5px] font-bold tracking-[0.12em] text-neutral-500">{KIND_LABEL[k]}</span>}
        <span className={`font-semibold text-black ${k === 'connector' ? 'text-[12px]' : 'text-[13px]'}`}>{def.title}</span>
        {def.subtitle && <span className="text-[11px] text-neutral-600">{def.subtitle}</span>}
      </div>
      <Handles />
    </div>
  );
}

export function LaneNode({ data }: NodeProps) {
  const lane = data.lane as LaneDef;
  const collapsed = data.collapsed as boolean;
  const width = data.width as number;
  return (
    <div
      data-testid={`board-lane-${lane.id}`}
      className={`rounded-xl border ${lane.id === 'manual' ? 'border-dashed border-neutral-400 bg-[#f7f7f7]' : lane.id === 'outcome' ? 'border-neutral-400 bg-[#f1f1f1]' : 'border-neutral-300 bg-[#fbfbfb]'}`}
      style={{ width, height: lane.height }}
    >
      <div className="sticky left-0 flex flex-col px-5 pt-3">
        <span className="text-[22px] font-bold tracking-tight text-black">{lane.title}</span>
        <span className="text-[13px] text-neutral-600">{lane.subtitle}</span>
        {collapsed && <span className="mt-2 w-fit rounded border border-neutral-500 bg-white px-2 py-1 text-[12px]">Sub-flow collapsed — expand it from the toolbar</span>}
      </div>
    </div>
  );
}

const LEGEND: { label: string; el: ReactNode }[] = [
  { label: 'User-facing screen (live wireframe)', el: <span className="block h-7 w-10 rounded border-[1.5px] border-neutral-800 bg-white" /> },
  { label: 'Business decision', el: <span className="block h-4 w-4 rotate-45 border-2 border-black" /> },
  { label: 'Backend operation', el: <span className="block h-6 w-10 rounded-lg border border-neutral-500 bg-neutral-200" /> },
  { label: 'External integration (paid / simulated)', el: <span className="block h-6 w-10 rounded border-[3px] border-double border-black bg-neutral-100" /> },
  { label: 'Manual review / flag', el: <span className="block h-6 w-10 rounded border-2 border-dashed border-neutral-700" /> },
  { label: 'Final outcome', el: <span className="block h-7 w-10 rounded border-[3px] border-black bg-white" /> },
  { label: 'Future scope', el: <span className="block h-7 w-10 rounded border-2 border-dashed border-neutral-500" /> },
  { label: 'Connector (jump)', el: <span className="block h-5 w-10 rounded-full border border-dotted border-neutral-600" /> },
  { label: 'Transition', el: <span className="block h-0 w-10 border-t-2 border-neutral-800" /> },
  { label: 'Retry loop', el: <span className="block h-0 w-10 border-t-2 border-dashed border-neutral-800" /> },
  { label: 'Permitted step back', el: <span className="block h-0 w-10 border-t-2 border-dotted border-neutral-800" /> },
];

export function HeaderNode({ data }: NodeProps) {
  const stats = data.stats as { label: string; value: number | string }[];
  return (
    <div
      className="flex h-full w-full gap-10 rounded-xl border-2 border-black bg-white p-6"
      data-testid="board-header"
      style={{ width: data.width as number, height: data.height as number }}
    >
      <div className="flex w-[880px] shrink-0 flex-col justify-between">
        <div>
          <div className="text-[13px] font-bold tracking-[0.25em] text-neutral-500">MADFU · MERCHANT ONBOARDING</div>
          <div className="mt-1 text-[44px] font-bold leading-tight tracking-tight">Unified Onboarding Master Flow Board</div>
          <div className="mt-2 max-w-[860px] text-[16px] leading-snug text-neutral-700">
            Every screen, decision, branch, retry and outcome of the implemented onboarding — left to right. Screens are the live prototype components; journeys are derived by
            running the real journey engine. Synthetic data only.
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-[13px]">
          {stats.map((s) => (
            <span key={s.label} className="rounded border border-neutral-400 px-2.5 py-1">
              <strong>{s.value}</strong> {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 content-start gap-x-8 gap-y-3 border-l border-neutral-300 pl-8">
        <div className="col-span-3 text-[13px] font-bold tracking-[0.2em] text-neutral-500">LEGEND</div>
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-3 text-[13.5px]">
            <span className="flex w-12 shrink-0 items-center justify-center">{l.el}</span>
            {l.label}
          </div>
        ))}
        <div className="col-span-3 mt-2 text-[13px] text-neutral-600">
          How to read: start at <strong>S01</strong> (new applicant) or <strong>S00</strong> (returning). The flow splits after the category decision into Path A (Registered
          Business) and Path B (Freelancer). Applications leaving self-onboarding drop into the manual-review lane; every route ends in an outcome.
        </div>
      </div>
    </div>
  );
}

export function AssumptionsNode({ data }: NodeProps) {
  const items = DECISIONS.filter((d) => d.type !== 'Confirmed requirement');
  return (
    <div
      className="h-full w-full rounded-xl border-2 border-dashed border-neutral-600 bg-white p-5"
      data-testid="board-assumptions"
      style={{ width: data.width as number, height: data.height as number }}
    >
      <div className="text-[13px] font-bold tracking-[0.2em] text-neutral-500">ASSUMPTIONS & OPEN DECISIONS — not confirmed business rules</div>
      <ul className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1.5 text-[12.5px] leading-snug">
        {items.map((d) => (
          <li key={d.id}>
            <strong>{d.id}</strong> {d.topic} — <span className="text-neutral-600">{d.prototypeBehaviour ?? d.statement}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- edges ----------

function roundedPath(points: [number, number][], r = 14) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0);
    const d2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const ax = x1 - ((x1 - x0) / (d1 || 1)) * rr;
    const ay = y1 - ((y1 - y0) / (d1 || 1)) * rr;
    const bx = x1 + ((x2 - x1) / (d2 || 1)) * rr;
    const by = y1 + ((y2 - y1) / (d2 || 1)) * rr;
    d += ` L ${ax} ${ay} Q ${x1} ${y1} ${bx} ${by}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

function longestSegmentMid(points: [number, number][]): [number, number] {
  let best = 0;
  let mid: [number, number] = points[0];
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (len > best) {
      best = len;
      mid = [(points[i][0] + points[i - 1][0]) / 2, (points[i][1] + points[i - 1][1]) / 2];
    }
  }
  return mid;
}

export function BoardEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
  const d = data as { via?: [number, number][]; label?: string; labelAt?: [number, number]; kind: string; state: 'normal' | 'on' | 'dim' };
  let path: string;
  let lx: number;
  let ly: number;
  if (d.via?.length) {
    const pts: [number, number][] = [[sourceX, sourceY], ...d.via, [targetX, targetY]];
    path = roundedPath(pts);
    [lx, ly] = d.labelAt ?? longestSegmentMid(pts);
  } else {
    const [p, x, y] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14 });
    path = p;
    [lx, ly] = d.labelAt ?? [x, y];
  }
  const on = d.state === 'on';
  const dim = d.state === 'dim';
  const stroke = on ? '#d4380d' : '#2b2b2b';
  const dash = d.kind === 'loop' ? '7 5' : d.kind === 'back' ? '2 5' : undefined;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: on ? 3.5 : 1.6, strokeDasharray: dash, opacity: dim ? 0.12 : 1 }} />
      {d.label && (
        <EdgeLabelRenderer>
          <div
            data-testid={`board-edge-label-${id}`}
            className={`pointer-events-none absolute rounded ${d.kind === 'loop' ? 'max-w-[170px]' : 'max-w-[230px]'} px-1.5 py-0.5 text-center text-[11.5px] leading-tight ${on ? 'border border-[#d4380d] bg-white font-semibold text-[#a12b08]' : 'bg-white/95 text-neutral-800'} ${dim ? 'opacity-20' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            {d.kind === 'loop' ? '↻ ' : d.kind === 'back' ? '↩ ' : ''}
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
