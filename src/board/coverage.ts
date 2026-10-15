/**
 * Structural validation + coverage of the Master Board against the
 * implemented journey (screens registry and engine-derived journeys).
 */
import { SCREENS } from '../journeys/screens';
import { GALLERY_STATES } from '../journeys/galleryStates';
import type { ScreenId } from '../state/types';
import { BOARD_EDGES, BOARD_NODES, nodeById, nodeSize } from './model';
import { isScreenNode, type BoardJourney } from './journeys';

export interface CoverageReport {
  counts: {
    screenNodes: number;
    distinctScreens: number;
    decisionNodes: number;
    processNodes: number;
    manualNodes: number;
    connectorNodes: number;
    edges: number;
    loops: number;
    journeys: number;
  };
  problems: string[];
  screens: { id: ScreenId; name: string; instances: string[]; incoming: number; reachable: boolean; journeys: number }[];
  decisions: { id: string; title: string; outgoing: { label: string; target: string }[]; journeys: number }[];
  edges: { id: string; label: string; from: string; to: string; kind: string; journeys: number }[];
  transitions: { from: ScreenId; to: ScreenId; journeys: number }[];
  journeys: { id: string; title: string; trace: string; outcome: string; steps: number; ok: boolean; errors: string[] }[];
}

const START_NODES = ['s.S01', 's.S00'];

export function reachableNodes(): Set<string> {
  const seen = new Set(START_NODES);
  const queue = [...START_NODES];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of BOARD_EDGES) if (e.source === id && !seen.has(e.target)) (seen.add(e.target), queue.push(e.target));
  }
  return seen;
}

function overlaps(): string[] {
  const out: string[] = [];
  for (let i = 0; i < BOARD_NODES.length; i++)
    for (let j = i + 1; j < BOARD_NODES.length; j++) {
      const a = BOARD_NODES[i];
      const b = BOARD_NODES[j];
      const sa = nodeSize(a);
      const sb = nodeSize(b);
      if (a.x < b.x + sb.w && b.x < a.x + sa.w && a.y < b.y + sb.h && b.y < a.y + sa.h) out.push(`Nodes overlap: ${a.id} / ${b.id}`);
    }
  return out;
}

export function structuralProblems(): string[] {
  const problems: string[] = [];
  const ids = new Set(BOARD_NODES.map((n) => n.id));
  if (ids.size !== BOARD_NODES.length) problems.push('Duplicate node ids');
  const edgeIds = new Set(BOARD_EDGES.map((e) => e.id));
  if (edgeIds.size !== BOARD_EDGES.length) problems.push('Duplicate edge ids');
  for (const e of BOARD_EDGES) {
    if (!ids.has(e.source)) problems.push(`Edge ${e.id}: unknown source ${e.source}`);
    if (!ids.has(e.target)) problems.push(`Edge ${e.id}: unknown target ${e.target}`);
    if (!e.condition) problems.push(`Edge ${e.id}: missing condition`);
  }
  const reach = reachableNodes();
  for (const n of BOARD_NODES) {
    if (!reach.has(n.id)) problems.push(`Node ${n.id} not reachable from a start node`);
    const incoming = BOARD_EDGES.some((e) => e.target === n.id && e.source !== n.id);
    if (!incoming && !START_NODES.includes(n.id)) problems.push(`Node ${n.id} has no incoming connection`);
    const outgoing = BOARD_EDGES.some((e) => e.source === n.id && e.target !== n.id);
    const terminal = n.kind === 'outcome' || n.kind === 'future' || n.kind === 'connector' || n.screenId === 'S02-L';
    if (!outgoing && !terminal) problems.push(`Node ${n.id} has no outgoing connection (dead end)`);
    if (isScreenNode(n) && (!n.stateId || !GALLERY_STATES.some((g) => g.id === n.stateId && g.screen === n.screenId)))
      problems.push(`Node ${n.id}: wireframe state ${n.stateId} missing / wrong screen`);
  }
  for (const s of SCREENS) if (!BOARD_NODES.some((n) => n.screenId === s.id)) problems.push(`Screen ${s.id} has no board node`);
  problems.push(...overlaps());
  return problems;
}

export function buildCoverage(journeys: BoardJourney[]): CoverageReport {
  const reach = reachableNodes();
  const problems = structuralProblems();
  for (const j of journeys) for (const err of j.errors) problems.push(`Journey ${j.id}: ${err}`);
  const usedBy = (pred: (j: BoardJourney) => boolean) => journeys.filter(pred).length;
  const transitions = new Map<string, number>();
  for (const j of journeys) {
    const seen = new Set<string>();
    for (let i = 1; i < j.trace.length; i++) seen.add(`${j.trace[i - 1]}→${j.trace[i]}`);
    seen.forEach((k) => transitions.set(k, (transitions.get(k) ?? 0) + 1));
  }
  const nonScreen = BOARD_NODES.filter((n) => !isScreenNode(n));
  return {
    counts: {
      screenNodes: BOARD_NODES.filter(isScreenNode).length,
      distinctScreens: new Set(BOARD_NODES.filter(isScreenNode).map((n) => n.screenId)).size,
      decisionNodes: nonScreen.filter((n) => n.kind === 'decision').length,
      processNodes: nonScreen.filter((n) => n.kind === 'process' || n.kind === 'external').length,
      manualNodes: nonScreen.filter((n) => n.kind === 'manual').length,
      connectorNodes: nonScreen.filter((n) => n.kind === 'connector').length,
      edges: BOARD_EDGES.length,
      loops: BOARD_EDGES.filter((e) => e.kind === 'loop').length,
      journeys: journeys.length,
    },
    problems,
    screens: SCREENS.map((s) => {
      const inst = BOARD_NODES.filter((n) => n.screenId === s.id).map((n) => n.id);
      return {
        id: s.id,
        name: s.name,
        instances: inst,
        incoming: BOARD_EDGES.filter((e) => inst.includes(e.target) && !inst.includes(e.source)).length,
        reachable: inst.some((i) => reach.has(i)),
        journeys: usedBy((j) => j.steps.some((st) => inst.includes(st))),
      };
    }),
    decisions: BOARD_NODES.filter((n) => n.kind === 'decision').map((n) => ({
      id: n.id,
      title: n.title,
      outgoing: BOARD_EDGES.filter((e) => e.source === n.id).map((e) => ({ label: e.label, target: nodeById(e.target).title })),
      journeys: usedBy((j) => j.steps.includes(n.id)),
    })),
    edges: BOARD_EDGES.map((e) => ({
      id: e.id,
      label: e.label || '(bus)',
      from: e.source,
      to: e.target,
      kind: e.kind,
      journeys: usedBy((j) => j.edges.includes(e.id) || j.loopEdges.includes(e.id)),
    })),
    transitions: [...transitions.entries()].map(([k, v]) => {
      const [from, to] = k.split('→') as [ScreenId, ScreenId];
      return { from, to, journeys: v };
    }),
    journeys: journeys.map((j) => ({
      id: j.id,
      title: j.title,
      trace: j.trace.join(' → '),
      outcome: j.outcomeNode ?? '—',
      steps: j.steps.length,
      ok: j.errors.length === 0,
      errors: j.errors,
    })),
  };
}
