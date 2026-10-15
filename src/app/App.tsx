import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { OverviewPage } from '../pages/OverviewPage';
import { PrototypePage } from '../pages/PrototypePage';
import { GalleryIndexPage, GalleryStatePage } from '../pages/GalleryPage';
import { MapPage } from '../pages/MapPage';
import { DocsPage } from '../pages/DocsPage';
import { PrintPage } from '../pages/PrintPage';
import { BOARD_PDF, BOARD_SVG, BoardPage } from '../pages/BoardPage';
import { BoardExportPage } from '../pages/BoardExportPage';
import { PROJECT_META } from './meta';

export const PDF_FILENAME = PROJECT_META.pdfFilename;

const PRIMARY = [
  { to: '/', label: 'Master Board', end: true },
  { to: '/prototype', label: 'Interactive Journey' },
  { to: '/docs', label: 'Documentation' },
];

/** Documentation sub-sections (second navigation row). */
export const DOC_LINKS = [
  { to: '/docs', label: 'Contents', end: true },
  { to: '/overview', label: 'Scenarios' },
  { to: '/gallery', label: 'Screen gallery' },
  { to: '/map', label: 'Journey maps' },
  { to: '/docs/rules', label: 'Business rules' },
  { to: '/docs/decisions', label: 'Decision log' },
  { to: '/docs/handover', label: 'UX/UI handover' },
  { to: '/docs/coverage', label: 'Board coverage' },
  { to: '/docs/scenarios', label: 'QA' },
];

const isDocRoute = (p: string) => p.startsWith('/docs') || p.startsWith('/overview') || p.startsWith('/gallery') || p.startsWith('/map');

function TopBar() {
  const location = useLocation();
  const docs = isDocRoute(location.pathname);
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-300 bg-neutral-900 text-[13px] text-neutral-200">
      <div className="flex h-12 items-center justify-between px-5">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-wide text-white">Madfu · Merchant Onboarding</span>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {PRIMARY.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={({ isActive }) => `rounded px-3 py-1.5 ${isActive || (n.to === '/docs' && docs) ? 'bg-white text-black' : 'hover:bg-neutral-700'}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a className="rounded border border-neutral-500 px-3 py-1.5 hover:bg-neutral-700" href={`./${BOARD_PDF}`} download data-testid="download-board-pdf">
            Board PDF
          </a>
          <a className="rounded border border-neutral-500 px-3 py-1.5 hover:bg-neutral-700" href={`./${BOARD_SVG}`} download>
            Board SVG
          </a>
          <a className="rounded border border-neutral-500 px-3 py-1.5 hover:bg-neutral-700" href={`./${PDF_FILENAME}`} download data-testid="download-pdf">
            Wireframes PDF
          </a>
        </div>
      </div>
      {docs && (
        <nav className="flex h-10 items-center gap-1 border-t border-neutral-700 bg-neutral-800 px-5" aria-label="Documentation sections">
          {DOC_LINKS.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `rounded px-2.5 py-1 text-[12.5px] ${isActive ? 'bg-neutral-200 text-black' : 'hover:bg-neutral-700'}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function Shell() {
  const location = useLocation();
  const bare = location.pathname.startsWith('/print') || location.pathname.startsWith('/board/export');
  return (
    <div className="min-h-screen bg-white">
      {!bare && <TopBar />}
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/board/export" element={<BoardExportPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/prototype" element={<PrototypePage />} />
        <Route path="/prototype/:slug" element={<PrototypePage />} />
        <Route path="/gallery" element={<GalleryIndexPage />} />
        <Route path="/gallery/:stateId" element={<GalleryStatePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/map/:mapId" element={<MapPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:tab" element={<DocsPage />} />
        <Route path="/print" element={<PrintPage />} />
        <Route path="*" element={<BoardPage />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
