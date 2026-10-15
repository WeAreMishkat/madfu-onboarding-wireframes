/** Simplified Master Board — presentation view checks. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { SIMPLE_EDGES, SIMPLE_JOURNEYS, SIMPLE_NODES } from '../../src/simple/model';

const probe = readFileSync(resolve(import.meta.dirname, 'simple-probe.js'), 'utf8');

async function open(page: Page) {
  await page.goto('./#/');
  await expect(page.getByTestId('simple-board')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
}
const transform = (page: Page) => page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);

test('simplified board is the default landing view with every screen as a real wireframe', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('nav-simplified-master-board')).toHaveClass(/bg-white/);
  await expect(page.locator('.react-flow__node-screen')).toHaveCount(SIMPLE_NODES.length);
  await expect(page.locator('.react-flow__edge')).toHaveCount(SIMPLE_EDGES.length);
  for (const n of SIMPLE_NODES) {
    const mini = page.getByTestId(`simple-mini-${n.id}`);
    await expect(mini.getByTestId('merchant-frame'), n.id).toHaveAttribute('data-screen-id', n.screenId);
    await expect(mini.getByTestId('dev-simulator'), `${n.id} hides prototype-only tools`).toHaveCount(0);
  }
  // only screens: no decision / backend / annotation nodes
  await expect(page.locator('.react-flow__node').filter({ hasText: /DECISION|BACKEND|INTEGRATION|MANUAL REVIEW/ })).toHaveCount(0);
  await expect(page.getByTestId('simple-mini-cr.nafath').getByTestId('nafath-number')).toHaveText(/^\d{2}$/);
});

test('whole canvas fits when zoomed out and every screen is in view', async ({ page }) => {
  await open(page);
  await page.getByTestId('simple-fit').click();
  await page.waitForTimeout(600);
  const vp = page.viewportSize()!;
  for (const n of SIMPLE_NODES) {
    const box = (await page.getByTestId(`simple-node-${n.id}`).boundingBox())!;
    expect(box.x, n.id).toBeGreaterThanOrEqual(0);
    expect(box.y, n.id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, n.id).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height, n.id).toBeLessThanOrEqual(vp.height);
  }
});

test('zoom in keeps wireframe text readable; pan and reset work', async ({ page }) => {
  await open(page);
  const t0 = await transform(page);
  for (let i = 0; i < 6; i++) await page.locator('.react-flow__controls-zoomin').click();
  await page.waitForTimeout(400);
  expect(await transform(page)).not.toBe(t0);
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  const t1 = await transform(page);
  await page.mouse.move(pane.x + 300, pane.y + 400);
  await page.mouse.down();
  await page.mouse.move(pane.x + 600, pane.y + 500, { steps: 6 });
  await page.mouse.up();
  expect(await transform(page)).not.toBe(t1);
  await page.getByTestId('simple-reset').click();
  await page.waitForTimeout(600);
  expect(await transform(page)).toBe(t0);
});

test('click a screen to enlarge it', async ({ page }) => {
  await open(page);
  for (const id of ['entry', 'cr.person', 'fl.certificate', 'out.cr.submitted']) {
    await page.getByTestId(`simple-open-${id}`).evaluate((b) => (b as HTMLButtonElement).click());
    const big = page.getByTestId('simple-enlarged');
    await expect(big.getByTestId('merchant-frame')).toBeVisible();
    const box = (await big.getByTestId('merchant-frame').boundingBox())!;
    expect(box.width).toBeGreaterThan(900);
    await page.keyboard.press('Escape');
    await expect(big).toHaveCount(0);
  }
});

for (const j of SIMPLE_JOURNEYS) {
  test(`highlight: ${j.title}`, async ({ page }) => {
    await open(page);
    await page.getByTestId('simple-journey').selectOption(j.id);
    for (const n of SIMPLE_NODES) {
      const node = page.getByTestId(`simple-node-${n.id}`);
      if (j.nodes.includes(n.id)) await expect(node, n.id).not.toHaveClass(/opacity-20/);
      else await expect(node, n.id).toHaveClass(/opacity-20/);
    }
  });
}

test('export layout: no overlaps, labels clear, arrows never cross a screen', async ({ page }) => {
  await page.goto('./#/simple/export');
  await page.waitForFunction('window.__SIMPLE_READY__ === true', undefined, { timeout: 60_000 });
  expect((await page.evaluate(probe)) as string[]).toEqual([]);
});

test('simplified exports are downloadable', async ({ request, baseURL }) => {
  for (const [f, type] of [
    ['Madfu_Onboarding_Simplified_Master_Board.pdf', 'pdf'],
    ['Madfu_Onboarding_Simplified_Master_Board.svg', 'svg'],
  ]) {
    const res = await request.get(`${baseURL}${f}`);
    expect(res.status(), f).toBe(200);
    expect(res.headers()['content-type']).toContain(type);
  }
});

test('navigation: Detailed Workflow and Interactive Journey remain available; old deep links still open the workflow', async ({ page }) => {
  await open(page);
  await page.getByTestId('nav-detailed-workflow').click();
  await expect(page.getByTestId('master-board')).toBeVisible();
  await page.goto('./#/?journey=cr-all-verified');
  await expect(page).toHaveURL(/#\/detailed\?journey=cr-all-verified/);
  await expect(page.getByTestId('board-journey-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('nav-interactive-journey').click();
  await expect(page.getByTestId('merchant-frame')).toBeVisible();
});
