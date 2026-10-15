/**
 * Runs every ready-made scenario through the REAL screens: the scenario is
 * loaded from Prototype Controls, then the test clicks the same controls a
 * reviewer would. Final screen, internal statuses and flags are asserted and
 * a screenshot of the end state is captured.
 */
import { expect, test } from '@playwright/test';
import { SCENARIOS } from '../../src/scenarios/scenarios';
import { SYNTHETIC_IBANS } from '../../src/mocks/fixtures';
import { driveUntil, expectScreen, fastSim, getApp, internalStatuses, loadScenario } from './helpers';

const custom: Record<string, (page: import('@playwright/test').Page) => Promise<void>> = {
  'cr-nafath-rejected-twice': async (page) => {
    await driveUntil(page, 'S05');
    await page.getByTestId('person-P-01').click();
    await page.getByTestId('persons-continue').click();
    await page.getByTestId('nafath-send').click();
    await expect(page.getByTestId('nafath-failed-rejected')).toBeVisible();
    await expect(page.getByTestId('nafath-remaining')).toContainText('1 of 2');
    await page.getByTestId('nafath-change-person').click();
    await expectScreen(page, 'S05');
    await expect(page.getByTestId('persons-attempts')).toContainText('1 of 2');
    await page.getByTestId('person-P-02').click();
    await page.getByTestId('persons-continue').click();
    await page.getByTestId('nafath-send').click();
    await expect(page.getByTestId('nafath-exhausted')).toBeVisible();
    const app = await getApp(page);
    expect(app.nafath.attempts.map((a: { personId: string }) => a.personId)).toEqual(['P-01', 'P-02']);
    await driveUntil(page, 'O-B');
  },
  'cr-iban-failed-twice': async (page) => {
    await driveUntil(page, 'S08');
    await page.getByTestId('iban').focus();
    await page.getByTestId('iban').blur();
    await expect(page.getByTestId('iban-status-not-verified')).toBeVisible();
    await page.getByTestId('business-next').click();
    await expectScreen(page, 'S08'); // first failure blocks until corrected / retried
    await page.getByTestId('iban').fill(SYNTHETIC_IBANS.secondary);
    await page.getByTestId('iban').blur();
    await expect(page.getByTestId('iban-status-failed-max')).toBeVisible();
    await page.getByTestId('business-next').click();
    await expectScreen(page, 'S09'); // IBAN failure does not block the contract
    await driveUntil(page, 'O-A');
  },
  'fl-duplicate': async (page) => {
    await driveUntil(page, 'S01-X');
    await page.getByTestId('add-certificate-link').click();
    await expectScreen(page, 'S01-F');
    await page.getByTestId('back').click();
    await expectScreen(page, 'S01-X');
  },
  'fl-manual-certificate': async (page) => {
    await driveUntil(page, 'S07-M');
    await page.getByTestId('cert-manual-input').fill('123');
    await page.getByTestId('cert-manual-continue').click();
    await expect(page.getByRole('alert').filter({ hasText: 'valid freelancing certificate number' })).toBeVisible();
    await page.getByTestId('cert-manual-input').fill('FL-000000106');
    await page.getByTestId('cert-manual-continue').click();
    await expect(page.getByRole('alert').filter({ hasText: 'already linked' })).toBeVisible();
    await driveUntil(page, 'O-B');
  },
  'any-otp-errors': async (page) => {
    await driveUntil(page, 'S02');
    await page.getByTestId('dev-otp-failure').click();
    await expect(page.getByRole('alert').filter({ hasText: '2 attempts remaining' })).toBeVisible();
    await page.getByTestId('dev-otp-expire').click();
    await page.getByTestId('dev-otp-failure').click();
    await expect(page.getByRole('alert').filter({ hasText: 'expired' })).toBeVisible();
    expect((await getApp(page)).otp.incorrectAttempts).toBe(1);
    await page.getByTestId('dev-otp-resend').click();
    await expect(page.getByText('A new code has been sent.')).toBeVisible();
    await page.getByTestId('dev-otp-failure').click();
    await expect(page.getByRole('alert').filter({ hasText: '1 attempt remaining' })).toBeVisible();
    await page.getByTestId('dev-otp-failure').click();
  },
  'any-resume': async (page) => {
    await expectScreen(page, 'S00');
    await page.getByTestId('resume-continue').click();
    await expectScreen(page, 'S08');
    await expect(page.getByTestId('maps')).toHaveValue('https://maps.app.goo.gl/demo-branch');
    await page.reload();
    await expectScreen(page, 'S08');
    await expect(page.getByTestId('maps')).toHaveValue('https://maps.app.goo.gl/demo-branch');
    await driveUntil(page, 'O-A');
  },
  'any-contract-declined': async (page) => {
    await driveUntil(page, 'S09');
    await page.getByTestId('contract-decline').click();
    await page.getByTestId('decline-confirm').click();
    await expectScreen(page, 'S09-D');
    expect((await getApp(page)).submission.state).toBe('draft');
  },
  'any-api-failure-retry': async (page) => {
    await driveUntil(page, 'S04');
    await expect(page.getByTestId('gov-unavailable')).toBeVisible();
    await page.getByTestId('gov-retry').click();
    await expect(page.getByTestId('gov-valid')).toBeVisible();
    await page.getByTestId('gov-continue').click();
    await expect(page.getByTestId('persons-unavailable')).toBeVisible();
    await page.getByTestId('persons-retry').click();
    await driveUntil(page, 'O-A');
  },
};

for (const s of SCENARIOS) {
  test(`scenario #${s.id} — ${s.title}`, async ({ page }, info) => {
    await fastSim(page);
    await loadScenario(page, s.key);
    await expect(page.getByTestId('active-scenario')).toContainText(`#${s.id}`);
    if (custom[s.key]) await custom[s.key](page);
    else await driveUntil(page, s.expected.finalScreen);
    await expectScreen(page, s.expected.finalScreen);
    const statuses = await internalStatuses(page);
    for (const st of s.expected.statuses ?? []) expect(statuses, `status ${st}`).toContain(st);
    const app = await getApp(page);
    const flags = app.flags.map((f: { code: string }) => f.code);
    for (const f of s.expected.flags ?? []) expect(flags, `flag ${f}`).toContain(f);
    if (s.expected.noPaidCalls) expect(app.costLedger).toHaveLength(0);
    expect(app.synthetic).toBe(true);
    await page.getByTestId('merchant-frame').screenshot({ path: info.outputPath(`scenario-${String(s.id).padStart(2, '0')}-${s.expected.finalScreen}.png`) });
  });
}
