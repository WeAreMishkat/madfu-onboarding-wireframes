/**
 * Journey driver — advances a (sandboxed) engine along the "default" action of
 * each screen until a target screen is reached. Used to build gallery / PDF
 * states, the resume scenario, and unit tests, so every rendered state is a
 * state the real engine can actually produce.
 */
import type { JourneyEngine } from './engine';
import type { ScreenId } from '../state/types';
import { eligibleIndividuals } from '../rules/decisions';
import { SYNTHETIC_IBANS } from '../mocks/fixtures';

export async function step(engine: JourneyEngine): Promise<void> {
  const app = engine.app;
  switch (app.screen) {
    case 'S01':
      return engine.submitEntry();
    case 'S02':
      return engine.verifyOtp(app.otp.simulatedCode ?? '');
    case 'S03':
      if (!app.category.subcategoryId) engine.selectCategory('C10', 'C10-01');
      return engine.submitCategory();
    case 'S04':
      if (app.gov.status === 'idle') return engine.lookupCr();
      if (app.gov.status === 'unavailable' || app.gov.status === 'provider_error') return engine.lookupCr(true);
      return engine.continueFromCr();
    case 'S05': {
      if (app.gov.personsStatus !== 'loaded') return engine.loadPersons();
      const people = eligibleIndividuals(app.gov.record?.relatedParties ?? []);
      if (!people.length) return engine.continueWithoutEligiblePerson();
      if (!app.persons.selectedId) engine.selectPerson(people[0].partyId);
      return engine.submitPerson();
    }
    case 'S06':
      if (app.nafath.status === 'waiting') return engine.resolveNafath();
      if (app.nafath.result !== 'not_started') return engine.continueAfterNafath();
      if (app.nafath.status === 'result') return engine.retryNafath();
      return engine.startNafath();
    case 'S07': {
      if (app.certificates.status !== 'loaded') return engine.loadCertificates();
      const selectable = app.certificates.list.filter((c) => !c.attachedToExistingAccount);
      if (!selectable.length) return engine.enterCertificateManually();
      if (!app.certificates.selectedNumber) engine.selectCertificate(selectable[0].certificateNumber);
      return engine.submitCertificate();
    }
    case 'S07-M':
      if (!app.certificates.manualNumber) engine.updateManualCertificate('FL-000000201');
      return engine.submitManualCertificate();
    case 'S08':
      if (!app.business.iban) engine.updateBusiness({ iban: SYNTHETIC_IBANS.primary });
      if (!engine.app.business.vatRegistered) engine.updateBusiness({ vatRegistered: 'no' });
      if (!engine.app.business.channel) engine.updateBusiness({ channel: 'online', websiteUrl: 'https://sample-store.example' });
      if (engine.app.iban.status === 'not_verified' || engine.app.iban.status === 'technical_error') return engine.verifyIban(true);
      return engine.submitBusiness();
    case 'S09':
      return engine.acceptContract(true);
    case 'S09-D':
      return engine.reviewContractAgain();
    default:
      return;
  }
}

/** Advance until `target` (or a final / stuck state). Returns the screen reached. */
export async function driveTo(engine: JourneyEngine, target: ScreenId, maxSteps = 60): Promise<ScreenId> {
  let lastKey = '';
  let stuck = 0;
  for (let i = 0; i < maxSteps && engine.app.screen !== target; i++) {
    if (engine.app.submission.state === 'submitted') break;
    await step(engine);
    const key = `${engine.app.screen}|${engine.app.updatedAt}|${engine.app.audit.length}`;
    stuck = key === lastKey ? stuck + 1 : 0;
    lastKey = key;
    if (stuck > 2) break;
  }
  return engine.app.screen;
}
