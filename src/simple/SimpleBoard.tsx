/**
 * Simplified Master Board — screens + arrows only (presentation view).
 * Wireframes are the live screen components (same source as the prototype
 * and the Detailed Workflow), rendered without prototype-only dev tools.
 */
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GALLERY_STATES } from '../journeys/galleryStates';
import { createSandboxRuntime, type JourneyRuntime } from '../state/JourneyContext';
import { MiniWireframe } from '../board/BoardNodes';
import { PresentationContext } from '../components/wf';
import { CARD_MID, CARD_TOP, SCREEN_H, SCREEN_W, SIMPLE_EDGES, SIMPLE_JOURNEYS, SIMPLE_LANES, SIMPLE_NODES, SIMPLE_X1, journeyEdges, simpleNode, type SimpleNode } from './model';

export const SIMPLE_PDF = 'Madfu_Onboarding_Simplified_Master_Board.pdf';
export const SIMPLE_SVG = 'Madfu_Onboarding_Simplified_Master_Board.svg';

const HEADER = { x: -100, y: -300, w: 2600, h: 240 };
export const SIMPLE_BOUNDS = { x: -160, y: HEADER.y - 60, w: SIMPLE_X1 + 220, h: SIMPLE_LANES[3].y + SIMPLE_LANES[3].height - HEADER.y + 120 };
const ACCENT = '#d4380d';

interface Ui {
  runtimes: Record<string, JourneyRuntime>;
  highlighted?: Set<string>;
  onEnlarge?: (id: string) => void;
}
const UiCtx = createContext<Ui>({ runtimes: {} });

// ---------- runtimes ----------

function useRuntimes() {
  const [runtimes, setRuntimes] = useState<Record<string, JourneyRuntime>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(SIMPLE_NODES.map((n) => n.stateId))];
    Promise.all(
      ids.map(async (id) => {
        const { app, sim } = await GALLERY_STATES.find((g) => g.id === id)!.build();
        return [id, createSandboxRuntime(app, sim, true)] as const;
      }),
    ).then((pairs) => {
      if (!alive) return;
      setRuntimes(Object.fromEntries(pairs));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { runtimes, ready };
}

// ---------- nodes ----------

const HANDLES: [string, Position, CSSProperties][] = [
  ['t', Position.Top, { left: '50%', top: CARD_TOP }],
  ['tl', Position.Top, { left: '30%', top: CARD_TOP }],
  ['tr', Position.Top, { left: '70%', top: CARD_TOP }],
  ['b', Position.Bottom, { left: '50%' }],
  ['bl', Position.Bottom, { left: '30%' }],
  ['l', Position.Left, { top: CARD_MID }],
  ['r', Position.Right, { top: CARD_MID }],
];
const hidden: CSSProperties = { opacity: 0, width: 4, height: 4, minWidth: 0, minHeight: 0, border: 0 };

function ScreenCard({ id, data }: NodeProps) {
  const n = data.node as SimpleNode;
  const ui = useContext(UiCtx);
  const dim = ui.highlighted ? !ui.highlighted.has(id) : false;
  const on = ui.highlighted?.has(id);
  const outcome = n.lane === 'outcome';
  return (
    <div data-testid={`simple-node-${id}`} className={`flex flex-col transition-opacity ${dim ? 'opacity-20' : ''}`} style={{ width: SCREEN_W, height: SCREEN_H }}>
      <div className="flex h-[40px] items-end justify-between pb-2">
        <span data-role="title" className={`text-[21px] font-semibold tracking-tight ${on ? 'text-[#a12b08]' : 'text-black'}`}>
          {n.title}
        </span>
        <span className="text-[12px] text-neutral-400">{n.tag ?? n.screenId}</span>
      </div>
      <button
        type="button"
        data-testid={`simple-open-${id}`}
        title="Click to enlarge"
        className={`nodrag group relative flex flex-1 cursor-zoom-in items-center justify-center overflow-hidden rounded-md bg-white ${
          on ? 'border-2 border-[#d4380d]' : outcome ? 'border-2 border-neutral-500' : 'border border-neutral-300'
        } shadow-sm`}
        onClick={() => ui.onEnlarge?.(id)}
      >
        <div className="pointer-events-none" data-testid={`simple-mini-${id}`}>
          <PresentationContext.Provider value={true}>
            <MiniWireframe runtime={ui.runtimes[n.stateId]} screenId={n.screenId} width={SCREEN_W - 16} maxHeight={SCREEN_H - 56} />
          </PresentationContext.Provider>
        </div>
        {ui.onEnlarge && <span className="absolute bottom-2 right-2 hidden rounded bg-black px-2 py-0.5 text-[11px] text-white group-hover:block">Enlarge</span>}
      </button>
      {HANDLES.map(([h, pos, style]) => (
        <Fragment key={h}>
          <Handle id={h} type="source" position={pos} style={{ ...style, ...hidden }} isConnectable={false} />
          <Handle id={h} type="target" position={pos} style={{ ...style, ...hidden }} isConnectable={false} />
        </Fragment>
      ))}
    </div>
  );
}

function LaneBand({ data }: NodeProps) {
  return (
    <div
      className="rounded-2xl border border-neutral-200 bg-[#fafafa]"
      style={{ width: data.width as number, height: data.height as number }}
      data-testid={`simple-lane-${data.id as string}`}
    >
      <div className="px-6 pt-4 text-[26px] font-bold tracking-tight text-neutral-800">{data.title as string}</div>
    </div>
  );
}

function Header() {
  return (
    <div
      className="flex h-full w-full flex-col justify-center rounded-2xl border-2 border-black bg-white px-10"
      style={{ width: HEADER.w, height: HEADER.h }}
      data-testid="simple-header"
    >
      <div className="text-[15px] font-bold tracking-[0.25em] text-neutral-500">MADFU · MERCHANT ONBOARDING</div>
      <div className="mt-1 text-[52px] font-bold leading-tight tracking-tight">Simplified Master Board</div>
      <div className="mt-2 text-[20px] text-neutral-700">Read left to right. Each card is the real onboarding screen; arrows show where applicants go next.</div>
    </div>
  );
}

const nodeTypes = { screen: ScreenCard, lane: LaneBand, header: Header };

// ---------- edges ----------

function rounded(points: [number, number][], r = 18) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0) || 1;
    const d2 = Math.hypot(x2 - x1, y2 - y1) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    d += ` L ${x1 - ((x1 - x0) / d1) * rr} ${y1 - ((y1 - y0) / d1) * rr} Q ${x1} ${y1} ${x1 + ((x2 - x1) / d2) * rr} ${y1 + ((y2 - y1) / d2) * rr}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

function Arrow({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const d = data as { via?: [number, number][]; label?: string; labelAt?: [number, number]; state: 'normal' | 'on' | 'dim' };
  let path: string;
  let lx: number;
  let ly: number;
  if (d.via?.length) {
    const pts: [number, number][] = [[sourceX, sourceY], ...d.via, [targetX, targetY]];
    path = rounded(pts);
    let best = 0;
    [lx, ly] = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len > best) {
        best = len;
        [lx, ly] = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
      }
    }
  } else {
    const [p, x, y] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 18 });
    path = p;
    [lx, ly] = [x, y];
  }
  if (d.labelAt) [lx, ly] = d.labelAt;
  const on = d.state === 'on';
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: on ? ACCENT : '#333', strokeWidth: on ? 4 : 2.2, opacity: d.state === 'dim' ? 0.12 : 1 }} />
      {d.label && (
        <EdgeLabelRenderer>
          <div
            data-testid={`simple-label-${id}`}
            className={`pointer-events-none absolute whitespace-nowrap rounded-full px-3 py-1 text-[15px] font-semibold ${on ? 'bg-[#d4380d] text-white' : 'border border-neutral-300 bg-white text-neutral-800'} ${d.state === 'dim' ? 'opacity-20' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const edgeTypes = { arrow: Arrow };

// ---------- elements ----------

function useElements(journeyId?: string) {
  return useMemo(() => {
    const width = SIMPLE_X1 + 60;
    const nodes: Node[] = [
      ...SIMPLE_LANES.map((l) => ({
        id: `lane.${l.id}`,
        type: 'lane',
        position: { x: -100, y: l.y },
        data: { id: l.id, title: l.title, width, height: l.height },
        draggable: false,
        selectable: false,
        zIndex: -10,
        style: { width, height: l.height },
      })),
      { id: 'header', type: 'header', position: { x: HEADER.x, y: HEADER.y }, data: {}, draggable: false, selectable: false, style: { width: HEADER.w, height: HEADER.h } },
      ...SIMPLE_NODES.map(
        (n) =>
          ({
            id: n.id,
            type: 'screen',
            position: { x: n.x, y: n.y },
            data: { node: n },
            draggable: false,
            style: { width: SCREEN_W, height: SCREEN_H },
            width: SCREEN_W,
            height: SCREEN_H,
          }) as Node,
      ),
    ];
    const journey = SIMPLE_JOURNEYS.find((j) => j.id === journeyId);
    const on = journey ? new Set(journeyEdges(journey)) : undefined;
    const edges: Edge[] = SIMPLE_EDGES.map((e) => {
      const state = on ? (on.has(e.id) ? 'on' : 'dim') : 'normal';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sh ?? 'r',
        targetHandle: e.th ?? 'l',
        type: 'arrow',
        selectable: false,
        zIndex: state === 'on' ? 5 : 1,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: state === 'on' ? ACCENT : '#333' },
        data: { via: e.via, label: e.label, labelAt: e.labelAt, state },
      };
    });
    return { nodes, edges, highlighted: journey ? new Set(journey.nodes) : undefined };
  }, [journeyId]);
}

// ---------- enlarge ----------

function Enlarge({ id, runtimes, onClose }: { id: string; runtimes: Record<string, JourneyRuntime>; onClose: () => void }) {
  const n = simpleNode(id);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6"
      role="dialog"
      aria-label={`${n.title} wireframe`}
      data-testid="simple-enlarged"
      onClick={onClose}
    >
      <div className="flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <span className="text-[20px] font-semibold">{n.title}</span>
          <button className="rounded border border-neutral-500 px-3 py-1 text-[13px]" onClick={onClose} data-testid="simple-close">
            Close (Esc)
          </button>
        </div>
        <div className="flex flex-1 justify-center overflow-y-auto bg-neutral-100 p-5">
          <PresentationContext.Provider value={true}>
            <MiniWireframe runtime={runtimes[n.stateId]} screenId={n.screenId} width={1200} maxHeight={4000} />
          </PresentationContext.Provider>
        </div>
      </div>
    </div>
  );
}

// ---------- page ----------

function Board() {
  const rf = useReactFlow();
  const { runtimes, ready } = useRuntimes();
  const [journey, setJourney] = useState('');
  const [enlarged, setEnlarged] = useState<string>();
  const { nodes, edges, highlighted } = useElements(journey);
  const fitAll = useCallback(() => void rf.fitView({ padding: 0.02, duration: 400 }), [rf]);
  const ui = useMemo(() => ({ runtimes, highlighted, onEnlarge: setEnlarged }), [runtimes, highlighted]);
  return (
    <UiCtx.Provider value={ui}>
      <div className="relative h-[calc(100vh-48px)] w-full bg-white" data-testid="simple-board" data-ready={ready ? '1' : '0'}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.02 }}
          minZoom={0.05}
          maxZoom={3}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Controls position="bottom-left" showInteractive={false} />
          <Panel position="top-right">
            <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] shadow-md" data-testid="simple-toolbar">
              <label className="flex items-center gap-2">
                <span className="text-neutral-600">Highlight</span>
                <select data-testid="simple-journey" className="h-8 rounded border border-neutral-400 bg-white px-1.5" value={journey} onChange={(e) => setJourney(e.target.value)}>
                  <option value="">All journeys</option>
                  {(['Registered Business', 'Freelancer'] as const).map((g) => (
                    <optgroup key={g} label={g}>
                      {SIMPLE_JOURNEYS.filter((j) => j.group === g).map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title.replace(`${g} — `, '')}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button data-testid="simple-fit" className="h-8 rounded border border-neutral-500 px-3" onClick={fitAll}>
                Fit all
              </button>
              <button
                data-testid="simple-reset"
                className="h-8 rounded border border-neutral-500 px-3"
                onClick={() => {
                  setJourney('');
                  fitAll();
                }}
              >
                Reset view
              </button>
              <a className="ml-2 underline" href={`./${SIMPLE_PDF}`} download>
                PDF
              </a>
              <a className="underline" href={`./${SIMPLE_SVG}`} download>
                SVG
              </a>
              <Link className="ml-2 underline" to="/detailed">
                Detailed Workflow →
              </Link>
            </div>
          </Panel>
        </ReactFlow>
        {enlarged && <Enlarge id={enlarged} runtimes={runtimes} onClose={() => setEnlarged(undefined)} />}
      </div>
    </UiCtx.Provider>
  );
}

export function SimpleBoardPage() {
  return (
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  );
}

// ---------- export (single page PDF / SVG) ----------

declare global {
  interface Window {
    __SIMPLE_READY__?: boolean;
  }
}

function ExportCanvas() {
  const { runtimes, ready } = useRuntimes();
  const { nodes, edges } = useElements();
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      for (let i = 0; i < 60 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 150));
        if (document.querySelectorAll('[data-fit-ready="0"]').length === 0 && document.querySelectorAll('.react-flow__edge').length >= SIMPLE_EDGES.length) break;
      }
      if (!cancelled) window.__SIMPLE_READY__ = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);
  const ui = useMemo(() => ({ runtimes }), [runtimes]);
  return (
    <UiCtx.Provider value={ui}>
      <div style={{ width: SIMPLE_BOUNDS.w, height: SIMPLE_BOUNDS.h }} className="bg-white" data-testid="board-export">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: -SIMPLE_BOUNDS.x, y: -SIMPLE_BOUNDS.y, zoom: 1 }}
          minZoom={1}
          maxZoom={1}
          panOnDrag={false}
          zoomOnScroll={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </UiCtx.Provider>
  );
}

export function SimpleBoardExportPage() {
  useEffect(() => {
    document.title = 'Madfu — Simplified Master Board';
  }, []);
  return (
    <ReactFlowProvider>
      <style>{`html, body { margin: 0; background: #fff; }`}</style>
      <ExportCanvas />
    </ReactFlowProvider>
  );
}
