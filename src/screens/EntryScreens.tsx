import { APPLICANT_TYPES, IDENTIFICATION_RULES, MOBILE_RULES, REVENUE_BANDS, type ApplicantType, type RevenueBand } from '../rules/config';
import { maskMobile } from '../rules/decisions';
import { useJourney } from '../state/JourneyContext';
import { ScreenBody, customerStepName, useHostNav } from '../components/MerchantFrame';
import { Alert, Button, Chip, ErrorSummary, Field, KeyValue, Muted, RadioGroup, Select, Spinner, TextInput } from '../components/wf';

export function S00Resume({ onContinue, onStartNew }: { onContinue: () => void; onStartNew: () => void }) {
  const { app } = useJourney();
  const type = APPLICANT_TYPES.find((t) => t.value === app.entry.applicantType)?.label ?? '—';
  return (
    <ScreenBody
      title="Welcome back"
      lead="You have an application in progress. Continue where you left off, or start a new application."
      hideBack
      primary={
        <Button testId="resume-continue" onClick={onContinue}>
          Continue application
        </Button>
      }
      secondary={
        <Button variant="secondary" testId="resume-new" onClick={onStartNew}>
          Start a new application
        </Button>
      }
    >
      <div className="rounded-md border border-neutral-300 p-6">
        <KeyValue
          rows={[
            ['Application reference', app.id],
            ['Applicant type', type],
            ['Next step', customerStepName(app.screen, app.entry.applicantType)],
            ['Mobile number', app.entry.mobile ? maskMobile(app.entry.countryCode, app.entry.mobile) : '—'],
            ['Last saved', new Date(app.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })],
          ]}
        />
      </div>
      <Muted>Starting a new application discards this saved draft.</Muted>
    </ScreenBody>
  );
}

export function S01Entry() {
  const { app, engine } = useJourney();
  const { entry, ui } = app;
  const errors = ui.errors;
  const idRule = entry.applicantType ? IDENTIFICATION_RULES[entry.applicantType] : undefined;
  const busy = !!ui.busy;
  return (
    <ScreenBody
      title="Apply to become a Madfu merchant"
      lead="Tell us a little about your business to get started. You will need access to the Nafath app and your business bank details."
      primary={
        <Button testId="entry-next" loading={busy} onClick={() => engine.submitEntry()}>
          Next
        </Button>
      }
    >
      {ui.notice && <Alert kind="info">{ui.notice}</Alert>}
      <ErrorSummary errors={errors} />
      <Field label="Applicant type" error={errors.applicantType}>
        <RadioGroup<ApplicantType>
          name="applicantType"
          ariaLabel="Applicant type"
          value={entry.applicantType}
          invalid={!!errors.applicantType}
          disabled={app.identityLocked || busy}
          onChange={(v) => engine.updateEntry({ applicantType: v })}
          options={[
            { value: 'CR', label: 'Registered Business', description: 'You have a Commercial Registration (CR)' },
            { value: 'FREELANCER', label: 'Freelancer', description: 'You have a freelancing certificate' },
          ]}
        />
      </Field>
      <Field
        label={idRule?.label ?? 'Identification number'}
        htmlFor="identification"
        hint={app.identityLocked ? 'Identity verification has started. To change this, start a new application.' : idRule ? idRule.hint : 'Select an applicant type first.'}
        error={errors.identification}
      >
        <TextInput
          id="identification"
          testId="identification"
          inputMode="numeric"
          maxLength={10}
          value={entry.identification}
          invalid={!!errors.identification}
          disabled={!entry.applicantType || app.identityLocked || busy}
          placeholder={entry.applicantType === 'CR' ? 'e.g. 10XXXXXXXX' : entry.applicantType ? 'e.g. 1XXXXXXXXX' : 'Select applicant type first'}
          onChange={(v) => engine.updateEntry({ identification: v.replace(/\D/g, '') })}
        />
      </Field>
      <Field label="Annual revenue" htmlFor="revenue" error={errors.revenueBand}>
        <Select
          id="revenue"
          testId="revenue"
          value={entry.revenueBand}
          invalid={!!errors.revenueBand}
          disabled={busy}
          placeholder="Select annual revenue"
          options={REVENUE_BANDS.map((b) => ({ value: b.value, label: b.label }))}
          onChange={(v) => engine.updateEntry({ revenueBand: v as RevenueBand })}
        />
      </Field>
      <Field label="Mobile number" htmlFor="mobile" error={errors.mobile} hint="We will send a verification code to this number.">
        <TextInput
          id="mobile"
          testId="mobile"
          inputMode="tel"
          maxLength={10}
          value={entry.mobile}
          invalid={!!errors.mobile}
          disabled={busy}
          placeholder="5X XXX XXXX"
          prefix={
            <span className="flex items-center gap-2" aria-label="Country code">
              {MOBILE_RULES.countryLabel} ({MOBILE_RULES.countryCode}) <span className="text-[10px]">▼</span>
            </span>
          }
          onChange={(v) => engine.updateEntry({ mobile: v.replace(/[^\d]/g, '') })}
        />
      </Field>
      {busy && <Spinner label={ui.busy} />}
      <Muted>By continuing, you agree that Madfu may verify the details you provide with official sources. (Placeholder consent copy — pending Legal.)</Muted>
    </ScreenBody>
  );
}

export function S01ExistingAccount() {
  const { app, engine } = useJourney();
  const isFreelancer = app.entry.applicantType === 'FREELANCER';
  return (
    <ScreenBody
      title="An account already exists with these details."
      lead={`You can't start a new application with this ${isFreelancer ? 'National ID number' : 'Commercial Registration number'}. Sign in to your existing account, or contact our support team if you need help.`}
      primary={
        <Button testId="existing-signin" onClick={() => engine.existingAccountSignIn()}>
          Sign in to your account
        </Button>
      }
      secondary={<Button variant="secondary">Contact support</Button>}
    >
      {app.ui.notice && <Alert kind="info">{app.ui.notice}</Alert>}
      {isFreelancer && (
        <div className="rounded-md border border-neutral-300 p-5">
          <p className="text-[15px] font-medium">Want to add another freelancing certificate?</p>
          <Muted className="mt-1">Additional certificates will be added from inside your existing Madfu account.</Muted>
          <div className="mt-3">
            <Button variant="link" testId="add-certificate-link" onClick={() => engine.openAddCertificateFlow()}>
              Add another freelancing certificate
            </Button>
          </div>
        </div>
      )}
    </ScreenBody>
  );
}

export function S01FutureAddCertificate() {
  return (
    <ScreenBody title="Add another freelancing certificate" lead="This journey will be handled inside the existing merchant account.">
      <div>
        <Chip tone="dashed">FUTURE FLOW — pending business specification</Chip>
      </div>
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-neutral-400 bg-neutral-50 p-8 text-center">
        <p className="text-[15px] font-medium text-neutral-700">Screens intentionally not designed</p>
        <Muted>Business rules for adding a certificate to an existing freelancer account are pending. It must not create a second onboarding account.</Muted>
      </div>
    </ScreenBody>
  );
}

export function S02LLocked() {
  const { restart } = useHostNav();
  return (
    <ScreenBody
      title="Too many incorrect attempts"
      lead="For your security, we've paused verification for this application. Please start again later, or contact our support team."
      hideBack
      primary={
        <Button testId="locked-restart" onClick={restart}>
          Start again
        </Button>
      }
      secondary={<Button variant="secondary">Contact support</Button>}
    />
  );
}
