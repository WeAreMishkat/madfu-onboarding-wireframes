import type { Application, ScreenId } from '../state/types';

export type Lane = 'shared' | 'cr' | 'fl' | 'manual' | 'outcome';
export type BoardNodeKind = 'screen' | 'outcome' | 'future' | 'decision' | 'process' | 'external' | 'manual' | 'connector';
export type HandleId = 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br';
export type Applicant = 'Both' | 'CR' | 'FREELANCER';

export interface NodeDetails {
  /** Rule / behaviour in one sentence. */
  rule: string;
  /** Where the logic lives in the implementation. */
  source?: string;
  inputs?: string[];
  notes?: string[];
}

export interface BoardNodeDef {
  id: string;
  kind: BoardNodeKind;
  lane: Lane;
  x: number;
  y: number;
  title: string;
  /** Short secondary line shown on the canvas. */
  subtitle?: string;
  /** Screen nodes: the implemented screen this instance renders. */
  screenId?: ScreenId;
  /** Screen nodes: gallery state rendered as the miniature wireframe. */
  stateId?: string;
  applicant: Applicant;
  /** Non-screen nodes: details for the side panel. */
  details?: NodeDetails;
  /** Small marker shown above the node (e.g. START). */
  badge?: string;
}

export interface GuardCtx {
  app: Application;
  events: Set<string>;
  flags: Set<string>;
  trace: ScreenId[];
}

export interface BoardEdgeDef {
  id: string;
  source: string;
  target: string;
  sh?: HandleId;
  th?: HandleId;
  label: string;
  /** Business condition in words (details panel / coverage report). */
  condition: string;
  /** flow = forward transition · loop = retry / repeat on the same step · back = permitted backward transition. */
  kind: 'flow' | 'loop' | 'back';
  /** Absolute orthogonal waypoints between the source and target handles. */
  via?: [number, number][];
  /** Explicit label position (absolute). */
  labelAt?: [number, number];
  /** Evaluated on an engine run to decide whether a journey took this edge. */
  guard?: (c: GuardCtx) => boolean;
}

export interface LaneDef {
  id: Lane;
  title: string;
  subtitle: string;
  y: number;
  height: number;
}
