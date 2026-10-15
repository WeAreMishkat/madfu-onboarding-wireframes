import { Link, useParams } from 'react-router-dom';
import { JOURNEY_MAPS, LEGEND_MAP } from '../journeys/maps';
import { MermaidDiagram } from '../components/Mermaid';

export function MapPage() {
  const { mapId = 'A' } = useParams();
  const map = JOURNEY_MAPS.find((m) => m.id === mapId) ?? JOURNEY_MAPS[0];
  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-semibold">Journey decision maps</h1>
          <p className="mt-2 max-w-[820px] text-[15px] text-neutral-600">
            Split into readable sections with continuation references. Click a screen node to open that screen in the gallery. Source:{' '}
            <code className="text-[13px]">src/journeys/maps.ts</code> (also exported to <code className="text-[13px]">docs/journey-map/</code>).
          </p>
        </div>
      </div>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Maps">
        {JOURNEY_MAPS.map((m) => (
          <Link
            key={m.id}
            to={`/map/${m.id}`}
            data-testid={`map-tab-${m.id}`}
            className={`rounded border px-3 py-1.5 text-[13px] ${m.id === map.id ? 'border-black bg-black text-white' : 'border-neutral-400 hover:bg-neutral-100'}`}
          >
            {m.title}
          </Link>
        ))}
      </nav>
      <div className="mt-5 rounded-md border border-neutral-300 p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Legend</div>
        <MermaidDiagram code={LEGEND_MAP.code} />
      </div>
      <section className="mt-6 rounded-md border border-neutral-300 p-6">
        <h2 className="text-[20px] font-semibold">{map.title}</h2>
        <p className="mt-1 text-[14px] text-neutral-600">{map.description}</p>
        <div className="mt-6">
          <MermaidDiagram key={map.id} code={map.code} testId="journey-map" natural />
        </div>
      </section>
    </div>
  );
}
