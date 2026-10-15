/**
 * Generates deliverables/Madfu_Merchant_Onboarding_Wireframes.pdf from the
 * built prototype (dist/) by printing its #/print route with Playwright.
 *
 * Usage: npm run build && npm run pdf
 */
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../..');
const FILE = 'Madfu_Merchant_Onboarding_Wireframes.pdf';
const PORT = Number(process.env.PDF_PORT ?? 4179);

async function waitForServer(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not start: ${url}`);
}

async function main() {
  if (!existsSync(resolve(ROOT, 'dist/index.html'))) throw new Error('dist/ not found — run `npm run build` first.');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  try {
    const base = `http://localhost:${PORT}/`;
    await waitForServer(base);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1587, height: 1123 } });
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(`${base}#/print`);
    await page.waitForFunction(() => (window as unknown as { __PRINT_READY__?: boolean }).__PRINT_READY__ === true, undefined, { timeout: 180_000 });
    const pages = await page.locator('.print-page').count();
    const out = resolve(ROOT, 'deliverables', FILE);
    mkdirSync(resolve(ROOT, 'deliverables'), { recursive: true });
    await page.pdf({ path: out, format: 'A3', landscape: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true, outline: true, tagged: true });
    await browser.close();
    copyFileSync(out, resolve(ROOT, 'public', FILE));
    if (existsSync(resolve(ROOT, 'dist'))) copyFileSync(out, resolve(ROOT, 'dist', FILE));
    console.log(`PDF written: ${out} (${pages} pages) — copied to public/ and dist/`);
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
