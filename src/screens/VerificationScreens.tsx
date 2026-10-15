import { useEffect, type ReactNode } from 'react';
import { GOV_POLICY, NAFATH_POLICY } from '../rules/config';
import { eligibleIndividuals, maskName, maskNationalId, nafathAttemptsRemaining } from '../rules/decisions';
import { useJourney } from '../state/JourneyContext';
import { ScreenBody, useHostNav } from '../components/MerchantFrame';
import { Alert, Button, Card, Chip, DevSimulator, KeyValue, Muted, RadioDot, Spinner } from '../components/wf';

// ---------------- S04 ----------------

export function S04CrVerification() {
  const { app, engine, staticMode } = useJourney();
  const { exitToOverview } = useHostNav();
  const { gov } = app;
  useEffect(() => {
    if (!staticMode && gov.status === 'idle') void engine.lookupCr();
  }, [staticMode, gov.status, engine]);
  const record = gov.record;
  const recordRows = record
    ? ([
        ['Business name', record.businessName],
        ['CR number', record.crNumber],
        ['CR status', <Chip tone={record.status === 'ACTIVE' ? 'solid' : 'outline'}>{record.status === 'ACTIVE' ? 'Active' : 'Expired'}</Chip>],
        ['Expiry date', record.expiryDate],
      ] as [string, ReactNode][])
    : [];
  const retriesLeft = GOV_POLICY.maxManualRetries - gov.manualRetries;
  const saveExit = (
    <Button
      variant="secondary"
      testId="gov-save-exit"
      onClick={() => {
        engine.saveAndExit();
        exitToOverview();
      }}
    >
      Save and exit
    </Button>
  );

  let body: ReactNode = null;
  let primary: ReactNode = null;
  let secondary: ReactNode = null;
  switch (gov.status) {
    case 'idle':
    case 'loading':
      body = (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border border-neutral-300" data-testid="gov-loading">
          <Spinner label="Retrieving your Commercial Registration details…" />
          <Muted>This usually takes a few seconds. Please don't close this page.</Muted>
        </div>
      );
      break;
    case 'valid':
    case 'expired':
      body = (
        <>
          {gov.status === 'valid' ? (
            <Alert kind="success" title="Business found" testId="gov-valid" />
          ) : (
            <Alert kind="warning" title="Your Commercial Registration appears to have expired" testId="gov-expired">
              You can continue your application. Our team may ask you for an updated registration.
            </Alert>
          )}
          <div className="rounded-md border border-neutral-300 p-6">
            <KeyValue rows={recordRows} />
          </div>
        </>
      );
      primary = (
        <Button testId="gov-continue" onClick={() => engine.continueFromCr()}>
          Continue
        </Button>
      );
      break;
    case 'not_found':
      body = (
        <Alert kind="error" title="We couldn't find this Commercial Registration number" testId="gov-not-found">
          Check that the CR number {app.entry.identification} is correct and try again.
        </Alert>
      );
      primary = (
        <Button testId="gov-edit-cr" onClick={() => engine.editCrNumber()}>
          Edit CR number
        </Button>
      );
      break;
    case 'unavailable':
      body = (
        <Alert kind="warning" title="The verification service is temporarily unavailable" testId="gov-unavailable">
          Your progress is saved. Please try again in a moment.
        </Alert>
      );
      primary = (
        <Button testId="gov-retry" onClick={() => engine.lookupCr(true)}>
          Try again
        </Button>
      );
      secondary = saveExit;
      break;
    case 'provider_error':
      body = (
        <Alert kind="error" title="Something went wrong" testId="gov-provider-error">
          We couldn't complete the verification. Please try again. If this keeps happening, contact our support team.
        </Alert>
      );
      primary = (
        <Button testId="gov-retry" onClick={() => engine.lookupCr(true)}>
          Try again
        </Button>
      );
      secondary = <Button variant="secondary">Contact support</Button>;
      break;
    case 'gave_up':
      body = (
        <Alert kind="warning" title="We still can't reach the verification service" testId="gov-gave-up">
          Your application has been saved. You can come back later and continue from this step.
        </Alert>
      );
      primary = (
        <Button
          testId="gov-save-exit"
          onClick={() => {
            engine.saveAndExit();
            exitToOverview();
          }}
        >
          Save and exit
        </Button>
      );
      secondary = <Button variant="secondary">Contact support</Button>;
      break;
  }
  return (
    <ScreenBody
      title="Verifying your business"
      lead="We're retrieving your Commercial Registration details from the official government source."
      primary={primary}
      secondary={secondary}
    >
      {body}
      {(gov.status === 'unavailable' || gov.status === 'provider_error') && retriesLeft >= 0 && <Muted>Retry attempts remaining: {retriesLeft}</Muted>}
    </ScreenBody>
  );
}

// ---------------- S05 ----------------

export function S05AuthorisedPerson() {
  const { app, engine, staticMode } = useJourney();
  const { gov, persons, nafath } = app;
  useEffect(() => {
    if (!staticMode && gov.personsStatus === 'idle') void engine.loadPersons();
  }, [staticMode, gov.personsStatus, engine]);
  const individuals = eligibleIndividuals(gov.record?.relatedParties ?? []);
  const remaining = nafathAttemptsRemaining(app);

  if (gov.personsStatus === 'loaded' && individuals.length === 0) {
    return (
      <ScreenBody
        title="Who will verify the business?"
        lead="An authorized individual listed on the Commercial Registration needs to verify the business with Nafath."
        primary={
          <Button testId="persons-none-continue" onClick={() => engine.continueWithoutEligiblePerson()}>
            Continue application
          </Button>
        }
      >
        <Alert kind="warning" title="We couldn't find an individual who can verify this business" testId="persons-none">
          This can happen when the Commercial Registration lists only companies or other entities. You can continue your application and our team will contact you to complete
          verification.
        </Alert>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody
      title="Who will verify the business?"
      lead="Select one authorized person listed on the Commercial Registration. They will approve a request in the Nafath app."
      primary={
        <Button testId="persons-continue" disabled={!persons.selectedId || gov.personsStatus !== 'loaded'} onClick={() => engine.submitPerson()}>
          Continue
        </Button>
      }
    >
      {nafath.attempts.length > 0 && (
        <Alert kind="info" title={`${remaining} of ${NAFATH_POLICY.maxAttemptsPerApplication} verification attempts remaining`} testId="persons-attempts">
          Choosing a different person does not reset the number of attempts for this application.
        </Alert>
      )}
      {gov.personsStatus === 'loading' || gov.personsStatus === 'idle' ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-neutral-300">
          <Spinner label="Loading authorized persons…" />
        </div>
      ) : gov.personsStatus === 'unavailable' ? (
        <>
          <Alert kind="warning" title="We couldn't load the authorized persons" testId="persons-unavailable">
            The government data service didn't respond. Your progress is saved — please try again.
          </Alert>
          <div>
            <Button variant="secondary" testId="persons-retry" onClick={() => engine.loadPersons()}>
              Try again
            </Button>
          </div>
        </>
      ) : (
        <div role="radiogroup" aria-label="Authorized persons" className="flex flex-col gap-3" data-testid="persons-list">
          {individuals.map((p) => {
            const selected = persons.selectedId === p.partyId;
            return (
              <Card key={p.partyId} selected={selected} onClick={() => engine.selectPerson(p.partyId)} testId={`person-${p.partyId}`} className="flex items-center gap-4 px-5 py-4">
                <RadioDot checked={selected} />
                <div className="flex flex-1 flex-col">
                  <span className="text-[16px] font-medium tracking-wide" data-testid="person-name">
                    {maskName(p.names)}
                  </span>
                  <span className="text-[13px] text-neutral-500" data-testid="person-id">
                    National ID {maskNationalId(p.nationalId!)}
                  </span>
                </div>
                <Chip tone="neutral">{p.role === 'OWNER' ? 'Owner' : p.role === 'MANAGER' ? 'Manager' : 'Partner'}</Chip>
              </Card>
            );
          })}
        </div>
      )}
      {gov.personsStatus === 'loaded' && <Muted>Only individuals listed on the CR can verify. Companies and other entities are not shown.</Muted>}
    </ScreenBody>
  );
}

// ---------------- S06 ----------------

export function S06Nafath() {
  const { app, engine, sim, staticMode } = useJourney();
  const { nafath, ui } = app;
  const isCr = app.entry.applicantType === 'CR';
  const remaining = nafathAttemptsRemaining(app);
  const current = nafath.attempts[nafath.attempts.length - 1];

  useEffect(() => {
    if (staticMode || nafath.status !== 'waiting' || sim.nafathAutoResolveMs <= 0) return;
    const t = setTimeout(() => engine.resolveNafath(), sim.nafathAutoResolveMs);
    return () => clearTimeout(t);
  }, [staticMode, nafath.status, nafath.attempts.length, sim.nafathAutoResolveMs, engine]);

  const person = isCr ? app.gov.record?.relatedParties.find((p) => p.partyId === app.persons.selectedId) : undefined;
  const who = (
    <div className="flex items-center gap-4 rounded-md border border-neutral-300 px-5 py-4" data-testid="nafath-identity">
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-400 bg-neutral-100 text-[12px] text-neutral-500">
        ID
      </span>
      <div className="flex flex-col">
        <span className="text-[16px] font-medium">{person ? maskName(person.names) : 'National ID holder'}</span>
        <span className="text-[13px] text-neutral-500">National ID {person ? maskNationalId(person.nationalId!) : maskNationalId(app.entry.identification)}</span>
      </div>
    </div>
  );

  const instructions = (n?: number) => (
    <ol className="flex flex-col gap-3 text-[15px]" data-testid="nafath-instructions">
      {[
        'Open the Nafath app on your phone.',
        'Approve the request from Madfu.',
        n ? `Select the matching number: ${n}.` : 'Select the matching number shown on this screen.',
        'Complete the verification in Nafath.',
      ].map((t, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black text-[12px] font-semibold">{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );

  // Waiting for approval
  if (nafath.status === 'waiting' && current) {
    return (
      <ScreenBody title="Verify identity with Nafath" lead="Approve the request in the Nafath app and select the number below." hideBack>
        {who}
        <div className="grid grid-cols-[auto_1fr] items-center gap-12 rounded-md border border-neutral-300 px-10 py-8">
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-48 w-48 items-center justify-center rounded-full border-[6px] border-black"
              data-testid="nafath-number"
              aria-label={`Nafath number ${current.requestNumber}`}
            >
              <span className="text-[88px] font-bold leading-none tabular-nums">{current.requestNumber}</span>
            </div>
            <span className="text-[13px] text-neutral-500">Your matching number</span>
          </div>
          {instructions(current.requestNumber)}
        </div>
        <div className="flex items-center justify-between">
          <Spinner label="Waiting for approval in Nafath…" />
          <span className="text-[13px] text-neutral-500" data-testid="nafath-attempt">
            Attempt {current.attemptNo} of {NAFATH_POLICY.maxAttemptsPerApplication}
          </span>
        </div>
        <DevSimulator
          note={
            sim.nafathAutoResolveMs > 0
              ? `Auto-resolves in ${(sim.nafathAutoResolveMs / 1000).toFixed(1)}s using the Prototype Controls outcome sequence, or choose an outcome now.`
              : 'Choose an outcome.'
          }
        >
          <Button size="sm" variant="secondary" testId="dev-nafath-approve" onClick={() => engine.resolveNafath('verified')}>
            Simulate approve
          </Button>
          <Button size="sm" variant="secondary" testId="dev-nafath-reject" onClick={() => engine.resolveNafath('rejected')}>
            Simulate reject
          </Button>
          <Button size="sm" variant="secondary" testId="dev-nafath-timeout" onClick={() => engine.resolveNafath('timeout')}>
            Simulate time-out
          </Button>
        </DevSimulator>
      </ScreenBody>
    );
  }

  // Verified
  if (nafath.result === 'verified') {
    return (
      <ScreenBody
        title="Identity verified"
        lead="Thank you. Nafath verification is complete."
        primary={
          <Button testId="nafath-continue" onClick={() => engine.continueAfterNafath()}>
            Continue
          </Button>
        }
      >
        <Alert kind="success" title="Verified with Nafath" testId="nafath-verified" />
        {who}
      </ScreenBody>
    );
  }

  // Exhausted → manual path
  if (nafath.result === 'unverified') {
    return (
      <ScreenBody
        title="We couldn't complete identity verification"
        lead="You can still continue your application. Our team will contact you to complete verification."
        primary={
          <Button testId="nafath-continue-manual" onClick={() => engine.continueAfterNafath()}>
            Continue application
          </Button>
        }
      >
        <Alert kind="info" title="Your progress is saved" testId="nafath-exhausted">
          {isCr ? 'Continue to add your business details.' : 'Continue to add your freelancing certificate and business details.'}
        </Alert>
      </ScreenBody>
    );
  }

  // Result after an unsuccessful attempt (attempts remain)
  if (nafath.status === 'result' && nafath.lastOutcome && nafath.lastOutcome !== 'verified') {
    const tech = nafath.lastOutcome === 'technical_failure';
    const title = tech ? "We couldn't connect to Nafath" : nafath.lastOutcome === 'rejected' ? 'The request was declined in Nafath' : 'The request expired before it was approved';
    return (
      <ScreenBody
        title="Verify identity with Nafath"
        lead="The last verification request was not completed."
        primary={
          <Button testId="nafath-retry" loading={!!ui.busy} onClick={() => engine.retryNafath()}>
            {isCr ? 'Try again with the same person' : 'Try again'}
          </Button>
        }
        secondary={
          isCr ? (
            <Button variant="secondary" testId="nafath-change-person" onClick={() => engine.changeAuthorisedPerson()}>
              Choose another authorized person
            </Button>
          ) : undefined
        }
      >
        <Alert kind={tech ? 'warning' : 'error'} title={title} testId={`nafath-failed-${nafath.lastOutcome}`}>
          {tech
            ? 'No verification attempt was used. Please try again.'
            : `You have ${remaining} verification ${remaining === 1 ? 'attempt' : 'attempts'} remaining for this application.`}
        </Alert>
        {who}
        <span className="text-[13px] text-neutral-500" data-testid="nafath-remaining">
          Attempts remaining: {remaining} of {NAFATH_POLICY.maxAttemptsPerApplication}
        </span>
      </ScreenBody>
    );
  }

  // Ready (idle)
  return (
    <ScreenBody
      title="Verify identity with Nafath"
      lead={
        isCr
          ? 'We will send a verification request to the Nafath app of the authorized person below.'
          : 'We will send a verification request to the Nafath app registered to your National ID.'
      }
      primary={
        <Button testId="nafath-send" loading={!!ui.busy} onClick={() => engine.startNafath()}>
          Send verification request
        </Button>
      }
    >
      {who}
      {nafath.attempts.length > 0 && <Alert kind="info" title={`${remaining} of ${NAFATH_POLICY.maxAttemptsPerApplication} verification attempts remaining`} />}
      <div className="rounded-md border border-neutral-300 px-6 py-5">
        <p className="mb-4 text-[14px] font-medium">What happens next</p>
        {instructions()}
      </div>
      {ui.busy && <Spinner label={ui.busy} />}
    </ScreenBody>
  );
}
