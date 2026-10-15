import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { OverviewPage } from '../pages/OverviewPage';
import { PrototypePage } from '../pages/PrototypePage';
import { GalleryIndexPage, GalleryStatePage } from '../pages/GalleryPage';
import { MapPage } from '../pages/MapPage';
import { DocsPage } from '../pages/DocsPage';
import { PrintPage } from '../pages/PrintPage';

import { PROJECT_META } from './meta';
export const PDF_FILENAME = PROJECT_META.pdfFilename;

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/prototype', label: 'Prototype' },
  { to: '/gallery', label: 'Screens' },
  { to: '/map', label: 'Journey maps' },
  { to: '/docs/rules', label: 'Rules & decisions' },
  { to: '/docs/handover', label: 'UX handover' },
];

function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-neutral-300 bg-neutral-900 px-5 text-[13px] text-neutral-200">
      <div className="flex items-center gap-6">
        <span className="font-semibold tracking-wide text-white">Madfu · Merchant Onboarding Wireframes</span>
        <nav className="flex items-center gap-1" aria-label="Documentation navigation">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rounded px-3 py-1.5 ${isActive ? 'bg-white text-black' : 'hover:bg-neutral-700'}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <a className="rounded border border-neutral-500 px-3 py-1.5 hover:bg-neutral-700" href={`./${PDF_FILENAME}`} download data-testid="download-pdf">
        Download PDF
      </a>
    </header>
  );
}

function Shell() {
  const location = useLocation();
  const isPrint = location.pathname.startsWith('/print');
  return (
    <div className="min-h-screen bg-white">
      {!isPrint && <TopBar />}
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/prototype" element={<PrototypePage />} />
        <Route path="/prototype/:slug" element={<PrototypePage />} />
        <Route path="/gallery" element={<GalleryIndexPage />} />
        <Route path="/gallery/:stateId" element={<GalleryStatePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/map/:mapId" element={<MapPage />} />
        <Route path="/docs/:tab" element={<DocsPage />} />
        <Route path="/print" element={<PrintPage />} />
        <Route path="*" element={<OverviewPage />} />
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
