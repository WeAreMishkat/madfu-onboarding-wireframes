import { useState } from 'react';
import { OTP_POLICY } from '../rules/config';
import { CATEGORY_CATALOGUE } from '../rules/categories';
import { maskMobile } from '../rules/decisions';
import { useJourney } from '../state/JourneyContext';
import { ScreenBody, useNow } from '../components/MerchantFrame';
import { Alert, Button, DevSimulator, ErrorSummary, Field, Muted, Select, Spinner, TextInput } from '../components/wf';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function S02Otp() {
  const { app, engine, staticMode } = useJourney();
  const [code, setCode] = useState('');
  const now = useNow(!staticMode);
  const { otp, ui } = app;
  const expiresIn = otp.expiresAt ? Date.parse(otp.expiresAt) - now : 0;
  const expired = otp.lastError === 'expired' || (!staticMode && expiresIn <= 0 && !!otp.expiresAt);
  const resendIn = ui.resendAvailableAt ? Date.parse(ui.resendAvailableAt) - now : 0;
  const resendsLeft = OTP_POLICY.maxResends - otp.resendCount;
  const busy = !!ui.busy;
  const submit = (value = code) => engine.verifyOtp(value);

  return (
    <ScreenBody
      title="Verify your mobile number"
      lead={
        <>
          We sent a {OTP_POLICY.codeLength}-digit code to <strong className="text-black">{maskMobile(app.entry.countryCode, app.entry.mobile)}</strong>. Enter it below to continue.
        </>
      }
      primary={
        <Button testId="otp-verify" loading={busy} onClick={() => submit()}>
          Verify
        </Button>
      }
    >
      {ui.notice && <Alert kind="info">{ui.notice}</Alert>}
      <Field label="Verification code" htmlFor="otp" error={ui.errors.otp}>
        <TextInput
          id="otp"
          testId="otp-input"
          inputMode="numeric"
          maxLength={OTP_POLICY.codeLength}
          className="w-64 [&_input]:text-[22px] [&_input]:tracking-[0.5em]"
          value={code}
          invalid={!!ui.errors.otp}
          placeholder="••••••"
          onChange={(v) => setCode(v.replace(/\D/g, ''))}
        />
      </Field>
      <div className="flex flex-col gap-2 text-[14px] text-neutral-700">
        <span data-testid="otp-expiry">{expired ? 'This code has expired.' : staticMode ? 'Code expires in 2:00' : `Code expires in ${mmss(expiresIn)}`}</span>
        <span className="flex items-center gap-2">
          Didn't receive a code?
          {resendsLeft <= 0 ? (
            <span className="text-neutral-500">No more codes can be requested.</span>
          ) : resendIn > 0 && !staticMode ? (
            <span className="text-neutral-500">Resend code in {mmss(resendIn)}</span>
          ) : (
            <Button variant="link" testId="otp-resend" disabled={busy} onClick={() => engine.resendOtp()}>
              Resend code
            </Button>
          )}
        </span>
        <span>
          Wrong number?{' '}
          <Button variant="link" testId="otp-edit-mobile" onClick={() => engine.editMobile()}>
            Edit mobile number
          </Button>
        </span>
      </div>
      {busy && <Spinner label={ui.busy} />}
      <DevSimulator note="Simulates SMS outcomes. No SMS is sent; the code is never shown in the customer UI.">
        <Button size="sm" variant="secondary" testId="dev-otp-success" onClick={() => submit(otp.simulatedCode ?? '')}>
          Simulate correct code
        </Button>
        <Button size="sm" variant="secondary" testId="dev-otp-failure" onClick={() => submit('000000')}>
          Simulate incorrect code
        </Button>
        <Button size="sm" variant="secondary" testId="dev-otp-expire" onClick={() => engine.simulateOtpExpiry()}>
          Simulate code expiry
        </Button>
        <Button size="sm" variant="secondary" testId="dev-otp-resend" onClick={() => engine.resendOtp(true)}>
          Resend now (skip cooldown)
        </Button>
      </DevSimulator>
    </ScreenBody>
  );
}

export function S03Category() {
  const { app, engine } = useJourney();
  const { category, ui } = app;
  const selectedCat = CATEGORY_CATALOGUE.find((c) => c.categoryId === category.categoryId);
  return (
    <ScreenBody
      title="What does your business do?"
      lead="Choose the category and subcategory that best describe your business. This helps us set up the right experience for you."
      primary={
        <Button testId="category-next" loading={!!ui.busy} onClick={() => engine.submitCategory()}>
          Next
        </Button>
      }
    >
      <ErrorSummary errors={ui.errors} />
      <Field label="Business category" htmlFor="category" error={ui.errors.category}>
        <Select
          id="category"
          testId="category"
          value={category.categoryId}
          invalid={!!ui.errors.category}
          placeholder="Select a category"
          options={CATEGORY_CATALOGUE.map((c) => ({ value: c.categoryId, label: c.categoryName }))}
          onChange={(v) => engine.selectCategory(v)}
        />
      </Field>
      <Field label="Subcategory" htmlFor="subcategory" error={ui.errors.subcategory} hint={!selectedCat ? 'Select a category first.' : undefined}>
        <Select
          id="subcategory"
          testId="subcategory"
          value={category.subcategoryId}
          invalid={!!ui.errors.subcategory}
          disabled={!selectedCat}
          placeholder="Select a subcategory"
          options={(selectedCat?.subcategories ?? []).map((s) => ({ value: s.subcategoryId, label: s.subcategoryName }))}
          onChange={(v) => engine.selectCategory(category.categoryId, v)}
        />
      </Field>
      {app.entry.applicantType === 'FREELANCER' && <Muted>You'll confirm this against your freelancing certificate later in the application.</Muted>}
      {ui.busy && <Spinner label={ui.busy} />}
    </ScreenBody>
  );
}
