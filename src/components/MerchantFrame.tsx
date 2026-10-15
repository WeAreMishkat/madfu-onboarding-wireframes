import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { backTarget } from '../journeys/engine';
import { useJourney } from '../state/JourneyContext';
import type { ApplicantType } from '../rules/config';
import type { ScreenId } from '../state/types';
import { Button, H1, Lead } from './wf';

const STEPS: Record<ApplicantType | 'UNKNOWN', string[]> = {
  CR: ['Start', 'Verify mobile', 'Business category', 'Business verification', 'Identity verification', 'Business details', 'Agreement'],
  FREELANCER: ['Start', 'Verify mobile', 'Business category', 'Identity verification', 'Freelance certificate', 'Business details', 'Agreement'],
  UNKNOWN: ['Start', 'Verify mobile', 'Business category', 'Verification', 'Business details', 'Agreement'],
};

function stepIndex(screen: ScreenId, type: ApplicantType | 'UNKNOWN'): number {
  const offset = type === 'UNKNOWN' ? -1 : 0;
  switch (screen) {
    case 'S01':
    case 'S01-X':
    case 'S01-F':
      return 0;
    case 'S02':
    case 'S02-L':
      return 1;
    case 'S03':
      return 2;
    case 'S04':
    case 'S05':
      return 3;
    case 'S06':
      return type === 'CR' ? 4 : 3;
    case 'S07':
    case 'S07-M':
      return 4;
    case 'S08':
      return 5 + offset;
    case 'S09':
    case 'S09-D':
      return 6 + offset;
    default:
      return 99;
  }
}

/** Customer-facing step name for a screen (used by the resume screen). */
export function customerStepName(screen: ScreenId, type?: ApplicantType): string {
  const t = type ?? 'UNKNOWN';
  const i = stepIndex(screen, t);
  return STEPS[t][i] ?? 'Application';
}

function Stepper({ screen, type }: { screen: ScreenId; type: ApplicantType | 'UNKNOWN' }) {
  const steps = STEPS[type];
  const current = stepIndex(screen, type);
  if (screen === 'S00') return null;
  return (
    <nav aria-label="Application progress" className="border-b border-neutral-200 px-10 py-4">
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  done ? 'bg-black text-white' : active ? 'border-2 border-black text-black' : 'border border-neutral-300 text-neutral-400'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={`truncate text-[12px] ${active ? 'font-semibold text-black' : done ? 'text-neutral-700' : 'text-neutral-400'}`}>{label}</span>
              {i < steps.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-black' : 'bg-neutral-300'}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function MerchantFrame({ children, screen }: { children: ReactNode; screen: ScreenId }) {
  const { app } = useJourney();
  const type = app.entry.applicantType ?? 'UNKNOWN';
  const isOutcome = screen.startsWith('O-');
  return (
    <div
      data-testid="merchant-frame"
      data-screen-id={screen}
      className="relative flex min-h-[780px] flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-black shadow-sm"
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="ml-4 h-5 w-80 rounded bg-white px-2 text-[11px] leading-5 text-neutral-400">merchants.madfu.example/apply</span>
      </div>
      <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-28 items-center justify-center border border-neutral-400 bg-neutral-100 text-[12px] font-bold tracking-[0.3em] text-neutral-700">MADFU</div>
          <span className="text-[14px] text-neutral-500">Merchant application</span>
        </div>
        <div className="flex items-center gap-6 text-[14px] text-neutral-600">
          <span className="underline underline-offset-4">Need help?</span>
          <span>English</span>
        </div>
      </header>
      {!isOutcome && <Stepper screen={screen} type={type} />}
      <main className="flex flex-1 justify-center px-10 py-10">
        <div className="w-full max-w-[760px]">{children}</div>
      </main>
      <footer className="flex h-12 items-center justify-between border-t border-neutral-200 px-10 text-[12px] text-neutral-400">
        <span>© Madfu</span>
        <span className="flex gap-4">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Contact</span>
        </span>
      </footer>
    </div>
  );
}

/** Standard screen body: heading, lead, content, action bar (Back left, actions right). */
export function ScreenBody({
  title,
  lead,
  children,
  primary,
  secondary,
  hideBack,
  center,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  hideBack?: boolean;
  center?: boolean;
}) {
  const { app, engine } = useJourney();
  const back = hideBack ? undefined : backTarget(app);
  return (
    <div className={`flex flex-col gap-8 ${center ? 'items-center text-center' : ''}`}>
      <div>
        <H1>{title}</H1>
        {lead && <Lead>{lead}</Lead>}
      </div>
      {children && <div className={`flex flex-col gap-6 ${center ? 'items-center' : ''}`}>{children}</div>}
      {(primary || secondary || back) && (
        <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
          <div>
            {back && (
              <Button variant="secondary" testId="back" onClick={() => engine.back()}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {secondary}
            {primary}
          </div>
        </div>
      )}
    </div>
  );
}

/** Ticking clock for countdowns (disabled in static/print mode). */
export function useNow(enabled: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [enabled, intervalMs]);
  return now;
}

/** Host-provided navigation for prototype chrome actions (exit / restart). */
export const HostNavContext = createContext<{ exitToOverview: () => void; restart: () => void; sandbox: boolean }>({
  exitToOverview: () => {},
  restart: () => {},
  sandbox: true,
});
export const useHostNav = () => useContext(HostNavContext);
