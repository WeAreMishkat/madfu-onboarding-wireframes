import { useEffect, useState } from 'react';
import { BRANCH_OPTIONS, CERTIFICATE_RULES, IBAN_POLICY, VAT_RULES } from '../rules/config';
import { formatIban } from '../rules/decisions';
import { CONTRACT_DOCUMENT } from '../mocks/services';
import { useJourney } from '../state/JourneyContext';
import { ScreenBody, useHostNav } from '../components/MerchantFrame';
import { Alert, Button, Card, Checkbox, Chip, ErrorSummary, Field, H2, Modal, Muted, RadioDot, RadioGroup, Select, Spinner, TextInput } from '../components/wf';

// ---------------- S07 ----------------

export function S07Certificates() {
  const { app, engine, staticMode } = useJourney();
  const { certificates: c, ui } = app;
  useEffect(() => {
    if (!staticMode && c.status === 'idle') void engine.loadCertificates();
  }, [staticMode, c.status, engine]);
  const selectable = c.list.filter((x) => !x.attachedToExistingAccount);

  if (c.status === 'loaded' && c.list.length === 0) {
    return (
      <ScreenBody
        title="Select your freelancing certificate"
        lead="We look up the freelancing certificates registered to your National ID."
        primary={
          <Button testId="cert-manual" onClick={() => engine.enterCertificateManually()}>
            Enter certificate number
          </Button>
        }
      >
        <Alert kind="warning" title="We couldn't find a freelancing certificate for your National ID" testId="cert-none">
          If you have a freelancing certificate, enter its number and our team will review it.
        </Alert>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody
      title="Select your freelancing certificate"
      lead="These certificates are registered to your National ID. Select the one you want to use with Madfu."
      primary={
        <Button testId="cert-continue" disabled={!c.selectedNumber || c.status !== 'loaded'} loading={!!ui.busy} onClick={() => engine.submitCertificate()}>
          Continue
        </Button>
      }
    >
      {ui.errors.certificate && <Alert kind="error" title={ui.errors.certificate} />}
      {c.status === 'loading' || c.status === 'idle' ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-neutral-300">
          <Spinner label="Retrieving your freelancing certificates…" />
        </div>
      ) : c.status === 'unavailable' ? (
        <>
          <Alert kind="warning" title="We couldn't retrieve your certificates" testId="cert-unavailable">
            The certificate service didn't respond. Your progress is saved — please try again.
          </Alert>
          <div>
            <Button variant="secondary" testId="cert-retry" onClick={() => engine.loadCertificates()}>
              Try again
            </Button>
          </div>
        </>
      ) : (
        <div role="radiogroup" aria-label="Freelancing certificates" className="flex flex-col gap-3" data-testid="cert-list">
          {c.list.map((cert) => {
            const selected = c.selectedNumber === cert.certificateNumber;
            return (
              <Card
                key={cert.certificateNumber}
                selected={selected}
                disabled={cert.attachedToExistingAccount}
                onClick={() => engine.selectCertificate(cert.certificateNumber)}
                testId={`cert-${cert.certificateNumber}`}
                className="flex items-center gap-4 px-5 py-4"
              >
                <RadioDot checked={selected} />
                <div className="grid flex-1 grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[12px] text-neutral-500">Certificate number</span>
                    <span className="text-[15px] font-medium">{cert.certificateNumber}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-neutral-500">Category</span>
                    <span className="text-[15px]">{cert.govCategory}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-neutral-500">Subcategory</span>
                    <span className="text-[15px]">{cert.govSubcategory}</span>
                  </div>
                </div>
                {cert.attachedToExistingAccount ? (
                  <Chip tone="dashed">Already linked to a Madfu account</Chip>
                ) : (
                  <Chip tone={cert.status === 'ACTIVE' ? 'neutral' : 'outline'}>{cert.status === 'ACTIVE' ? 'Active' : 'Expired'}</Chip>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {c.status === 'loaded' && selectable.length === 0 && (
        <>
          <Alert kind="info" title="All your certificates are already linked to a Madfu account">
            Sign in to your existing account, or enter a different certificate number for our team to review.
          </Alert>
          <div>
            <Button variant="secondary" testId="cert-all-attached-manual" onClick={() => engine.enterCertificateManually()}>
              Enter a different certificate number
            </Button>
          </div>
        </>
      )}
      {c.status === 'loaded' && c.list.length > 0 && <Muted>Certificate details come from the official freelancing platform and can't be edited here.</Muted>}
    </ScreenBody>
  );
}

// ---------------- S07-M ----------------

export function S07ManualCertificate() {
  const { app, engine } = useJourney();
  const verified = app.nafath.result === 'verified';
  return (
    <ScreenBody
      title="Enter your freelancing certificate number"
      lead={
        verified
          ? "We couldn't retrieve your certificate automatically. Enter its number and our team will review it."
          : 'Enter the number shown on your freelancing certificate. Our team will review it as part of your application.'
      }
      primary={
        <Button testId="cert-manual-continue" loading={!!app.ui.busy} onClick={() => engine.submitManualCertificate()}>
          Continue
        </Button>
      }
    >
      <Field label="Freelancing certificate number" htmlFor="certNumber" hint={CERTIFICATE_RULES.hint} error={app.ui.errors.certificate}>
        <TextInput
          id="certNumber"
          testId="cert-manual-input"
          value={app.certificates.manualNumber ?? ''}
          invalid={!!app.ui.errors.certificate}
          placeholder="FL-000000000"
          maxLength={12}
          onChange={(v) => engine.updateManualCertificate(v.toUpperCase())}
        />
      </Field>
    </ScreenBody>
  );
}

// ---------------- S08 ----------------

function IbanStatus() {
  const { app, engine } = useJourney();
  const { iban } = app;
  const owner = app.entry.applicantType === 'CR' ? 'the business on your Commercial Registration' : 'you';
  const used = `${iban.failedAttempts} of ${IBAN_POLICY.maxUnsuccessfulOwnershipAttempts} verification attempts used.`;
  switch (iban.status) {
    case 'verifying':
      return (
        <div data-testid="iban-status-verifying">
          <Spinner small label="Verifying account ownership…" />
        </div>
      );
    case 'verified':
      return (
        <div className="flex items-center gap-2" data-testid="iban-status-verified">
          <Chip tone="solid">✓ Verified</Chip>
          <span className="text-[13px] text-neutral-600">Account ownership confirmed.</span>
        </div>
      );
    case 'not_verified':
      return (
        <div data-testid="iban-status-not-verified" className="flex flex-col gap-2">
          <Alert kind="error" title="We couldn't confirm this IBAN">
            It must be registered to {owner}. Check the number, or retry verification. {used}
          </Alert>
          <div>
            <Button variant="link" testId="iban-retry" onClick={() => engine.verifyIban(true)}>
              Retry verification
            </Button>
          </div>
        </div>
      );
    case 'technical_error':
      return (
        <div data-testid="iban-status-technical" className="flex flex-col gap-2">
          <Alert kind="warning" title="We couldn't verify your IBAN right now">
            This is a temporary problem on our side. Please retry.
          </Alert>
          <div>
            <Button variant="link" testId="iban-retry" onClick={() => engine.verifyIban(true)}>
              Retry verification
            </Button>
          </div>
        </div>
      );
    case 'failed_max':
      return (
        <Alert kind="info" title="We couldn't verify this account automatically" testId="iban-status-failed-max">
          You can continue. Our team will verify the account before any settlement is made.
        </Alert>
      );
    case 'pending_provider':
      return (
        <Alert kind="info" title="Verification is taking longer than expected" testId="iban-status-pending">
          You can continue. We will complete the verification in the background.
        </Alert>
      );
    case 'not_checked':
      return (
        <span className="text-[13px] text-neutral-600" data-testid="iban-status-not-checked">
          IBAN format checked. Our team will verify this account as part of your application.
        </span>
      );
    default:
      return null;
  }
}

export function S08BusinessDetails() {
  const { app, engine } = useJourney();
  const { business: b, ui } = app;
  const e = ui.errors;
  const ownerHint = app.entry.applicantType === 'CR' ? 'The account must be registered to the business name on your CR.' : 'The account must be registered in your name.';
  return (
    <ScreenBody
      title="Business details"
      lead="We use these details to set up settlements and understand how you sell to customers."
      primary={
        <Button testId="business-next" loading={!!ui.busy || app.iban.status === 'verifying'} onClick={() => engine.submitBusiness()}>
          Next
        </Button>
      }
    >
      <ErrorSummary errors={e} />
      <section className="flex flex-col gap-4">
        <H2>Settlement bank account</H2>
        <Field label="IBAN" htmlFor="iban" hint={!e.iban ? ownerHint : undefined} error={e.iban}>
          <TextInput
            id="iban"
            testId="iban"
            value={formatIban(b.iban)}
            invalid={!!e.iban}
            placeholder="SA00 0000 0000 0000 0000 0000"
            maxLength={29}
            onChange={(v) => engine.updateBusiness({ iban: v.replace(/\s/g, '').toUpperCase() })}
            onBlur={() => engine.verifyIban()}
          />
        </Field>
        <IbanStatus />
      </section>
      <hr className="border-neutral-200" />
      <section className="flex flex-col gap-4">
        <H2>VAT</H2>
        <Field label="Is your business VAT registered?" error={e.vatRegistered}>
          <RadioGroup
            name="vat"
            ariaLabel="VAT registered"
            layout="inline"
            value={b.vatRegistered}
            invalid={!!e.vatRegistered}
            onChange={(v) => engine.updateBusiness({ vatRegistered: v })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </Field>
        {b.vatRegistered === 'yes' && (
          <Field label="VAT registration number" htmlFor="vat" hint={VAT_RULES.hint} error={e.vatNumber}>
            <TextInput
              id="vat"
              testId="vat-number"
              inputMode="numeric"
              maxLength={15}
              value={b.vatNumber}
              invalid={!!e.vatNumber}
              placeholder="3XXXXXXXXXXXXX3"
              onChange={(v) => engine.updateBusiness({ vatNumber: v.replace(/\D/g, '') })}
            />
          </Field>
        )}
      </section>
      <hr className="border-neutral-200" />
      <section className="flex flex-col gap-4">
        <H2>Sales channels</H2>
        <Field label="How do you sell to customers?" error={e.channel}>
          <RadioGroup
            name="channel"
            ariaLabel="Sales channel"
            layout="inline"
            value={b.channel}
            invalid={!!e.channel}
            onChange={(v) => engine.updateBusiness({ channel: v })}
            options={[
              { value: 'online', label: 'Online' },
              { value: 'offline', label: 'Offline' },
              { value: 'both', label: 'Both' },
            ]}
          />
        </Field>
        {(b.channel === 'online' || b.channel === 'both') && (
          <Field label="Store website URL" htmlFor="website" error={e.websiteUrl}>
            <TextInput
              id="website"
              testId="website"
              inputMode="url"
              value={b.websiteUrl}
              invalid={!!e.websiteUrl}
              placeholder="https://"
              onChange={(v) => engine.updateBusiness({ websiteUrl: v })}
            />
          </Field>
        )}
        {(b.channel === 'offline' || b.channel === 'both') && (
          <Field label="Google Maps link for one branch" htmlFor="maps" error={e.mapsUrl}>
            <TextInput
              id="maps"
              testId="maps"
              inputMode="url"
              value={b.mapsUrl}
              invalid={!!e.mapsUrl}
              placeholder="https://maps.app.goo.gl/…"
              onChange={(v) => engine.updateBusiness({ mapsUrl: v })}
            />
          </Field>
        )}
      </section>
      <hr className="border-neutral-200" />
      <section className="flex flex-col gap-4">
        <Field label="Number of branches" optional htmlFor="branches">
          <Select
            id="branches"
            testId="branches"
            value={b.branches}
            placeholder="Select number of branches"
            options={BRANCH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => engine.updateBusiness({ branches: v as typeof b.branches })}
          />
        </Field>
      </section>
    </ScreenBody>
  );
}

// ---------------- S09 ----------------

export function S09Contract() {
  const { app, engine } = useJourney();
  const [agreed, setAgreed] = useState(false);
  const doc = CONTRACT_DOCUMENT;
  return (
    <div>
      <ScreenBody
        title="Review and accept the merchant agreement"
        lead="Please read the agreement below before accepting."
        primary={
          <Button testId="contract-accept" loading={!!app.ui.busy} onClick={() => engine.acceptContract(agreed)}>
            Accept and submit
          </Button>
        }
        secondary={
          <Button variant="secondary" testId="contract-decline" onClick={() => engine.requestDecline()}>
            Decline
          </Button>
        }
      >
        <div className="overflow-hidden rounded-md border border-neutral-400">
          <div className="flex items-center justify-between border-b border-neutral-300 bg-neutral-100 px-4 py-2 text-[12px] text-neutral-600">
            <span className="font-medium">{doc.title}</span>
            <span>Version {doc.version}</span>
          </div>
          <div className="relative h-[340px] overflow-y-auto px-8 py-6" data-testid="contract-viewer" tabIndex={0}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-[40px] font-bold tracking-widest text-neutral-100 [writing-mode:horizontal-tb]"
            >
              PLACEHOLDER
            </div>
            <div className="relative flex flex-col gap-5">
              {doc.sections.map((s) => (
                <section key={s.heading}>
                  <h3 className="text-[15px] font-semibold">{s.heading}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-neutral-700">{s.body}</p>
                  <div className="mt-2 flex flex-col gap-1.5" aria-hidden>
                    <span className="h-2 w-full rounded bg-neutral-100" />
                    <span className="h-2 w-11/12 rounded bg-neutral-100" />
                    <span className="h-2 w-4/5 rounded bg-neutral-100" />
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
        <Checkbox checked={agreed} invalid={!!app.ui.errors.agree} onChange={setAgreed} label="I have read and agree to the Madfu Merchant Agreement." />
        {app.ui.errors.agree && (
          <span className="text-[13px] font-medium" role="alert">
            {app.ui.errors.agree}
          </span>
        )}
        <Muted>Acceptance in this prototype is simulated and not legally binding. The final signature method is pending.</Muted>
      </ScreenBody>
      {app.ui.showDeclineConfirm && (
        <Modal
          title="Decline the agreement?"
          actions={
            <>
              <Button variant="secondary" testId="decline-cancel" onClick={() => engine.cancelDecline()}>
                Cancel
              </Button>
              <Button testId="decline-confirm" onClick={() => engine.confirmDecline()}>
                Decline agreement
              </Button>
            </>
          }
        >
          Your application will be saved, but it can't be submitted without accepting the agreement. You can review it again later.
        </Modal>
      )}
    </div>
  );
}

export function S09Declined() {
  const { engine } = useJourney();
  const { exitToOverview } = useHostNav();
  return (
    <ScreenBody
      title="You haven't accepted the agreement"
      lead="Your application is saved, but it can't be submitted until the merchant agreement is accepted."
      hideBack
      primary={
        <Button testId="declined-review" onClick={() => engine.reviewContractAgain()}>
          Review agreement
        </Button>
      }
      secondary={
        <Button variant="secondary" testId="declined-edit" onClick={() => engine.editBusinessDetails()}>
          Edit business details
        </Button>
      }
    >
      <Alert kind="info" title="Have questions about the agreement?">
        Contact our team before deciding. Your progress will be kept.
      </Alert>
      <div>
        <Button
          variant="link"
          testId="declined-save-exit"
          onClick={() => {
            engine.saveAndExit();
            exitToOverview();
          }}
        >
          Save and exit
        </Button>
      </div>
    </ScreenBody>
  );
}

// ---------------- Outcomes ----------------

function Outcome({ title, body, testId }: { title: string; body?: string; testId: string }) {
  const { app } = useJourney();
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center" data-testid={testId}>
      <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-black text-[34px]">
        ✓
      </span>
      <h1 className="max-w-[600px] text-[28px] font-semibold leading-tight">{title}</h1>
      {body && <p className="max-w-[520px] text-[16px] leading-relaxed text-neutral-600">{body}</p>}
      <div className="rounded-md border border-neutral-300 px-5 py-3 text-[14px] text-neutral-600">
        Reference: <span className="font-medium text-black">{app.id}</span>
      </div>
    </div>
  );
}

export const OutcomeA = () => <Outcome testId="outcome-a" title="Your application has been submitted successfully." body="We will contact you about the next steps." />;
export const OutcomeB = () => (
  <Outcome testId="outcome-b" title="Thank you. Your application has been received." body="Our team will contact you if any additional information is needed." />
);
export const OutcomeC = () => <Outcome testId="outcome-c" title="Thank you for your interest in Madfu." body="Our team will contact you." />;
