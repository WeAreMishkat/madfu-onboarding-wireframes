import { describe, expect, it } from 'vitest';
import { SCREEN_H, SCREEN_W, SIMPLE_EDGES, SIMPLE_JOURNEYS, SIMPLE_NODES, journeyEdges, simpleNode } from '../../src/simple/model';
import { SCENARIOS } from '../../src/scenarios/scenarios';
import { traceScenario } from '../../src/scenarios/run';
import { GALLERY_STATES } from '../../src/journeys/galleryStates';

describe('simplified master board', () => {
  it('contains only implemented, user-facing screens with an existing wireframe state', () => {
    for (const n of SIMPLE_NODES)
      expect(
        GALLERY_STATES.some((g) => g.id === n.stateId && g.screen === n.screenId),
        n.id,
      ).toBe(true);
  });
  it('arrows connect existing screens', () => {
    const ids = new Set(SIMPLE_NODES.map((n) => n.id));
    for (const e of SIMPLE_EDGES) {
      expect(ids.has(e.source), e.id).toBe(true);
      expect(ids.has(e.target), e.id).toBe(true);
    }
  });
  it('no two screens overlap', () => {
    for (let i = 0; i < SIMPLE_NODES.length; i++)
      for (let j = i + 1; j < SIMPLE_NODES.length; j++) {
        const a = SIMPLE_NODES[i];
        const b = SIMPLE_NODES[j];
        const overlap = a.x < b.x + SCREEN_W && b.x < a.x + SCREEN_W && a.y < b.y + SCREEN_H && b.y < a.y + SCREEN_H;
        expect(overlap, `${a.id} / ${b.id}`).toBe(false);
      }
  });
  it('every screen is reachable from Entry and every non-final screen leads somewhere', () => {
    const seen = new Set(['entry']);
    const queue = ['entry'];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of SIMPLE_EDGES) if (e.source === id && !seen.has(e.target)) (seen.add(e.target), queue.push(e.target));
    }
    for (const n of SIMPLE_NODES) {
      expect(seen.has(n.id), n.id).toBe(true);
      if (n.lane !== 'outcome')
        expect(
          SIMPLE_EDGES.some((e) => e.source === n.id),
          n.id,
        ).toBe(true);
    }
  });
  for (const j of SIMPLE_JOURNEYS) {
    it(`journey "${j.title}" matches the engine and is fully connected`, async () => {
      const s = SCENARIOS.find((x) => x.key === j.scenarioKey)!;
      const { trace } = await traceScenario(s);
      expect(j.nodes.map((id) => simpleNode(id).screenId)).toEqual(trace);
      expect(journeyEdges(j)).toHaveLength(j.nodes.length - 1);
    });
  }
});
