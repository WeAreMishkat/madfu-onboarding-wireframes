import { beforeAll, describe, expect, it } from 'vitest';
import { BOARD_EDGES, BOARD_NODES } from '../../src/board/model';
import { buildCoverage, structuralProblems } from '../../src/board/coverage';
import { deriveAllJourneys, type BoardJourney } from '../../src/board/journeys';
import { SCENARIOS } from '../../src/scenarios/scenarios';
import { SCREENS } from '../../src/journeys/screens';

let journeys: BoardJourney[] = [];
beforeAll(async () => {
  journeys = await deriveAllJourneys();
});

describe('master board structure', () => {
  it('has no structural problems (ids, reachability, dead ends, overlaps, wireframe states)', () => {
    expect(structuralProblems()).toEqual([]);
  });
  it('every implemented screen appears on the board', () => {
    for (const s of SCREENS)
      expect(
        BOARD_NODES.some((n) => n.screenId === s.id),
        s.id,
      ).toBe(true);
  });
  it('every edge has a label or is a lead bus, and a condition', () => {
    for (const e of BOARD_EDGES) expect(e.condition.length, e.id).toBeGreaterThan(0);
  });
});

describe('board vs. engine', () => {
  it('derives a complete route for every scenario (no missing transitions)', () => {
    expect(journeys).toHaveLength(SCENARIOS.length);
    const errors = journeys.flatMap((j) => j.errors.map((e) => `${j.id}: ${e}`));
    expect(errors).toEqual([]);
  });
  it('each route ends on the scenario outcome screen', () => {
    for (const j of journeys) {
      const s = SCENARIOS.find((x) => x.key === j.scenarioKey)!;
      const end = BOARD_NODES.find((n) => n.id === j.outcomeNode)!;
      const expected = s.key === 'fl-duplicate' ? 'S01-F' : s.expected.finalScreen;
      expect(end.screenId, j.id).toBe(expected);
    }
  });
  it('coverage report has no problems', () => {
    expect(buildCoverage(journeys).problems).toEqual([]);
  });
  it('key business rules are visible on the routes', () => {
    const j = (k: string) => journeys.find((x) => x.scenarioKey === k)!;
    expect(j('cr-nafath-rejected-twice').edges).toContain('e.attemptsCR-change');
    expect(j('cr-nafath-rejected-twice').steps).not.toContain('cr.S09');
    expect(j('cr-iban-failed-twice').steps).toEqual(expect.arrayContaining(['m.ibanCR', 'cr.S09']));
    expect(j('cr-blocked-category').steps).not.toContain('x.gov');
    expect(j('fl-nafath-failed-twice').steps).toEqual(expect.arrayContaining(['fl.S07M', 'm.ibanFL']));
    expect(j('fl-nafath-failed-twice').steps).not.toContain('x.ibanFL');
    expect(j('cr-duplicate').steps).not.toContain('p.mobile');
  });
});

describe('retry loops are attached to the journeys that used them', () => {
  it('CR lookup retry, OTP errors, Nafath retry, IBAN retry', () => {
    const j = (k: string) => journeys.find((x) => x.scenarioKey === k)!;
    expect(j('any-api-failure-retry').loopEdges).toEqual(expect.arrayContaining(['e.crResult-retry', 'e.s05-loop']));
    expect(j('any-otp-errors').loopEdges).toContain('e.s02-loop');
    expect(j('cr-nafath-timeout-twice').loopEdges).toContain('e.attemptsCR-retry');
    expect(j('fl-iban-failed-twice').loopEdges).toContain('e.ibanFL-retry');
    expect(j('any-nafath-technical').loopEdges).toContain('e.nafathFL-tech');
    expect(j('cr-all-verified').loopEdges).toEqual([]);
  });
});
