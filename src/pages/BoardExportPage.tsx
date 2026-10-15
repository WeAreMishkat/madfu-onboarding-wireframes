/**
 * Static, full-size render of the Master Board for the single-page PDF / SVG
 * export (scripts/export-board.ts). Same nodes, edges and live wireframes as
 * the interactive board; no controls.
 */
import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BoardUiContext } from '../board/BoardNodes';
import { BOUNDS, edgeTypes, nodeTypes, useBoardRuntimes, useFlowElements } from '../board/BoardCanvas';
import { BOARD_EDGES, BOARD_NODES } from '../board/model';
import { SCENARIOS } from '../scenarios/scenarios';
import type { Lane } from '../board/types';

declare global {
  interface Window {
    __BOARD_READY__?: boolean;
  }
}

const NO_COLLAPSE = new Set<Lane>();

function ExportBoard() {
  const { runtimes, ready } = useBoardRuntimes();
  const stats = useMemo(
    () => [
      { label: 'screen nodes', value: BOARD_NODES.filter((n) => n.screenId).length },
      { label: 'distinct screens', value: new Set(BOARD_NODES.map((n) => n.screenId).filter(Boolean)).size },
      { label: 'decisions', value: BOARD_NODES.filter((n) => n.kind === 'decision').length },
      { label: 'connections', value: BOARD_EDGES.length },
      { label: 'journeys', value: SCENARIOS.length },
    ],
    [],
  );
  const { nodes, edges } = useFlowElements({ collapsed: NO_COLLAPSE, stats });
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      for (let i = 0; i < 60 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 150));
        const pendingFit = document.querySelectorAll('[data-fit-ready="0"]').length;
        const edgesRendered = document.querySelectorAll('.react-flow__edge').length;
        if (pendingFit === 0 && edgesRendered >= BOARD_EDGES.length) break;
      }
      if (!cancelled) {
        window.__BOARD_READY__ = true;
        setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);
  const ui = useMemo(() => ({ runtimes, compact: false }), [runtimes]);
  return (
    <BoardUiContext.Provider value={ui}>
      <div style={{ width: BOUNDS.w, height: BOUNDS.h }} className="bg-white" data-testid="board-export" data-done={done ? '1' : '0'}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: -BOUNDS.x, y: -BOUNDS.y, zoom: 1 }}
          minZoom={1}
          maxZoom={1}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </BoardUiContext.Provider>
  );
}

export function BoardExportPage() {
  useEffect(() => {
    document.title = 'Madfu — Onboarding Master Board';
  }, []);
  return (
    <ReactFlowProvider>
      <style>{`html, body { margin: 0; background: #fff; } @page { size: ${BOUNDS.w}px ${BOUNDS.h}px; margin: 0; }`}</style>
      <ExportBoard />
    </ReactFlowProvider>
  );
}
