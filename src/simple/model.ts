/**
 * SIMPLIFIED MASTER BOARD — screens and arrows only.
 *
 * A presentation view of the same implemented screens used by the prototype
 * and the Detailed Workflow. No decision, backend or annotation nodes: arrows
 * branch directly from the screen where the user's path splits.
 * Each journey's screen sequence is checked against a real engine run
 * (tests/unit/simple.test.ts).
 */
import type { ScreenId } from '../state/types';

export type SimpleLane = 'shared' | 'cr' | 'fl' | 'outcome';
type Handle = 't' | 'b' | 'l' | 'r' | 'bl' | 'tl' | 'tr';

export interface SimpleNode {
  id: string;
  lane: SimpleLane;
  title: string;
  screenId: ScreenId;
  stateId: string;
  /** Small right-aligned tag (defaults to the screen ID). */
  tag?: string;
  x: number;
  y: number;
}
export interface SimpleEdge {
  id: string;
  source: string;
  target: string;
  sh?: Handle;
  th?: Handle;
  label?: string;
  via?: [number, number][];
  labelAt?: [number, number];
}
export interface SimpleJourney {
  id: string;
  title: string;
  group: 'Registered Business' | 'Freelancer';
  /** Scenario whose engine run must produce exactly this screen sequence. */
  scenarioKey: string;
  nodes: string[];
}

export const SCREEN_W = 520;
export const SCREEN_H = 460;
/** The wireframe card starts below the 40px title; side arrows meet the card's middle. */
export const CARD_TOP = 40;
export const CARD_MID = CARD_TOP + (SCREEN_H - CARD_TOP) / 2;
const PITCH = 700;
const col = (c: number) => 100 + c * PITCH;

export const SIMPLE_LANES: { id: SimpleLane; title: string; y: number; height: number }[] = [
  { id: 'shared', title: 'Shared entry', y: 0, height: 640 },
  { id: 'cr', title: 'Registered Business', y: 680, height: 640 },
  { id: 'fl', title: 'Freelancer', y: 1360, height: 1180 },
  { id: 'outcome', title: 'Final outcomes', y: 2580, height: 640 },
];
const row = (lane: SimpleLane, second = false) => SIMPLE_LANES.find((l) => l.id === lane)!.y + 90 + (second ? 560 : 0);

const n = (id: string, lane: SimpleLane, c: number, title: string, screenId: ScreenId, stateId: string, second = false): SimpleNode => ({
  id,
  lane,
  title,
  screenId,
  stateId,
  x: col(c),
  y: row(lane, second),
});

export const SIMPLE_NODES: SimpleNode[] = [
  n('entry', 'shared', 0, 'Entry', 'S01', 'S01--filled-cr'),
  n('otp', 'shared', 1, 'OTP', 'S02', 'S02--default'),
  n('category', 'shared', 2, 'Category', 'S03', 'S03--selected'),

  n('cr.verify', 'cr', 3, 'Business Verification', 'S04', 'S04--valid'),
  n('cr.person', 'cr', 4, 'Authorized Person', 'S05', 'S05--selected'),
  n('cr.nafath', 'cr', 5, 'Nafath', 'S06', 'S06--waiting'),
  n('cr.details', 'cr', 6, 'Business Details', 'S08', 'S08--verified'),
  n('cr.contract', 'cr', 7, 'Contract', 'S09', 'S09--default'),

  n('fl.nafath', 'fl', 4, 'Nafath', 'S06', 'S06--fl-waiting'),
  n('fl.certificate', 'fl', 5, 'Certificate Selection', 'S07', 'S07--multiple'),
  n('fl.manualCert', 'fl', 5, 'Manual Certificate Entry', 'S07-M', 'S07-M--manual', true),
  n('fl.details', 'fl', 6, 'Business Details', 'S08', 'S08--fl-verified'),
  n('fl.contract', 'fl', 7, 'Contract', 'S09', 'S09--fl'),

  { ...n('out.lead', 'outcome', 1.5, 'Success · Sales lead', 'O-C', 'O-C--lead'), tag: 'Both · O-C' },
  { ...n('out.fl.received', 'outcome', 6, 'Success · Review', 'O-B', 'O-B--received'), tag: 'Freelancer · O-B' },
  { ...n('out.fl.submitted', 'outcome', 7, 'Success', 'O-A', 'O-A--submitted'), tag: 'Freelancer · O-A' },
  { ...n('out.cr.received', 'outcome', 8, 'Success · Review', 'O-B', 'O-B--received'), tag: 'Business · O-B' },
  { ...n('out.cr.submitted', 'outcome', 9, 'Success', 'O-A', 'O-A--submitted'), tag: 'Business · O-A' },
];
export const simpleNode = (id: string) => SIMPLE_NODES.find((x) => x.id === id)!;

export const SIMPLE_X1 = col(9) + SCREEN_W + 100;

/** Absolute handle coordinate. */
export function SH(id: string, h: Handle): [number, number] {
  const node = simpleNode(id);
  const off: Record<Handle, [number, number]> = {
    t: [SCREEN_W / 2, CARD_TOP],
    tl: [SCREEN_W * 0.3, CARD_TOP],
    tr: [SCREEN_W * 0.7, CARD_TOP],
    b: [SCREEN_W / 2, SCREEN_H],
    bl: [SCREEN_W * 0.3, SCREEN_H],
    l: [0, CARD_MID],
    r: [SCREEN_W, CARD_MID],
  };
  return [node.x + off[h][0], node.y + off[h][1]];
}

const outcomeTop = row('outcome');
const crBottomMargin = row('cr') + SCREEN_H + 70;
const busX = col(3) - 90;

export const SIMPLE_EDGES: SimpleEdge[] = [
  { id: 'entry-otp', source: 'entry', target: 'otp' },
  { id: 'otp-category', source: 'otp', target: 'category', label: 'Self-onboarding' },
  {
    id: 'otp-lead',
    source: 'otp',
    sh: 'b',
    target: 'out.lead',
    th: 't',
    label: 'Sales lead',
    via: [
      [SH('otp', 'b')[0], outcomeTop - 30],
      [SH('out.lead', 't')[0], outcomeTop - 30],
    ],
    labelAt: [SH('otp', 'b')[0], 1500],
  },
  {
    id: 'category-lead',
    source: 'category',
    sh: 'b',
    target: 'out.lead',
    th: 't',
    label: 'Restricted category',
    via: [
      [SH('category', 'b')[0], outcomeTop - 30],
      [SH('out.lead', 't')[0], outcomeTop - 30],
    ],
    labelAt: [SH('category', 'b')[0], 1500],
  },
  {
    id: 'category-cr',
    source: 'category',
    target: 'cr.verify',
    label: 'Registered Business',
    via: [
      [busX, SH('category', 'r')[1]],
      [busX, SH('cr.verify', 'l')[1]],
    ],
    labelAt: [busX, 660],
  },
  {
    id: 'category-fl',
    source: 'category',
    target: 'fl.nafath',
    label: 'Freelancer',
    via: [
      [busX, SH('category', 'r')[1]],
      [busX, SH('fl.nafath', 'l')[1]],
    ],
    labelAt: [busX + 330, SH('fl.nafath', 'l')[1]],
  },
  { id: 'cr-verify-person', source: 'cr.verify', target: 'cr.person' },
  { id: 'cr-person-nafath', source: 'cr.person', target: 'cr.nafath' },
  { id: 'cr-nafath-details', source: 'cr.nafath', target: 'cr.details' },
  { id: 'cr-details-contract', source: 'cr.details', target: 'cr.contract', label: 'Verified' },
  {
    id: 'cr-details-received',
    source: 'cr.details',
    sh: 'b',
    target: 'out.cr.received',
    th: 't',
    label: 'Not verified · Manual review',
    via: [
      [SH('cr.details', 'b')[0], crBottomMargin],
      [SH('out.cr.received', 't')[0], crBottomMargin],
    ],
    labelAt: [(SH('cr.details', 'b')[0] + SH('out.cr.received', 't')[0]) / 2, crBottomMargin],
  },
  {
    id: 'cr-contract-submitted',
    source: 'cr.contract',
    target: 'out.cr.submitted',
    th: 't',
    label: 'Accepted',
    via: [[SH('out.cr.submitted', 't')[0], SH('cr.contract', 'r')[1]]],
  },
  { id: 'fl-nafath-certificate', source: 'fl.nafath', target: 'fl.certificate', label: 'Verified' },
  {
    id: 'fl-nafath-manual',
    source: 'fl.nafath',
    sh: 'b',
    target: 'fl.manualCert',
    label: 'Not verified',
    via: [[SH('fl.nafath', 'b')[0], SH('fl.manualCert', 'l')[1]]],
    labelAt: [SH('fl.nafath', 'b')[0], SH('fl.manualCert', 'l')[1] - 120],
  },
  { id: 'fl-certificate-details', source: 'fl.certificate', target: 'fl.details' },
  {
    id: 'fl-manual-details',
    source: 'fl.manualCert',
    target: 'fl.details',
    th: 'bl',
    label: 'Manual journey',
    via: [[SH('fl.details', 'bl')[0], SH('fl.manualCert', 'r')[1]]],
  },
  { id: 'fl-details-contract', source: 'fl.details', target: 'fl.contract', label: 'Verified' },
  {
    id: 'fl-details-received',
    source: 'fl.details',
    sh: 'b',
    target: 'out.fl.received',
    th: 't',
    label: 'Manual review',
    labelAt: [SH('fl.details', 'b')[0], row('fl', true) + 380],
  },
  {
    id: 'fl-contract-submitted',
    source: 'fl.contract',
    sh: 'b',
    target: 'out.fl.submitted',
    th: 't',
    label: 'Accepted',
    labelAt: [SH('fl.contract', 'b')[0], row('fl', true) + 380],
  },
];

/** The seven journeys from the brief (validated against engine runs). */
export const SIMPLE_JOURNEYS: SimpleJourney[] = [
  {
    id: 'cr-self',
    title: 'Registered Business — Self-onboarding',
    group: 'Registered Business',
    scenarioKey: 'cr-all-verified',
    nodes: ['entry', 'otp', 'category', 'cr.verify', 'cr.person', 'cr.nafath', 'cr.details', 'cr.contract', 'out.cr.submitted'],
  },
  { id: 'cr-lead', title: 'Registered Business — Sales lead', group: 'Registered Business', scenarioKey: 'cr-below-revenue', nodes: ['entry', 'otp', 'out.lead'] },
  {
    id: 'cr-manual',
    title: 'Registered Business — Manual verification',
    group: 'Registered Business',
    scenarioKey: 'cr-nafath-timeout-twice',
    nodes: ['entry', 'otp', 'category', 'cr.verify', 'cr.person', 'cr.nafath', 'cr.details', 'out.cr.received'],
  },
  {
    id: 'cr-restricted',
    title: 'Registered Business — Restricted category',
    group: 'Registered Business',
    scenarioKey: 'cr-blocked-category',
    nodes: ['entry', 'otp', 'category', 'out.lead'],
  },
  {
    id: 'fl-success',
    title: 'Freelancer — Successful onboarding',
    group: 'Freelancer',
    scenarioKey: 'fl-all-verified',
    nodes: ['entry', 'otp', 'category', 'fl.nafath', 'fl.certificate', 'fl.details', 'fl.contract', 'out.fl.submitted'],
  },
  {
    id: 'fl-manual',
    title: 'Freelancer — Manual verification',
    group: 'Freelancer',
    scenarioKey: 'fl-nafath-failed-twice',
    nodes: ['entry', 'otp', 'category', 'fl.nafath', 'fl.manualCert', 'fl.details', 'out.fl.received'],
  },
  { id: 'fl-restricted', title: 'Freelancer — Restricted category', group: 'Freelancer', scenarioKey: 'fl-blocked-category', nodes: ['entry', 'otp', 'category', 'out.lead'] },
];

export function journeyEdges(j: SimpleJourney): string[] {
  const out: string[] = [];
  for (let i = 1; i < j.nodes.length; i++) {
    const e = SIMPLE_EDGES.find((x) => x.source === j.nodes[i - 1] && x.target === j.nodes[i]);
    if (e) out.push(e.id);
  }
  return out;
}
