/**
 * Exports the Master Board as ONE continuous vector page:
 *   deliverables/Madfu_Onboarding_Master_Board.pdf  (single page, vector)
 *   deliverables/Madfu_Onboarding_Master_Board.svg  (converted from the PDF with pdftocairo — vector)
 *   deliverables/Madfu_Onboarding_Master_Board_overview.png (small raster preview for README)
 * Both are copied to public/ (and dist/ if present) so the site serves them.
 *
 * Usage: npm run build && npm run board:export
 */
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.BOARD_PORT ?? 4181);
const PDF = 'Madfu_Onboarding_Master_Board.pdf';
const SVG = 'Madfu_Onboarding_Master_Board.svg';
const PNG = 'Madfu_Onboarding_Master_Board_overview.png';

async function waitForServer(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('preview server did not start');
}

async function main() {
  if (!existsSync(resolve(ROOT, 'dist/index.html'))) throw new Error('Run `npm run build` first.');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  try {
    const base = `http://localhost:${PORT}/`;
    await waitForServer(base);
    const browser = await chromium.launch();
    const probe = await browser.newPage();
    await probe.goto(`${base}#/board/export`);
    const size = await probe.evaluate(() => {
      const el = document.querySelector('[data-testid="board-export"]') as HTMLElement;
      return { w: el.offsetWidth, h: el.offsetHeight };
    });
    await probe.close();
    const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(`${base}#/board/export`);
    await page.waitForFunction(() => (window as unknown as { __BOARD_READY__?: boolean }).__BOARD_READY__ === true, undefined, { timeout: 180_000 });
    const counts = await page.evaluate(() => ({
      nodes: document.querySelectorAll('.react-flow__node').length,
      edges: document.querySelectorAll('.react-flow__edge').length,
      labels: document.querySelectorAll('[data-testid^="board-edge-label-"]').length,
    }));
    mkdirSync(resolve(ROOT, 'deliverables'), { recursive: true });
    const pdfPath = resolve(ROOT, 'deliverables', PDF);
    await page.pdf({ path: pdfPath, width: `${size.w}px`, height: `${size.h}px`, printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await page.screenshot({ path: resolve(ROOT, 'deliverables', PNG), scale: 'css', clip: { x: 0, y: 0, width: size.w, height: size.h }, type: 'png' }).catch(() => undefined);
    await browser.close();
    const svgPath = resolve(ROOT, 'deliverables', SVG);
    execFileSync('pdftocairo', ['-svg', pdfPath, svgPath]);
    for (const f of [PDF, SVG]) {
      copyFileSync(resolve(ROOT, 'deliverables', f), resolve(ROOT, 'public', f));
      if (existsSync(resolve(ROOT, 'dist'))) copyFileSync(resolve(ROOT, 'deliverables', f), resolve(ROOT, 'dist', f));
    }
    console.log(`Board exported: ${size.w}×${size.h}px · ${counts.nodes} nodes · ${counts.edges} edges · ${counts.labels} labels`);
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
