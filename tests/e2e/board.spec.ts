/**
 * Master Board — browser checks (the 13 quality checks of the board brief).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { BOARD_EDGES, BOARD_NODES } from '../../src/board/model';
import { SCENARIOS } from '../../src/scenarios/scenarios';

const probe = readFileSync(resolve(import.meta.dirname, 'overlap-probe.js'), 'utf8');
const screenNodes = BOARD_NODES.filter((n) => n.screenId);

async function openBoard(page: Page, query = '') {
  await page.goto(`./#/${query}`);
  await expect(page.getByTestId('master-board')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
}

const viewportTransform = (page: Page) => page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);

test('board is the home page and renders every node, connection and live wireframe', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId('nav-master-board')).toHaveClass(/bg-white/);
  await expect(page.locator('.react-flow__node')).toHaveCount(BOARD_NODES.length + 7); // + 5 lanes, header, assumptions
  await expect(page.locator('.react-flow__edge')).toHaveCount(BOARD_EDGES.length);
  for (const n of screenNodes) await expect(page.getByTestId(`board-mini-${n.id}`).getByTestId('merchant-frame'), n.id).toHaveCount(1);
  await expect(page.getByTestId('board-assumptions')).toContainText('D-01');
});

test('exported board: no node overlaps and no label covers a node or another label', async ({ page }) => {
  await page.goto('./#/board/export');
  await page.waitForFunction('window.__BOARD_READY__ === true', undefined, { timeout: 60_000 });
  const problems = (await page.evaluate(probe)) as string[];
  expect(problems).toEqual([]);
});

test('search finds screens and decisions and opens their details', async ({ page }) => {
  await openBoard(page);
  await page.getByTestId('board-search').fill('authorized');
  await page.getByTestId('board-search-results').getByRole('button').first().click();
  await expect(page.getByTestId('board-details-title')).toHaveText('Authorized person selection');
  await expect(page).toHaveURL(/node=cr\.S05/);
  await page.getByTestId('board-search').fill('Contract eligible');
  await page.getByTestId('board-search-results').getByRole('button').first().click();
  await expect(page.getByTestId('board-details')).toContainText('Nafath verified AND no blocking');
  await expect(page.getByTestId('board-details-next')).toContainText('Eligible');
});

test('details panel lists purpose, fields, validations, actions, next destinations; preview opens and keeps board position', async ({ page }) => {
  await openBoard(page, '?node=cr.S08');
  const panel = page.getByTestId('board-details');
  for (const t of [
    'PURPOSE',
    'ENTRY CONDITIONS',
    'REQUIRED FIELDS',
    'VALIDATIONS',
    'BACKEND INTEGRATION',
    'AVAILABLE ACTIONS',
    'NEXT DESTINATIONS',
    'FAILURE SCENARIOS',
    'UX/UI NOTES',
  ])
    await expect(panel).toContainText(t);
  const before = await viewportTransform(page);
  await page.getByTestId('board-open-preview').click();
  await expect(page.getByTestId('board-preview').getByTestId('merchant-frame')).toHaveAttribute('data-screen-id', 'S08');
  await page.getByTestId('board-preview-close').click();
  await expect(page.getByTestId('board-preview')).toHaveCount(0);
  expect(await viewportTransform(page)).toBe(before);
});

test('every screen node preview opens', async ({ page }) => {
  test.setTimeout(120_000);
  await openBoard(page);
  for (const n of screenNodes) {
    await page.getByTestId(`board-preview-${n.id}`).evaluate((b) => (b as HTMLButtonElement).click());
    await expect(page.getByTestId('board-preview').getByTestId('merchant-frame'), n.id).toHaveAttribute('data-screen-id', n.screenId!);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('board-preview')).toHaveCount(0);
  }
});

test('zoom, pan and fit change the viewport', async ({ page }) => {
  await openBoard(page);
  const t0 = await viewportTransform(page);
  await page.locator('.react-flow__controls-zoomin').click();
  await page.waitForTimeout(300);
  const t1 = await viewportTransform(page);
  expect(t1).not.toBe(t0);
  const pane = page.locator('.react-flow__pane');
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + box.width - 200, box.y + box.height - 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 500, box.y + box.height - 350, { steps: 8 });
  await page.mouse.up();
  const t2 = await viewportTransform(page);
  expect(t2).not.toBe(t1);
  await page.getByTestId('board-fit').click();
  await page.waitForTimeout(600);
  expect(await viewportTransform(page)).not.toBe(t2);
});

test('sub-flows collapse and reset restores everything', async ({ page }) => {
  await openBoard(page);
  await page.getByTestId('board-lane-toggle-fl').uncheck();
  await expect(page.getByTestId('board-node-fl.S07')).toHaveCount(0);
  await expect(page.getByTestId('board-node-cr.S05')).toHaveCount(1);
  await page.getByTestId('board-compact').click();
  await expect(page.getByTestId('board-mini-cr.S05')).toContainText('compact view');
  await page.getByTestId('board-reset').click();
  await expect(page.getByTestId('board-node-fl.S07')).toHaveCount(1);
  await expect(page.getByTestId('board-mini-cr.S05').getByTestId('merchant-frame')).toHaveCount(1);
});

for (const s of SCENARIOS) {
  test(`journey highlight #${s.id} — ${s.title}`, async ({ page }) => {
    await openBoard(page, `?journey=${s.key}`);
    const panel = page.getByTestId('board-journey-panel');
    await expect(panel).toContainText('Step 1 /');
    await expect(panel).toContainText('Outcome:');
    // the start node carries the JOURNEY START marker; at least one other node is dimmed
    await expect(page.locator('.react-flow__node').filter({ hasText: 'JOURNEY START' })).toHaveCount(1);
    await expect(page.locator('.react-flow__node').filter({ hasText: 'JOURNEY END' })).toHaveCount(1);
    expect(await page.locator('[data-testid^="board-node-"].opacity-\\[0\\.16\\]').count()).toBeGreaterThan(0);
    const total = Number((await page.getByTestId('board-step').innerText()).split('/')[1]);
    await page.getByTestId('board-next').click();
    await expect(page.getByTestId('board-step')).toContainText(`Step 2 / ${total}`);
    await page.getByTestId('board-prev').click();
    await expect(page.getByTestId('board-step')).toContainText(`Step 1 / ${total}`);
  });
}

test('journey step navigation reaches the outcome', async ({ page }) => {
  await openBoard(page, '?journey=cr-all-verified');
  const total = Number((await page.getByTestId('board-step').innerText()).split('/')[1]);
  for (let i = 1; i < total; i++) await page.getByTestId('board-next').click();
  await expect(page.getByTestId('board-step-node')).toContainText('O-A Submitted');
  await expect(page.getByTestId('board-next')).toBeDisabled();
});

test('prototype links work from the board', async ({ page, context }) => {
  await openBoard(page, '?journey=fl-all-verified');
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Run in prototype ↗' }).click()]);
  await popup.waitForLoadState();
  await expect(popup.getByTestId('merchant-frame')).toHaveAttribute('data-screen-id', 'S01');
  await expect(popup.getByTestId('active-scenario')).toContainText('#11');
  await page.getByTestId('nav-interactive-journey').click();
  await expect(page.getByTestId('merchant-frame')).toBeVisible();
});

test('board exports are downloadable', async ({ request, baseURL }) => {
  for (const [f, type] of [
    ['Madfu_Onboarding_Master_Board.pdf', 'pdf'],
    ['Madfu_Onboarding_Master_Board.svg', 'svg'],
  ]) {
    const res = await request.get(`${baseURL}${f}`);
    expect(res.status(), f).toBe(200);
    expect(res.headers()['content-type'], f).toContain(type);
  }
});

test('coverage page reports zero problems', async ({ page }) => {
  await page.goto('./#/docs/coverage');
  await expect(page.getByTestId('coverage-problems')).toHaveText('0', { timeout: 20_000 });
  await expect(page.getByTestId('coverage-journeys')).toHaveText(String(SCENARIOS.length));
});
