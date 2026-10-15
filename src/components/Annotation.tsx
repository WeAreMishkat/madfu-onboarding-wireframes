import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { screenById } from '../journeys/screens';
import type { ScreenId } from '../state/types';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-t border-neutral-200 py-2 first:border-t-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-[13px] leading-snug text-neutral-900">{children}</dd>
    </div>
  );
}

const list = (items: string[]) =>
  items.length ? (
    <ul className="flex list-disc flex-col gap-0.5 pl-4">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  ) : (
    <span className="text-neutral-400">—</span>
  );

/** UX/UI annotation for a screen. Same content in prototype, gallery and PDF. */
export function Annotation({ screen, compact, globalRef = '#ux-handover' }: { screen: ScreenId; compact?: boolean; globalRef?: string }) {
  const def = screenById(screen);
  const a = def.annotation;
  return (
    <section data-testid="annotation" className="rounded-md border border-neutral-300 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-300 bg-neutral-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black px-2 py-0.5 text-[12px] font-semibold text-white">{def.id}</span>
          <span className="text-[14px] font-semibold">{def.name}</span>
        </div>
        <span className="text-[12px] text-neutral-500">{def.audience}</span>
      </header>
      <dl className={`px-4 ${compact ? 'py-1' : 'py-2'}`}>
        <Row label="Purpose">{a.purpose}</Row>
        <Row label="Who sees it">{a.whoSees}</Row>
        <Row label="Entry condition">{a.entryCondition}</Row>
        <Row label="Required inputs">{list(a.inputs)}</Row>
        <Row label="Primary action">{a.primaryAction}</Row>
        <Row label="Next screen">{a.next}</Row>
        <Row label="Alternative paths">{list(a.alternatives)}</Row>
        <Row label="Backend behaviour">{list(a.backend)}</Row>
        <Row label="Business rules">{list(a.constraints)}</Row>
        {!compact && <Row label="UX/UI notes">{list(a.uxNotes)}</Row>}
        <Row label="Global note">
          All error, empty, loading, retry and edge states are required — see the{' '}
          <a href={globalRef} className="underline underline-offset-2">
            global UX/UI handover note (G-UX)
          </a>
          .
        </Row>
      </dl>
    </section>
  );
}

/**
 * Renders a desktop-width child (natural width `naturalWidth`) scaled down to
 * fit a box, without cropping. Used for gallery thumbnails and the PDF.
 */
export function FitBox({ width, maxHeight, naturalWidth = 1200, children }: { width: number; maxHeight: number; naturalWidth?: number; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const update = () => setH(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(width / naturalWidth, h ? maxHeight / h : 1, 1);
  return (
    <div style={{ width: naturalWidth * scale, height: h * scale, contain: 'strict' }} className="relative overflow-hidden" data-fit-ready={h > 0 ? '1' : '0'}>
      <div ref={inner} style={{ width: naturalWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="absolute left-0 top-0">
        {children}
      </div>
    </div>
  );
}
