/**
 * JOURNEYS ON THE MASTER BOARD — derived, not hand-drawn.
 *
 * Each ready-made scenario is executed on a sandboxed journey engine. Its
 * screen trace is mapped onto the board by searching, between consecutive
 * screens, for a path whose edge guards hold for that run. Any engine
 * transition the board cannot represent is reported (and fails the tests).
 */
import { SCENARIOS, type Scenario } from '../scenarios/scenarios';
import { traceScenario } from '../scenarios/run';
import type { Application, ScreenId } from '../state/types';
import { BOARD_EDGES, BOARD_NODES, nodeById } from './model';
import type { BoardEdgeDef, BoardNodeDef, GuardCtx } from './types';

export interface BoardJourney {
  id: string;
  scenarioId: number;
  scenarioKey: string;
  title: string;
  group: Scenario['group'];
  summary: string;
  /** Ordered steps (node ids) following the route, including decisions. */
  steps: string[];
  edges: string[];
  loopEdges: string[];
  trace: ScreenId[];
  outcomeNode?: string;
  errors: string[];
}

const SCREEN_KINDS = new Set<BoardNodeDef['kind']>(['screen', 'outcome', 'future']);
export const isScreenNode = (n: BoardNodeDef) => SCREEN_KINDS.has(n.kind);

export function guardCtx(app: Application, trace: ScreenId[]): GuardCtx {
  return { app, trace, events: new Set(app.audit.map((a) => a.type)), flags: new Set(app.flags.map((f) => f.code)) };
}

const compatible = (n: BoardNodeDef, type?: string) => n.applicant === 'Both' || n.applicant === type;
const holds = (e: BoardEdgeDef, ctx: GuardCtx) => {
  try {
    return e.guard ? e.guard(ctx) : false;
  } catch {
    return false;
  }
};

/** Breadth-first search from a screen node to the next screen, through non-screen nodes only. */
export function findPath(from: string, toScreen: ScreenId, ctx: GuardCtx): { nodes: string[]; edges: string[] } | undefined {
  const type = ctx.app.entry.applicantType;
  const queue: { node: string; nodes: string[]; edges: string[] }[] = [{ node: from, nodes: [], edges: [] }];
  const seen = new Set<string>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of BOARD_EDGES) {
      if (e.source !== cur.node || e.kind === 'loop' || e.source === e.target || !holds(e, ctx)) continue;
      const t = nodeById(e.target);
      if (!compatible(t, type)) continue;
      const nodes = [...cur.nodes, t.id];
      const edges = [...cur.edges, e.id];
      if (isScreenNode(t)) {
        if (t.screenId === toScreen) return { nodes, edges };
        continue; // never pass through another screen
      }
      if (!seen.has(t.id)) {
        seen.add(t.id);
        queue.push({ node: t.id, nodes, edges });
      }
    }
  }
  return undefined;
}

export async function deriveJourney(s: Scenario): Promise<BoardJourney> {
  const { app, trace } = await traceScenario(s);
  const ctx = guardCtx(app, trace);
  const errors: string[] = [];
  const steps: string[] = [];
  const edges: string[] = [];
  if (s.startInProgress) {
    steps.push('s.S00', 'c.resume');
    edges.push('e.s00-resume');
  }
  let current = 's.S01';
  steps.push(current);
  for (let i = 1; i < trace.length; i++) {
    const path = findPath(current, trace[i], ctx);
    if (!path) {
      errors.push(`No board path for ${trace[i - 1]} → ${trace[i]} (from ${current})`);
      const fallback = BOARD_NODES.find((n) => n.screenId === trace[i] && compatible(n, app.entry.applicantType));
      if (!fallback) break;
      current = fallback.id;
      steps.push(current);
      continue;
    }
    steps.push(...path.nodes);
    edges.push(...path.edges);
    current = path.nodes[path.nodes.length - 1];
  }
  const onRoute = new Set(steps);
  const loopEdges = BOARD_EDGES.filter((e) => (e.kind === 'loop' || e.source === e.target) && onRoute.has(e.source) && onRoute.has(e.target) && holds(e, ctx)).map((e) => e.id);
  const last = nodeById(steps[steps.length - 1]);
  return {
    id: s.key,
    scenarioId: s.id,
    scenarioKey: s.key,
    title: s.title,
    group: s.group,
    summary: s.summary,
    steps,
    edges,
    loopEdges,
    trace,
    outcomeNode: last?.id,
    errors,
  };
}

export async function deriveAllJourneys(): Promise<BoardJourney[]> {
  return Promise.all(SCENARIOS.map(deriveJourney));
}
