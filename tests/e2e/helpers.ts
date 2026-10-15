import { expect, type Page } from '@playwright/test';

export const SIM_KEY = 'madfu-demo:sim:v1';

/** Fast, deterministic simulator timings for tests (only if the test hasn't set its own). */
export async function fastSim(page: Page, nafathAutoResolveMs = 150) {
  await page.addInitScript(
    ([key, ms]) => {
      const raw = localStorage.getItem(key as string);
      const sim = raw ? JSON.parse(raw) : {};
      if (!('__e2e' in sim)) localStorage.setItem(key as string, JSON.stringify({ ...sim, latencyMs: 0, nafathAutoResolveMs: ms, __e2e: true }));
    },
    [SIM_KEY, nafathAutoResolveMs] as const,
  );
}

export const screenId = (page: Page) => page.getByTestId('merchant-frame').getAttribute('data-screen-id');

export async function expectScreen(page: Page, id: string) {
  await expect(page.getByTestId('merchant-frame')).toHaveAttribute('data-screen-id', id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getApp(page: Page): Promise<any> {
  return page.evaluate(() => (window as unknown as { __madfu: { getApp: () => unknown } }).__madfu.getApp());
}

export async function internalStatuses(page: Page): Promise<string[]> {
  return page.getByTestId('internal-statuses').locator('span').allInnerTexts();
}

export async function loadScenario(page: Page, key: string) {
  await page.goto('./#/prototype/start');
  await page.getByTestId('scenario-select').selectOption(key);
  await page.getByTestId('scenario-load').click();
}

const visible = async (page: Page, testId: string) =>
  page
    .getByTestId(testId)
    .first()
    .isVisible()
    .catch(() => false);

/**
 * Performs the default (forward) action for whatever screen is showing, using
 * the same controls a reviewer clicks. Returns false on a final / stop screen.
 */
export async function defaultStep(page: Page): Promise<boolean> {
  const id = await screenId(page);
  switch (id) {
    case 'S01':
      await page.getByTestId('entry-next').click();
      break;
    case 'S02':
      await page.getByTestId('otp-input').fill('123456');
      await page.getByTestId('otp-verify').click();
      break;
    case 'S03':
      await page.getByTestId('category-next').click();
      break;
    case 'S04':
      await expect(page.getByTestId('gov-loading')).toHaveCount(0);
      if (await visible(page, 'gov-retry')) await page.getByTestId('gov-retry').click();
      else await page.getByTestId('gov-continue').click();
      break;
    case 'S05':
      if (await visible(page, 'persons-none-continue')) await page.getByTestId('persons-none-continue').click();
      else if (await visible(page, 'persons-retry')) await page.getByTestId('persons-retry').click();
      else {
        await expect(page.getByTestId('persons-list')).toBeVisible();
        if (await page.getByTestId('persons-continue').isDisabled()) await page.getByTestId('persons-list').locator('[role=button]').first().click();
        await page.getByTestId('persons-continue').click();
      }
      break;
    case 'S06':
      if (await visible(page, 'nafath-send')) await page.getByTestId('nafath-send').click();
      else if (await visible(page, 'nafath-retry')) await page.getByTestId('nafath-retry').click();
      else if (await visible(page, 'nafath-continue')) await page.getByTestId('nafath-continue').click();
      else if (await visible(page, 'nafath-continue-manual')) await page.getByTestId('nafath-continue-manual').click();
      else await page.waitForTimeout(100); // waiting for auto-resolve
      break;
    case 'S07':
      if (await visible(page, 'cert-manual')) await page.getByTestId('cert-manual').click();
      else if (await visible(page, 'cert-retry')) await page.getByTestId('cert-retry').click();
      else {
        await expect(page.getByTestId('cert-list')).toBeVisible();
        if (await page.getByTestId('cert-continue').isDisabled()) await page.getByTestId('cert-list').locator('[role=button]:not([aria-disabled=true])').first().click();
        await page.getByTestId('cert-continue').click();
      }
      break;
    case 'S07-M':
      await page.getByTestId('cert-manual-input').fill('FL-000000201');
      await page.getByTestId('cert-manual-continue').click();
      break;
    case 'S08':
      if (await visible(page, 'iban-retry')) {
        await page.getByTestId('iban-retry').click();
      } else {
        await page.getByTestId('iban').focus();
        await page.getByTestId('iban').blur();
        await page.waitForTimeout(50);
        if (await visible(page, 'iban-retry')) break;
        await page.getByTestId('business-next').click();
      }
      break;
    case 'S09':
      await page.getByText('I have read and agree to the Madfu Merchant Agreement.').click();
      await page.getByTestId('contract-accept').click();
      break;
    default:
      return false;
  }
  return true;
}

export async function driveUntil(page: Page, target: string, maxSteps = 50) {
  for (let i = 0; i < maxSteps; i++) {
    const id = await screenId(page);
    if (id === target) return;
    const more = await defaultStep(page);
    if (!more) break;
    await page.waitForTimeout(30);
  }
  await expectScreen(page, target);
}
