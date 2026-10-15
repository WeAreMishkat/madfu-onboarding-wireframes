/**
 * JOURNEY ENGINE — explicit, deterministic state machine for the onboarding.
 *
 * Every user action is a command on this class. Commands validate, call mock
 * integrations through typed adapters, apply decision functions from
 * `rules/decisions.ts`, and move `application.screen`. Screens never decide
 * where to go next; they only call commands.
 */
import { GOV_POLICY, IBAN_POLICY, NAFATH_POLICY, OTP_POLICY, type PaidService } from '../rules/config';
import {
  IBAN_PROGRESSABLE,
  contractEligibility,
  decideCategory,
  eligibleIndividuals,
  ibanMatchTarget,
  maskName,
  maskNationalId,
  nafathExhausted,
  normaliseIban,
  normaliseMobile,
  reconcileCertificate,
  routeByRevenue,
  shouldCallIbanOwnership,
  validateBusiness,
  validateCertificateNumber,
  validateEntry,
  validateIbanFormat,
} from '../rules/decisions';
import { findSubcategory } from '../rules/categories';
import { addToSubmittedRegistry, type Services } from '../mocks/services';
import type { Application, FlagCode, ScreenId } from '../state/types';
import { createApplication, type Store } from '../state/store';

export interface EngineOptions {
  /** Sandboxed engines (gallery, print) never write to the demo identity registry. */
  sandbox?: boolean;
}

const nowIso = () => new Date().toISOString();

/** Where "Back" goes from the current state (undefined = no back action). */
export function backTarget(app: Application): ScreenId | undefined {
  if (app.submission.state === 'submitted') return undefined;
  switch (app.screen) {
    case 'S02':
    case 'S03':
    case 'S01-X':
      return 'S01';
    case 'S01-F':
      return 'S01-X';
    case 'S04':
      return app.gov.status === 'loading' ? undefined : 'S03';
    case 'S05':
      return app.gov.personsStatus === 'loading' ? undefined : 'S04';
    case 'S06':
      if (app.nafath.status === 'waiting' || app.nafath.result !== 'not_started' || app.ui.busy) return undefined;
      if (app.entry.applicantType === 'CR') return 'S05';
      return app.nafath.attempts.length === 0 ? 'S03' : undefined;
    case 'S07':
      return 'S06';
    case 'S07-M':
      return app.nafath.result === 'verified' ? 'S07' : 'S06';
    case 'S08':
      if (app.entry.applicantType === 'CR') return app.nafath.notPossibleReason ? 'S05' : 'S06';
      return app.certificates.source === 'MANUAL_ENTRY' ? 'S07-M' : 'S07';
    case 'S09':
      return 'S08';
    case 'S09-D':
      return 'S09';
    default:
      return undefined;
  }
}

export class JourneyEngine {
  constructor(
    private store: Store<Application>,
    private services: Services,
    private options: EngineOptions = {},
  ) {}

  get app() {
    return this.store.get();
  }

  // ---------- internals ----------

  private mutate(fn: (d: Application) => void) {
    const d = structuredClone(this.store.get());
    fn(d);
    d.updatedAt = nowIso();
    this.store.set(d);
  }
  private log(d: Application, type: string, detail: string) {
    d.audit.push({ at: nowIso(), type, detail });
  }
  private flag(d: Application, code: FlagCode, detail: string) {
    if (!d.flags.some((f) => f.code === code)) d.flags.push({ code, detail, at: nowIso() });
    this.log(d, 'FLAG', `${code} — ${detail}`);
  }
  private cost(d: Application, service: PaidService, detail: string) {
    d.costLedger.push({ service, at: nowIso(), detail });
  }
  private go(d: Application, screen: ScreenId) {
    if (d.screen !== screen) this.log(d, 'NAVIGATE', `${d.screen} → ${screen}`);
    d.screen = screen;
    d.ui.errors = {};
    d.ui.notice = undefined;
    d.ui.busy = undefined;
    d.ui.showDeclineConfirm = false;
  }
  private get final() {
    return this.app.submission.state === 'submitted';
  }

  // ---------- generic ----------

  restart() {
    this.store.set(createApplication());
  }

  back() {
    const target = backTarget(this.app);
    if (!target) return;
    this.mutate((d) => {
      if (d.screen === 'S09-D') d.contract.status = 'pending';
      if (target === 'S06' && d.nafath.status === 'result' && d.nafath.result === 'not_started') d.nafath.status = 'idle';
      this.go(d, target);
    });
  }

  dismissNotice() {
    this.mutate((d) => (d.ui.notice = undefined));
  }

  showNotice(text: string) {
    this.mutate((d) => (d.ui.notice = text));
  }

  /** Re-entry after the resume prompt. Bounded integration retries get a fresh allowance. */
  resume() {
    this.mutate((d) => {
      if (d.gov.status === 'gave_up') {
        d.gov.status = 'unavailable';
        d.gov.manualRetries = 0;
      }
      this.log(d, 'RESUMED', `Application resumed at ${d.screen}.`);
    });
  }

  // ---------- S01 Entry ----------

  updateEntry(patch: Partial<Application['entry']>) {
    if (this.final) return;
    const app = this.app;
    if (
      app.identityLocked &&
      ((patch.applicantType && patch.applicantType !== app.entry.applicantType) || (patch.identification !== undefined && patch.identification !== app.entry.identification))
    )
      return;
    const hadProgress = app.duplicate.identityChecked || app.otp.status !== 'not_sent';
    this.mutate((d) => {
      const prev = d.entry;
      const next = { ...prev, ...patch };
      const invalidated: string[] = [];
      if (patch.applicantType && patch.applicantType !== prev.applicantType && prev.applicantType) {
        next.identification = '';
        d.duplicate = { identityChecked: false, identityExists: false, mobileChecked: false, mobileLinkedAccounts: 0 };
        d.routing = {};
        d.category = { categoryId: d.category.categoryId, subcategoryId: d.category.subcategoryId };
        d.gov = { status: 'idle', calls: d.gov.calls, manualRetries: 0, personsStatus: 'idle', personsCalls: d.gov.personsCalls };
        d.persons = {};
        d.certificates = { status: 'idle', calls: d.certificates.calls, list: [] };
        d.iban = { ...d.iban, status: 'idle', checkedValue: undefined, lastResult: undefined };
        d.contract.status = 'not_available';
        invalidated.push('duplicate checks', 'routing', 'category decision', 'CR data', 'authorised person', 'certificates', 'IBAN verification');
      } else if (patch.identification !== undefined && patch.identification !== prev.identification) {
        d.duplicate = { ...d.duplicate, identityChecked: false, identityExists: false };
        d.gov = { status: 'idle', calls: d.gov.calls, manualRetries: 0, personsStatus: 'idle', personsCalls: d.gov.personsCalls };
        d.persons = {};
        d.certificates = { status: 'idle', calls: d.certificates.calls, list: [] };
        if (d.iban.status !== 'failed_max' && d.iban.status !== 'pending_provider') d.iban = { ...d.iban, status: 'idle', checkedValue: undefined, lastResult: undefined };
        invalidated.push('identity duplicate check', 'CR data', 'authorised person', 'certificates', 'IBAN verification');
      }
      if (patch.mobile !== undefined && normaliseMobile(patch.mobile) !== normaliseMobile(prev.mobile)) {
        d.otp = { status: 'not_sent', incorrectAttempts: 0, resendCount: 0, lastError: null };
        d.duplicate.mobileChecked = false;
        invalidated.push('mobile verification');
      }
      if (patch.revenueBand && patch.revenueBand !== prev.revenueBand) {
        d.routing = {};
        if (prev.revenueBand) invalidated.push('revenue routing');
      }
      d.entry = next;
      for (const key of Object.keys(patch)) delete d.ui.errors[key];
      if (invalidated.length && hadProgress) this.log(d, 'INVALIDATED', `Entry changed — reset: ${invalidated.join(', ')}.`);
    });
  }

  async submitEntry() {
    if (this.final || this.app.ui.busy) return;
    const errors = validateEntry(this.app.entry);
    if (Object.keys(errors).length) {
      this.mutate((d) => {
        d.ui.errors = errors;
        this.log(d, 'VALIDATION_FAILED', `S01: ${Object.keys(errors).join(', ')}`);
      });
      return;
    }
    const type = this.app.entry.applicantType!;
    const identification = this.app.entry.identification.trim();
    const mobile = normaliseMobile(this.app.entry.mobile);
    this.mutate((d) => {
      d.entry.identification = identification;
      d.entry.mobile = mobile;
      d.ui.errors = {};
      d.ui.busy = 'Checking your details…';
    });

    // Check 1 — existing identity (always first).
    const exists = await this.services.registry.identityExists(type, identification);
    this.mutate((d) => {
      d.duplicate.identityChecked = true;
      d.duplicate.identityExists = exists;
      this.log(d, 'DUPLICATE_CHECK_1_IDENTITY', `${type === 'CR' ? 'CR' : 'National ID'} ${maskNationalId(identification)} → ${exists ? 'ALREADY REGISTERED' : 'not registered'}`);
    });
    if (exists) {
      this.mutate((d) => {
        d.duplicate.mobileChecked = false;
        this.log(d, 'DUPLICATE_CHECK_2_MOBILE', 'SKIPPED — identity already registered; new application stopped.');
        this.go(d, 'S01-X');
      });
      return;
    }

    // Check 2 — mobile (informational: reuse across different identities is allowed).
    const linked = await this.services.registry.mobileLinkedAccounts(mobile);
    this.mutate((d) => {
      d.duplicate.mobileChecked = true;
      d.duplicate.mobileLinkedAccounts = linked;
      d.duplicate.checkedKey = `${type}|${identification}|${mobile}`;
      this.log(d, 'DUPLICATE_CHECK_2_MOBILE', `Mobile linked to ${linked} other account(s) — reuse allowed, not a rejection reason.`);
      if (linked > 0) this.flag(d, 'MOBILE_LINKED_TO_OTHER_ACCOUNTS', `Mobile used by ${linked} other account(s). Informational for account matching / risk.`);
    });

    if (this.app.otp.status === 'verified' && this.app.otp.verifiedMobile === mobile) {
      this.mutate((d) => {
        d.ui.busy = undefined;
        this.log(d, 'OTP_REUSED', 'Mobile unchanged and already verified in this application.');
      });
      await this.afterOtpVerified();
      return;
    }
    await this.sendOtp(false);
  }

  // ---------- S01-X Existing account ----------

  existingAccountSignIn() {
    this.showNotice('Sign-in to an existing account is outside the scope of this onboarding prototype.');
  }
  openAddCertificateFlow() {
    this.mutate((d) => this.go(d, 'S01-F'));
  }

  // ---------- S02 OTP ----------

  private async sendOtp(isResend: boolean) {
    this.mutate((d) => (d.ui.busy = isResend ? 'Sending a new code…' : 'Sending verification code…'));
    const { code, ttlSeconds } = await this.services.otp.send(this.app.entry.mobile);
    this.mutate((d) => {
      const now = Date.now();
      d.otp.status = 'sent';
      d.otp.simulatedCode = code;
      d.otp.sentAt = new Date(now).toISOString();
      d.otp.expiresAt = new Date(now + (ttlSeconds || OTP_POLICY.expirySeconds) * 1000).toISOString();
      d.otp.lastError = null;
      d.ui.resendAvailableAt = new Date(now + OTP_POLICY.resendCooldownSeconds * 1000).toISOString();
      if (isResend) {
        d.otp.resendCount += 1;
        if (OTP_POLICY.resendResetsAttempts) d.otp.incorrectAttempts = 0;
      }
      this.log(d, isResend ? 'OTP_RESENT' : 'OTP_SENT', `SMS OTP (simulated) to ${d.entry.countryCode} •••••${d.entry.mobile.slice(-3)}`);
      if (d.screen !== 'S02') this.go(d, 'S02');
      d.ui.busy = undefined;
      if (isResend) d.ui.notice = 'A new code has been sent.';
    });
  }

  async resendOtp(ignoreCooldown = false) {
    const app = this.app;
    if (app.otp.status !== 'sent' || app.ui.busy) return;
    if (app.otp.resendCount >= OTP_POLICY.maxResends) {
      this.showNotice('You have reached the maximum number of new codes. Please try again later or contact support.');
      return;
    }
    if (!ignoreCooldown && app.ui.resendAvailableAt && Date.now() < Date.parse(app.ui.resendAvailableAt)) return;
    await this.sendOtp(true);
  }

  async verifyOtp(code: string) {
    const app = this.app;
    if (app.otp.status !== 'sent' || app.ui.busy) return;
    if (!new RegExp(`^\\d{${OTP_POLICY.codeLength}}$`).test(code)) {
      this.mutate((d) => {
        d.otp.lastError = 'format';
        d.ui.errors = { otp: `Enter the ${OTP_POLICY.codeLength}-digit code.` };
      });
      return;
    }
    if (app.otp.expiresAt && Date.now() > Date.parse(app.otp.expiresAt)) {
      this.mutate((d) => {
        d.otp.lastError = 'expired';
        d.ui.errors = { otp: 'This code has expired. Request a new code to continue.' };
        this.log(d, 'OTP_EXPIRED', 'Expired code submitted — not counted as an incorrect attempt.');
      });
      return;
    }
    if (code === app.otp.simulatedCode) {
      this.mutate((d) => {
        d.otp.status = 'verified';
        d.otp.verifiedMobile = d.entry.mobile;
        d.otp.lastError = null;
        d.ui.errors = {};
        this.log(d, 'OTP_VERIFIED', 'Mobile number verified.');
      });
      await this.afterOtpVerified();
      return;
    }
    this.mutate((d) => {
      d.otp.incorrectAttempts += 1;
      d.otp.lastError = 'incorrect';
      const remaining = OTP_POLICY.maxIncorrectAttempts - d.otp.incorrectAttempts;
      this.log(d, 'OTP_INCORRECT', `Incorrect code (${d.otp.incorrectAttempts}/${OTP_POLICY.maxIncorrectAttempts}).`);
      if (remaining <= 0) {
        d.otp.status = 'locked';
        this.log(d, 'OTP_LOCKED', 'Maximum incorrect attempts reached — verification stopped.');
        this.go(d, 'S02-L');
      } else {
        d.ui.errors = { otp: `The code you entered is incorrect. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.` };
      }
    });
  }

  /** Development simulator only. */
  simulateOtpExpiry() {
    this.mutate((d) => {
      d.otp.expiresAt = new Date(Date.now() - 1000).toISOString();
      this.log(d, 'DEV_SIMULATOR', 'OTP expiry simulated.');
    });
  }

  editMobile() {
    this.mutate((d) => this.go(d, 'S01'));
  }

  private async afterOtpVerified() {
    const { applicantType, revenueBand } = this.app.entry;
    const journey = routeByRevenue(applicantType!, revenueBand!);
    this.mutate((d) => {
      d.routing = { journey, reason: `${applicantType} with revenue band ${revenueBand}` };
      this.log(d, 'REVENUE_ROUTING', `${applicantType} / ${revenueBand} → ${journey}`);
    });
    if (journey === 'SALES_LEAD') {
      this.mutate((d) => this.flag(d, 'SALES_LEAD_REVENUE', `Revenue band ${revenueBand} outside self-onboarding range for Registered Business.`));
      await this.submit('C_SALES_LEAD');
      return;
    }
    this.mutate((d) => this.go(d, 'S03'));
  }

  // ---------- S03 Category ----------

  selectCategory(categoryId: string | undefined, subcategoryId?: string) {
    if (this.final) return;
    this.mutate((d) => {
      if (findSubcategory(subcategoryId)?.category.categoryId !== categoryId) subcategoryId = undefined;
      d.category = { categoryId, subcategoryId };
      delete d.ui.errors.category;
      delete d.ui.errors.subcategory;
    });
  }

  async submitCategory() {
    const app = this.app;
    if (this.final) return;
    if (!app.category.categoryId || !app.category.subcategoryId) {
      this.mutate((d) => {
        d.ui.errors = {
          ...(!app.category.categoryId ? { category: 'Select a business category.' } : {}),
          subcategory: 'Select a subcategory.',
        };
      });
      return;
    }
    const decision = decideCategory(app.category.subcategoryId, app.entry.applicantType!);
    this.mutate((d) => {
      d.category.eligibility = decision.eligibility;
      d.category.decision = decision.decision;
      this.log(d, 'CATEGORY_DECISION', `${app.category.subcategoryId} (${decision.eligibility}) → ${decision.decision}. ${decision.reason}`);
      if (decision.flag) this.flag(d, decision.flag, decision.reason);
    });
    if (decision.decision === 'STOP_AS_LEAD') {
      await this.submit('C_SALES_LEAD');
      return;
    }
    if (app.entry.applicantType === 'CR') {
      const reuse = (app.gov.status === 'valid' || app.gov.status === 'expired') && app.gov.record?.crNumber === app.entry.identification;
      this.mutate((d) => this.go(d, 'S04'));
      if (!reuse) await this.lookupCr();
    } else {
      this.mutate((d) => {
        if (d.nafath.status === 'result' && d.nafath.result === 'not_started') d.nafath.status = 'idle';
        this.go(d, 'S06');
      });
    }
  }

  // ---------- S04 CR verification ----------

  async lookupCr(manual = false) {
    const app = this.app;
    if (this.final || app.gov.status === 'loading') return;
    if (manual && app.gov.manualRetries >= GOV_POLICY.maxManualRetries) return;
    this.mutate((d) => {
      if (manual) d.gov.manualRetries += 1;
      d.gov.status = 'loading';
    });
    const cr = this.app.entry.identification;
    let autoRetries = 0;
    for (;;) {
      const idx = this.app.gov.calls;
      this.mutate((d) => {
        d.gov.calls += 1;
        this.cost(d, 'GOV_CR_LOOKUP', `CR lookup call #${idx + 1}`);
      });
      const res = await this.services.gov.lookup(cr, idx);
      if (res.kind === 'unavailable' && autoRetries < GOV_POLICY.autoRetries) {
        autoRetries += 1;
        this.mutate((d) => this.log(d, 'GOV_AUTO_RETRY', `CR service unavailable — automatic retry ${autoRetries}/${GOV_POLICY.autoRetries}.`));
        continue;
      }
      this.mutate((d) => {
        const exhausted = d.gov.manualRetries >= GOV_POLICY.maxManualRetries;
        switch (res.kind) {
          case 'valid':
            d.gov.status = 'valid';
            d.gov.record = res.record;
            break;
          case 'expired':
            d.gov.status = 'expired';
            d.gov.record = res.record;
            this.flag(d, 'CR_EXPIRED', `CR ${maskNationalId(cr)} expired ${res.record.expiryDate}. Applicant may proceed; marked for review.`);
            break;
          case 'not_found':
            d.gov.status = 'not_found';
            break;
          case 'unavailable':
          case 'provider_error':
            d.gov.status = exhausted ? 'gave_up' : res.kind;
            break;
        }
        this.log(d, 'GOV_CR_LOOKUP', `Result: ${res.kind}${d.gov.status === 'gave_up' ? ' (retry limit reached — progress saved)' : ''}`);
      });
      break;
    }
  }

  async continueFromCr() {
    if (!['valid', 'expired'].includes(this.app.gov.status)) return;
    this.mutate((d) => this.go(d, 'S05'));
    if (this.app.gov.personsStatus !== 'loaded') await this.loadPersons();
  }

  editCrNumber() {
    this.mutate((d) => this.go(d, 'S01'));
  }

  saveAndExit() {
    this.mutate((d) => {
      d.ui.notice = undefined;
      this.log(d, 'SAVED_AND_EXITED', `Progress saved at ${d.screen}.`);
    });
  }

  // ---------- S05 Authorised persons ----------

  async loadPersons() {
    const app = this.app;
    if (app.gov.personsStatus === 'loading' || !app.gov.record) return;
    const idx = app.gov.personsCalls;
    this.mutate((d) => {
      d.gov.personsStatus = 'loading';
      d.gov.personsCalls += 1;
    });
    const res = await this.services.gov.relatedParties(app.gov.record.crNumber, idx);
    this.mutate((d) => {
      if (res.kind === 'unavailable') {
        d.gov.personsStatus = 'unavailable';
        this.log(d, 'GOV_RELATED_PARTIES', 'Related-party data unavailable.');
        return;
      }
      d.gov.personsStatus = 'loaded';
      d.gov.record!.relatedParties = res.parties;
      const individuals = eligibleIndividuals(res.parties);
      if (d.persons.selectedId && !individuals.some((p) => p.partyId === d.persons.selectedId)) d.persons = {};
      if (individuals.length === 1 && !d.persons.selectedId) d.persons.selectedId = individuals[0].partyId;
      this.log(
        d,
        'GOV_RELATED_PARTIES',
        `${res.parties.length} related parties returned; ${individuals.length} individual(s) shown; ${res.parties.length - individuals.length} non-individual(s) filtered out.`,
      );
    });
  }

  selectPerson(partyId: string) {
    const app = this.app;
    if (this.final || app.nafath.status === 'waiting' || app.nafath.result !== 'not_started') return;
    this.mutate((d) => {
      if (d.persons.selectedId && d.persons.selectedId !== partyId)
        this.log(d, 'AUTHORISED_PERSON_CHANGED', `${d.persons.selectedId} → ${partyId} (Nafath attempt counter preserved).`);
      d.persons.selectedId = partyId;
    });
  }

  submitPerson() {
    if (!this.app.persons.selectedId) {
      this.mutate((d) => (d.ui.errors = { person: 'Select one authorized person.' }));
      return;
    }
    this.mutate((d) => {
      if (d.nafath.result === 'not_started') d.nafath.status = 'idle';
      this.log(d, 'AUTHORISED_PERSON_CONFIRMED', `${d.persons.selectedId} selected for Nafath.`);
      this.go(d, 'S06');
    });
  }

  continueWithoutEligiblePerson() {
    this.mutate((d) => {
      this.flag(d, 'NO_ELIGIBLE_AUTHORISED_PERSON', 'CR data returned no individual owners/managers. Nafath not initiated.');
      d.nafath.result = 'unverified';
      d.nafath.notPossibleReason = 'No eligible individual on the CR.';
      this.flag(d, 'NAFATH_MANUAL_VERIFICATION', 'Identity verification to be completed manually (no eligible individual).');
      this.go(d, 'S08');
    });
  }

  // ---------- S06 Nafath ----------

  private nafathTarget(app: Application) {
    if (app.entry.applicantType === 'CR') {
      const person = app.gov.record?.relatedParties.find((p) => p.partyId === app.persons.selectedId);
      if (!person?.nationalId) return undefined;
      return { personId: person.partyId, nationalId: person.nationalId, maskedName: maskName(person.names), maskedId: maskNationalId(person.nationalId) };
    }
    return { personId: undefined, nationalId: app.entry.identification, maskedName: 'National ID holder', maskedId: maskNationalId(app.entry.identification) };
  }

  async startNafath() {
    const app = this.app;
    if (this.final || app.ui.busy || app.nafath.status === 'waiting' || app.nafath.result !== 'not_started' || nafathExhausted(app)) return;
    const target = this.nafathTarget(app);
    if (!target) return;
    const requestIndex = app.nafath.attempts.length + app.nafath.technicalFailures;
    this.mutate((d) => {
      d.ui.busy = 'Sending request to Nafath…';
      d.ui.errors = {};
      d.identityLocked = true;
    });
    const res = await this.services.nafath.createRequest(target.nationalId, requestIndex);
    this.mutate((d) => {
      d.ui.busy = undefined;
      if (res.kind === 'technical_failure') {
        d.nafath.lastOutcome = 'technical_failure';
        d.nafath.status = 'result';
        if (NAFATH_POLICY.technicalFailureConsumesAttempt) {
          d.nafath.attempts.push({ attemptNo: d.nafath.attempts.length + 1, requestIndex, ...target, requestNumber: 0, outcome: 'technical_failure', at: nowIso() });
        } else {
          d.nafath.technicalFailures += 1;
        }
        this.log(
          d,
          'NAFATH_TECHNICAL_FAILURE',
          `Request could not be created (${d.nafath.technicalFailures}/${NAFATH_POLICY.maxTechnicalFailures}). ${NAFATH_POLICY.technicalFailureConsumesAttempt ? 'Attempt consumed.' : 'No attempt consumed.'}`,
        );
        if (nafathExhausted(d)) {
          d.nafath.result = 'unverified';
          this.flag(d, 'NAFATH_MANUAL_VERIFICATION', 'Nafath could not be completed (technical failures / attempts exhausted).');
        }
        return;
      }
      d.nafath.attempts.push({
        attemptNo: d.nafath.attempts.length + 1,
        requestIndex,
        personId: target.personId,
        maskedName: target.maskedName,
        maskedId: target.maskedId,
        requestNumber: res.requestNumber,
        at: nowIso(),
      });
      d.nafath.status = 'waiting';
      this.cost(d, 'NAFATH_REQUEST', `Nafath request attempt ${d.nafath.attempts.length} for ${target.maskedId}`);
      this.log(d, 'NAFATH_REQUEST_SENT', `Attempt ${d.nafath.attempts.length}/${NAFATH_POLICY.maxAttemptsPerApplication} for ${target.maskedId}; number ${res.requestNumber}.`);
    });
  }

  /** Called by the auto-resolve timer (sequence outcome) or the dev simulator (explicit outcome). */
  resolveNafath(explicit?: 'verified' | 'rejected' | 'timeout') {
    const app = this.app;
    if (app.nafath.status !== 'waiting') return;
    const attempt = app.nafath.attempts[app.nafath.attempts.length - 1];
    const outcome = explicit ?? this.services.nafath.status(attempt.requestIndex);
    this.mutate((d) => {
      const a = d.nafath.attempts[d.nafath.attempts.length - 1];
      a.outcome = outcome;
      d.nafath.lastOutcome = outcome;
      d.nafath.status = 'result';
      this.log(d, 'NAFATH_RESULT', `Attempt ${a.attemptNo}: ${outcome.toUpperCase()}${explicit ? ' (dev simulator)' : ''}.`);
      if (outcome === 'verified') {
        d.nafath.result = 'verified';
      } else if (nafathExhausted(d)) {
        d.nafath.result = 'unverified';
        this.flag(
          d,
          'NAFATH_MANUAL_VERIFICATION',
          `${NAFATH_POLICY.maxAttemptsPerApplication} unsuccessful Nafath attempts. Contract signing disabled; manual verification required.`,
        );
      }
    });
  }

  async retryNafath() {
    if (nafathExhausted(this.app) || this.app.nafath.result !== 'not_started') return;
    this.mutate((d) => (d.nafath.status = 'idle'));
    await this.startNafath();
  }

  changeAuthorisedPerson() {
    const app = this.app;
    if (app.entry.applicantType !== 'CR' || app.nafath.status === 'waiting' || app.nafath.result !== 'not_started') return;
    this.mutate((d) => {
      d.nafath.status = 'idle';
      this.log(d, 'CHANGE_AUTHORISED_PERSON', `Attempts used so far: ${d.nafath.attempts.length} (counter is shared).`);
      this.go(d, 'S05');
    });
  }

  async continueAfterNafath() {
    const app = this.app;
    if (app.nafath.result === 'not_started') return;
    if (app.entry.applicantType === 'CR') {
      this.mutate((d) => this.go(d, 'S08'));
      return;
    }
    if (app.nafath.result === 'verified') {
      this.mutate((d) => this.go(d, 'S07'));
      if (this.app.certificates.status !== 'loaded') await this.loadCertificates();
    } else {
      this.mutate((d) => this.go(d, 'S07-M'));
    }
  }

  // ---------- S07 Certificates ----------

  async loadCertificates() {
    const app = this.app;
    if (app.certificates.status === 'loading' || app.nafath.result !== 'verified') return;
    const idx = app.certificates.calls;
    this.mutate((d) => {
      d.certificates.status = 'loading';
      d.certificates.calls += 1;
      this.cost(d, 'CERTIFICATE_LOOKUP', `Certificate lookup call #${idx + 1}`);
    });
    const res = await this.services.certificates.listByNationalId(app.entry.identification, idx);
    this.mutate((d) => {
      if (res.kind === 'unavailable') {
        d.certificates.status = 'unavailable';
        this.log(d, 'CERTIFICATE_LOOKUP', 'Certificate service unavailable.');
        return;
      }
      d.certificates.status = 'loaded';
      d.certificates.list = res.certificates;
      const selectable = res.certificates.filter((c) => !c.attachedToExistingAccount);
      if (selectable.length === 1 && !d.certificates.selectedNumber) d.certificates.selectedNumber = selectable[0].certificateNumber;
      this.log(
        d,
        'CERTIFICATE_LOOKUP',
        `${res.certificates.length} certificate(s) returned; ${res.certificates.length - selectable.length} already attached to an existing account.`,
      );
    });
  }

  selectCertificate(certificateNumber: string) {
    const cert = this.app.certificates.list.find((c) => c.certificateNumber === certificateNumber);
    if (!cert || cert.attachedToExistingAccount || this.final) return;
    this.mutate((d) => {
      d.certificates.selectedNumber = certificateNumber;
      delete d.ui.errors.certificate;
    });
  }

  async submitCertificate() {
    const app = this.app;
    const cert = app.certificates.list.find((c) => c.certificateNumber === app.certificates.selectedNumber);
    if (!cert) {
      this.mutate((d) => (d.ui.errors = { certificate: 'Select one freelancing certificate.' }));
      return;
    }
    const rec = reconcileCertificate(cert, app.category.subcategoryId, app.entry.applicantType!);
    this.mutate((d) => {
      d.certificates.source = 'GOVERNMENT';
      d.certificates.reconciliation = { mappedSubcategoryId: rec.mappedSubcategoryId, matchesSelection: rec.matchesSelection, eligibility: rec.eligibility };
      this.log(
        d,
        'CERTIFICATE_RECONCILIATION',
        `${cert.certificateNumber} (${cert.activityCode}) → Madfu ${rec.mappedSubcategoryId ?? 'unmapped'}; preliminary ${d.category.subcategoryId}; ${rec.matchesSelection ? 'match' : 'mismatch'}.`,
      );
      rec.flags.forEach((f) => this.flag(d, f.code, f.detail));
    });
    if (rec.stop) {
      await this.submit('C_SALES_LEAD');
      return;
    }
    this.mutate((d) => this.go(d, 'S08'));
  }

  enterCertificateManually() {
    this.mutate((d) => this.go(d, 'S07-M'));
  }

  updateManualCertificate(value: string) {
    this.mutate((d) => {
      d.certificates.manualNumber = value;
      delete d.ui.errors.certificate;
    });
  }

  async submitManualCertificate() {
    const value = (this.app.certificates.manualNumber ?? '').trim().toUpperCase();
    const err = validateCertificateNumber(value);
    if (err) {
      this.mutate((d) => (d.ui.errors = { certificate: err }));
      return;
    }
    this.mutate((d) => (d.ui.busy = 'Checking certificate…'));
    const attached = await this.services.registry.certificateAttached(value);
    this.mutate((d) => {
      d.ui.busy = undefined;
      if (attached) {
        d.ui.errors = { certificate: 'This certificate is already linked to an existing Madfu account.' };
        this.log(d, 'CERTIFICATE_DUPLICATE', `${value} already attached to an existing account.`);
        return;
      }
      d.certificates.manualNumber = value;
      d.certificates.source = 'MANUAL_ENTRY';
      if (d.nafath.result === 'verified') {
        this.flag(d, 'CERT_NOT_FOUND_MANUAL_ENTRY', `No certificate returned for the verified identity; ${value} entered manually. Requires manual review.`);
      } else {
        this.flag(
          d,
          'CERT_MANUAL_ENTRY_UNVERIFIED',
          `${value} entered manually. Identity unverified; certificate association unverified; manual review required; contract disabled.`,
        );
      }
      this.go(d, 'S08');
    });
  }

  // ---------- S08 Business details ----------

  updateBusiness(patch: Partial<Application['business']>) {
    if (this.final) return;
    this.mutate((d) => {
      if (patch.iban !== undefined && normaliseIban(patch.iban) !== normaliseIban(d.business.iban)) {
        if (!['failed_max', 'pending_provider', 'not_checked'].includes(d.iban.status)) d.iban.status = 'idle';
        if (d.iban.status === 'not_checked') d.iban.checkedValue = undefined;
      }
      d.business = { ...d.business, ...patch };
      for (const key of Object.keys(patch)) delete d.ui.errors[key];
    });
  }

  /** Runs when the IBAN field is left (or on explicit retry). Never repeats a call for an unchanged value. */
  async verifyIban(force = false) {
    const app = this.app;
    if (this.final || app.iban.status === 'verifying') return;
    const value = normaliseIban(app.business.iban);
    const fmt = validateIbanFormat(value);
    if (fmt) {
      this.mutate((d) => (d.ui.errors = { ...d.ui.errors, iban: fmt }));
      return;
    }
    if (!shouldCallIbanOwnership(app)) {
      if (app.iban.status !== 'not_checked' || app.iban.checkedValue !== value)
        this.mutate((d) => {
          d.iban.status = 'not_checked';
          d.iban.checkedValue = value;
          this.log(d, 'IBAN_COLLECTED', 'IBAN format valid; ownership API not called (Nafath unverified).');
        });
      return;
    }
    if (app.iban.status === 'failed_max' || app.iban.status === 'pending_provider') return;
    if (!force && value === app.iban.checkedValue && app.iban.lastResult) {
      if (app.iban.status === 'idle') this.mutate((d) => (d.iban.status = d.iban.lastResult!));
      return;
    }
    const target = ibanMatchTarget(app.entry.applicantType!);
    const idx = app.iban.calls;
    this.mutate((d) => {
      d.iban.status = 'verifying';
      d.iban.matchTarget = target;
      d.iban.calls += 1;
      delete d.ui.errors.iban;
      this.cost(d, 'IBAN_OWNERSHIP', `IBAN ownership check #${idx + 1} against ${target}`);
    });
    const res = await this.services.iban.verify(value, target, idx);
    this.mutate((d) => {
      d.iban.checkedValue = value;
      d.iban.lastResult = res;
      if (res === 'verified') {
        d.iban.status = 'verified';
      } else if (res === 'not_verified') {
        d.iban.failedAttempts += 1;
        if (d.iban.failedAttempts >= IBAN_POLICY.maxUnsuccessfulOwnershipAttempts) {
          d.iban.status = 'failed_max';
          this.flag(
            d,
            'IBAN_UNVERIFIED_MANUAL_FINANCIAL_REVIEW',
            `${d.iban.failedAttempts} unsuccessful ownership checks. Applicant may continue; manual financial verification queued.`,
          );
        } else d.iban.status = 'not_verified';
      } else {
        d.iban.technicalErrors += 1;
        if (d.iban.technicalErrors >= IBAN_POLICY.maxTechnicalErrors) {
          d.iban.status = 'pending_provider';
          this.flag(
            d,
            'IBAN_VERIFICATION_PENDING_PROVIDER',
            `Provider error ${d.iban.technicalErrors} times — treated as pending, not as a failed ownership check (policy decision pending).`,
          );
        } else d.iban.status = 'technical_error';
      }
      this.log(
        d,
        'IBAN_OWNERSHIP',
        `Check #${idx + 1}: ${res} → status ${d.iban.status} (failed ${d.iban.failedAttempts}/${IBAN_POLICY.maxUnsuccessfulOwnershipAttempts}, technical ${d.iban.technicalErrors}/${IBAN_POLICY.maxTechnicalErrors}).`,
      );
      if (normaliseIban(d.business.iban) !== value && !['failed_max', 'pending_provider'].includes(d.iban.status)) d.iban.status = 'idle';
    });
  }

  async submitBusiness() {
    if (this.final || this.app.ui.busy) return;
    const errors = validateBusiness(this.app.business);
    if (Object.keys(errors).length) {
      this.mutate((d) => {
        d.ui.errors = errors;
        this.log(d, 'VALIDATION_FAILED', `S08: ${Object.keys(errors).join(', ')}`);
      });
      return;
    }
    if (this.app.iban.status === 'idle') await this.verifyIban();
    const app = this.app;
    if (app.iban.status === 'verifying') return;
    if (!(IBAN_PROGRESSABLE as readonly string[]).includes(app.iban.status)) {
      this.mutate((d) => {
        d.ui.errors = {
          iban:
            d.iban.status === 'not_verified'
              ? 'We could not confirm that this IBAN belongs to the applicant. Check the number and try again.'
              : 'We could not verify your IBAN right now. Please try again.',
        };
      });
      return;
    }
    this.mutate((d) => {
      if (d.business.vatRegistered === 'no') d.business.vatNumber = '';
      if (d.business.channel === 'offline') d.business.websiteUrl = '';
      if (d.business.channel === 'online') d.business.mapsUrl = '';
      if (d.iban.status === 'not_checked') this.flag(d, 'IBAN_NOT_CHECKED_NAFATH_UNVERIFIED', 'IBAN collected without ownership verification (Nafath not verified).');
      this.log(
        d,
        'BUSINESS_DETAILS_SAVED',
        `IBAN status ${d.iban.status}; VAT ${d.business.vatRegistered}; channel ${d.business.channel}; branches ${d.business.branches ?? 'not provided'}.`,
      );
    });
    const elig = contractEligibility(this.app);
    if (elig.allowed) {
      this.mutate((d) => {
        d.contract.status = 'pending';
        this.log(d, 'CONTRACT_ELIGIBILITY', `Allowed — ${elig.reason}${elig.conditions.length ? ' Conditions: ' + elig.conditions.join(' ') : ''}`);
        this.go(d, 'S09');
      });
    } else {
      this.mutate((d) => {
        d.contract.status = 'not_available';
        this.log(d, 'CONTRACT_ELIGIBILITY', `Not allowed — ${elig.reason}`);
      });
      await this.submit('B_RECEIVED');
    }
  }

  // ---------- S09 Contract ----------

  async acceptContract(agreed: boolean) {
    const app = this.app;
    if (this.final || app.ui.busy || !contractEligibility(app).allowed) return;
    if (!agreed) {
      this.mutate((d) => (d.ui.errors = { agree: 'Confirm that you have read and agree to the merchant agreement.' }));
      return;
    }
    this.mutate((d) => (d.ui.busy = 'Recording acceptance…'));
    const { acceptanceId } = await this.services.contract.recordAcceptance(app.id);
    this.mutate((d) => {
      d.contract.status = 'accepted';
      d.contract.acceptedAt = nowIso();
      this.log(d, 'CONTRACT_ACCEPTED', `Simulated acceptance ${acceptanceId} of ${d.contract.version}. Not legally binding.`);
    });
    await this.submit('A_SUBMITTED');
  }

  requestDecline() {
    this.mutate((d) => (d.ui.showDeclineConfirm = true));
  }
  cancelDecline() {
    this.mutate((d) => (d.ui.showDeclineConfirm = false));
  }
  confirmDecline() {
    this.mutate((d) => {
      d.contract.status = 'declined';
      d.contract.declinedAt = nowIso();
      this.flag(d, 'CONTRACT_DECLINED', 'Applicant declined the merchant agreement. Application saved, not submitted.');
      this.go(d, 'S09-D');
    });
  }
  reviewContractAgain() {
    this.mutate((d) => {
      d.contract.status = 'pending';
      this.go(d, 'S09');
    });
  }
  editBusinessDetails() {
    this.mutate((d) => {
      d.contract.status = d.contract.status === 'declined' ? 'pending' : d.contract.status;
      this.go(d, 'S08');
    });
  }

  // ---------- Submission ----------

  private async submit(outcome: NonNullable<Application['submission']['outcome']>) {
    if (this.final) return;
    const screen: ScreenId = outcome === 'A_SUBMITTED' ? 'O-A' : outcome === 'B_RECEIVED' ? 'O-B' : 'O-C';
    this.mutate((d) => {
      d.submission = { state: 'submitted', outcome, submittedAt: nowIso() };
      this.log(d, 'SUBMITTED', `Outcome ${outcome}. Internal flags: ${d.flags.map((f) => f.code).join(', ') || 'none'}.`);
      this.go(d, screen);
    });
    if (!this.options.sandbox && outcome !== 'C_SALES_LEAD') addToSubmittedRegistry(`${this.app.entry.applicantType}:${this.app.entry.identification}`);
  }
}
