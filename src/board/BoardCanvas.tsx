import { useEffect, useMemo, useState } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { GALLERY_STATES } from '../journeys/galleryStates';
import { createSandboxRuntime, type JourneyRuntime } from '../state/JourneyContext';
import { BOARD_EDGES, BOARD_NODES, BOARD_X0, BOARD_X1, LANES, nodeSize } from './model';
import { AssumptionsNode, BoardEdge, HeaderNode, LaneNode, ScreenNode, SmallNode } from './BoardNodes';
import type { BoardJourney } from './journeys';
import type { Lane } from './types';

export const HEADER = { x: BOARD_X0, y: -470, w: 4720, h: 420 };
export const ASSUMPTIONS = { x: BOARD_X0 + 4760, y: -470, w: BOARD_X1 - BOARD_X0 - 4760, h: 420 };
const lastLane = LANES[LANES.length - 1];
export const BOUNDS = { x: BOARD_X0 - 60, y: HEADER.y - 60, w: BOARD_X1 - BOARD_X0 + 120, h: lastLane.y + lastLane.height - HEADER.y + 120 };

export const nodeTypes = { screen: ScreenNode, small: SmallNode, lane: LaneNode, header: HeaderNode, assumptions: AssumptionsNode };
export const edgeTypes = { board: BoardEdge };

/** Builds a static sandbox runtime for every wireframe state used on the board. */
export function useBoardRuntimes() {
  const [runtimes, setRuntimes] = useState<Record<string, JourneyRuntime>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(BOARD_NODES.map((n) => n.stateId).filter(Boolean) as string[])];
    Promise.all(
      ids.map(async (id) => {
        const g = GALLERY_STATES.find((s) => s.id === id)!;
        const { app, sim } = await g.build();
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

export function useFlowElements(opts: { collapsed: Set<Lane>; journey?: BoardJourney; stats: { label: string; value: number | string }[] }) {
  const { collapsed, journey, stats } = opts;
  return useMemo(() => {
    const width = BOARD_X1 - BOARD_X0;
    const nodes: Node[] = [
      ...LANES.map((lane) => ({
        id: `lane.${lane.id}`,
        type: 'lane',
        position: { x: BOARD_X0, y: lane.y },
        data: { lane, width, collapsed: collapsed.has(lane.id) },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -10,
        style: { width, height: lane.height },
      })),
      {
        id: 'board.header',
        type: 'header',
        position: { x: HEADER.x, y: HEADER.y },
        data: { stats, width: HEADER.w, height: HEADER.h },
        draggable: false,
        selectable: false,
        style: { width: HEADER.w, height: HEADER.h },
      },
      {
        id: 'board.assumptions',
        type: 'assumptions',
        position: { x: ASSUMPTIONS.x, y: ASSUMPTIONS.y },
        data: { width: ASSUMPTIONS.w, height: ASSUMPTIONS.h },
        draggable: false,
        selectable: false,
        style: { width: ASSUMPTIONS.w, height: ASSUMPTIONS.h },
      },
      ...BOARD_NODES.map((def) => {
        const { w, h } = nodeSize(def);
        return {
          id: def.id,
          type: def.kind === 'screen' || def.kind === 'outcome' || def.kind === 'future' ? 'screen' : 'small',
          position: { x: def.x, y: def.y },
          data: { def },
          draggable: false,
          hidden: collapsed.has(def.lane),
          style: { width: w, height: h },
          width: w,
          height: h,
        } as Node;
      }),
    ];
    const on = journey ? new Set([...journey.edges, ...journey.loopEdges]) : undefined;
    const edges: Edge[] = BOARD_EDGES.map((e) => {
      const state = on ? (on.has(e.id) ? 'on' : 'dim') : 'normal';
      const color = state === 'on' ? '#d4380d' : '#2b2b2b';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sh ?? 'r',
        targetHandle: e.th ?? 'l',
        type: 'board',
        selectable: false,
        focusable: false,
        zIndex: state === 'on' ? 5 : 1,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
        data: { via: e.via, label: e.label, labelAt: e.labelAt, kind: e.kind, state },
      };
    });
    return { nodes, edges };
  }, [collapsed, journey, stats]);
}
