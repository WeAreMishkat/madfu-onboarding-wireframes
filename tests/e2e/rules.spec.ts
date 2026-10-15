import { expect, test } from '@playwright/test';
import { GALLERY_STATES } from '../../src/journeys/galleryStates';
import { JOURNEY_MAPS } from '../../src/journeys/maps';
import { SCREENS } from '../../src/journeys/screens';
import { driveUntil, expectScreen, fastSim, getApp, loadScenario } from './helpers';

test.beforeEach(async ({ page }) => {
  await fastSim(page);
});

test('entry: required-field and format validation block the transition', async ({ page }) => {
  await page.goto('./#/prototype/start');
  await page.getByTestId('restart-demo').click();
  await page.getByTestId('entry-next').click();
  await expect(page.getByTestId('error-summary')).toContainText('Please fix 4 fields');
  await expectScreen(page, 'S01');
  await page.getByTestId('merchant-frame').getByText('Registered Business', { exact: true }).click();
  await page.getByTestId('identification').fill('12345');
  await page.getByTestId('revenue').selectOption('R_100K_20M');
  await page.getByTestId('mobile').fill('12345');
  await page.getByTestId('entry-next').click();
  await expect(page.getByTestId('merchant-frame').getByRole('alert').filter({ hasText: 'Enter a valid Commercial Registration number (10 digits).' }).last()).toBeVisible();
  await expect(page.getByTestId('merchant-frame').getByRole('alert').filter({ hasText: 'Enter a valid Saudi mobile number' }).last()).toBeVisible();
  await expectScreen(page, 'S01');
});

test('entry: applicant type switches the identification field and resets it', async ({ page }) => {
  await page.goto('./#/prototype/start');
  await page.getByTestId('restart-demo').click();
  await page.getByTestId('merchant-frame').getByText('Registered Business', { exact: true }).click();
  await expect(page.getByText('Commercial Registration Number (CR)')).toBeVisible();
  await page.getByTestId('identification').fill('1010000001');
  await page.getByTestId('merchant-frame').getByText('Freelancer', { exact: true }).click();
  await expect(page.getByText('National ID Number')).toBeVisible();
  await expect(page.getByTestId('identification')).toHaveValue('');
  await expect(page.getByTestId('merchant-frame').getByText(/certificate number/i)).toHaveCount(0); // certificate is not requested at entry
});

test('revenue routing: CR outside range never sees self-onboarding screens', async ({ page }) => {
  await loadScenario(page, 'cr-above-revenue');
  await driveUntil(page, 'O-C');
  await expect(page.getByText('Thank you for your interest in Madfu.')).toBeVisible();
  const app = await getApp(page);
  expect(app.audit.some((a: { detail: string }) => a.detail.includes('→ S03'))).toBe(false);
});

test('duplicate detection: identity checked before mobile, mobile skipped', async ({ page }) => {
  await loadScenario(page, 'cr-duplicate');
  await driveUntil(page, 'S01-X');
  const types = (await getApp(page)).audit.map((a: { type: string }) => a.type);
  expect(types.indexOf('DUPLICATE_CHECK_1_IDENTITY')).toBeLessThan(types.indexOf('DUPLICATE_CHECK_2_MOBILE'));
  await expect(page.getByTestId('audit-log')).toContainText('SKIPPED', { useInnerText: false });
});

test('authorized persons: individuals only, masked, single select', async ({ page }) => {
  await loadScenario(page, 'cr-all-verified');
  await driveUntil(page, 'S05');
  const rows = page.getByTestId('persons-list').locator('[role=button]');
  await expect(rows).toHaveCount(3); // 2 entities filtered out
  await expect(page.getByText('Sample Holding Company')).toHaveCount(0);
  await expect(page.getByTestId('persons-continue')).toBeDisabled();
  await expect(rows.first().getByTestId('person-name')).toHaveText(/^Faisal •+ •+ Al-Sample$/);
  await expect(rows.first().getByTestId('person-id')).toHaveText('National ID 100••••011');
  await rows.nth(0).click();
  await rows.nth(1).click();
  await expect(page.getByTestId('persons-list').locator('[aria-pressed=true]')).toHaveCount(1);
  await expect(rows.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('nafath: two-digit number shown; failure disables the contract', async ({ page }) => {
  await loadScenario(page, 'cr-nafath-timeout-twice');
  await page.evaluate(() => {
    const k = 'madfu-demo:sim:v1';
    localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)!), nafathAutoResolveMs: 0 }));
  });
  await page.reload();
  await driveUntil(page, 'S06');
  await page.getByTestId('nafath-send').click();
  await expect(page.getByTestId('nafath-number')).toHaveText(/^\d{2}$/);
  await page.getByTestId('dev-nafath-timeout').click();
  await page.getByTestId('nafath-retry').click();
  await page.getByTestId('dev-nafath-timeout').click();
  await page.getByTestId('nafath-continue-manual').click();
  await expectScreen(page, 'S08');
  await expect(page.getByTestId('internal-contract')).toContainText('not eligible');
  await driveUntil(page, 'O-B');
  expect((await getApp(page)).contract.status).toBe('not_available');
});

test('certificates: single select, attached certificate cannot be chosen', async ({ page }) => {
  await loadScenario(page, 'fl-all-verified');
  await page.getByTestId('sim-certs').selectOption('attached');
  await driveUntil(page, 'S07');
  const attached = page.getByTestId('cert-FL-000000106');
  await expect(attached).toHaveAttribute('aria-disabled', 'true');
  await attached.click({ force: true });
  await expect(attached).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('cert-list').locator('[aria-pressed=true]')).toHaveCount(1);
});

test('back navigation keeps verified OTP; refresh keeps progress', async ({ page }) => {
  await loadScenario(page, 'cr-all-verified');
  await driveUntil(page, 'S03');
  await page.getByTestId('back').click();
  await expectScreen(page, 'S01');
  await page.getByTestId('entry-next').click();
  await expectScreen(page, 'S03'); // OTP not requested again for the unchanged mobile
  await page.reload();
  await expectScreen(page, 'S03');
  await page.goBack(); // browser Back = the screen's permitted Back action (S03 → S01)
  await expectScreen(page, 'S01');
  expect((await getApp(page)).otp.status).toBe('verified');
});

test('deep link to a later screen redirects to the current step', async ({ page }) => {
  await page.goto('./#/prototype/start');
  await page.getByTestId('restart-demo').click();
  await page.goto('./#/prototype/contract');
  await expectScreen(page, 'S01');
  await expect(page).toHaveURL(/#\/prototype\/start$/);
});

test('editing the IBAN invalidates its verification result', async ({ page }) => {
  await loadScenario(page, 'cr-all-verified');
  await driveUntil(page, 'S08');
  await page.getByTestId('iban').focus();
  await page.getByTestId('iban').blur();
  await expect(page.getByTestId('iban-status-verified')).toBeVisible();
  await page.getByTestId('iban').fill('SA0380000000000000000002');
  await expect(page.getByTestId('iban-status-verified')).toHaveCount(0);
});

test('completed application cannot be resubmitted', async ({ page }) => {
  await loadScenario(page, 'cr-below-revenue');
  await driveUntil(page, 'O-C');
  await page.goto('./#/prototype/start');
  await expectScreen(page, 'O-C');
  await page.goBack();
  await expectScreen(page, 'O-C');
  expect((await getApp(page)).submission.state).toBe('submitted');
});

test('every screen has a gallery state and every gallery state renders', async ({ page }) => {
  test.setTimeout(240_000);
  for (const s of SCREENS)
    expect(
      GALLERY_STATES.some((g) => g.screen === s.id),
      s.id,
    ).toBe(true);
  for (const g of GALLERY_STATES) {
    await page.goto(`./#/gallery/${g.id}`);
    await expect(page.getByTestId('merchant-frame')).toBeVisible();
    const expected = g.screen;
    await expect(page.getByTestId('merchant-frame')).toHaveAttribute('data-screen-id', expected);
    await expect(page.getByTestId('annotation')).toContainText(g.screen);
  }
});

test('documentation routes render (maps, rules, handover, overview)', async ({ page }) => {
  await page.goto('./#/overview');
  await expect(page.getByTestId('global-ux-note')).toContainText('All screens require complete UX/UI validation');
  for (const m of JOURNEY_MAPS) {
    await page.goto(`./#/map/${m.id}`);
    await expect(page.getByTestId('journey-map').locator('svg')).toBeVisible({ timeout: 20_000 });
  }
  await page.goto('./#/docs/rules');
  await expect(page.getByTestId('table-contract')).toBeVisible();
  await page.goto('./#/docs/decisions');
  await expect(page.getByTestId('table-decisions')).toContainText('D-01');
  await page.goto('./#/docs/handover');
  await expect(page.getByTestId('table-inventory')).toContainText('S09-D');
});

test('PDF download is available', async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}Madfu_Merchant_Onboarding_Wireframes.pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('pdf');
  expect((await res.body()).length).toBeGreaterThan(500_000);
});

test('stored data stays synthetic', async ({ page }) => {
  await loadScenario(page, 'fl-all-verified');
  await driveUntil(page, 'O-A');
  const stored = await page.evaluate(() => localStorage.getItem('madfu-demo:application:v1')!);
  const app = JSON.parse(stored);
  expect(app.synthetic).toBe(true);
  expect(app.entry.identification).toMatch(/^10000000\d\d$|^10100000\d\d$/);
  expect(app.entry.mobile).toMatch(/^50000000\d$/);
});
