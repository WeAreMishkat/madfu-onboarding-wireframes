import { useEffect, useRef, useState } from 'react';

let initialised = false;
let counter = 0;

async function getMermaid() {
  const { default: mermaid } = await import('mermaid');
  if (!initialised) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontSize: '14px',
        primaryColor: '#ffffff',
        primaryBorderColor: '#111111',
        primaryTextColor: '#111111',
        lineColor: '#444444',
        secondaryColor: '#f4f4f4',
        tertiaryColor: '#fafafa',
        clusterBkg: '#fafafa',
        clusterBorder: '#999999',
        edgeLabelBackground: '#ffffff',
      },
      flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 36, rankSpacing: 46, padding: 10, useMaxWidth: true },
    });
    initialised = true;
  }
  return mermaid;
}

/** Renders Mermaid source to inline SVG. `linkRewrite` adapts node links (e.g. for the PDF). */
export function MermaidDiagram({
  code,
  onRendered,
  linkRewrite,
  testId,
  natural,
  fit,
}: {
  code: string;
  onRendered?: () => void;
  linkRewrite?: (href: string) => string;
  testId?: string;
  /** Render at natural size (scrollable) instead of shrinking to the container width. */
  natural?: boolean;
  /** Print: render top-down and left-right, keep whichever is larger when fitted into this box. */
  fit?: { width: number; height: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `mmd-${++counter}`;
        const finalCode = linkRewrite ? code.replace(/href "([^"]+)"/g, (_m, h) => `href "${linkRewrite(h)}"`) : code;
        let { svg, bindFunctions } = await mermaid.render(id, finalCode);
        if (fit) {
          const alt = /flowchart TB/.test(finalCode) ? finalCode.replace('flowchart TB', 'flowchart LR') : finalCode.replace('flowchart LR', 'flowchart TB');
          const second = await mermaid.render(`${id}-alt`, alt);
          const scaleOf = (s: string) => {
            const m = s.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/);
            return m ? Math.min(fit.width / Number(m[1]), fit.height / Number(m[2])) : 0;
          };
          if (scaleOf(second.svg) > scaleOf(svg)) ({ svg, bindFunctions } = second);
        }
        if (!alive || !ref.current) return;
        ref.current.innerHTML = svg;
        const el = ref.current.querySelector('svg');
        if (el && natural) {
          const vb = el.viewBox.baseVal;
          el.style.maxWidth = 'none';
          el.setAttribute('width', String(vb.width));
          el.setAttribute('height', String(vb.height));
        }
        bindFunctions?.(ref.current);
        onRendered?.();
      } catch (e) {
        if (alive) setError(String(e));
        onRendered?.();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  return (
    <div data-testid={testId} className="mermaid-host w-full">
      {error && <pre className="whitespace-pre-wrap border border-black p-3 text-[12px]">Diagram error: {error}</pre>}
      <div ref={ref} className={natural ? 'overflow-x-auto' : 'flex justify-center'} />
    </div>
  );
}
