/**
 * Business decision tables rendered from the live rule configuration.
 * Shown on the Rules page and in the PDF — never hand-maintained copies.
 */
import type { ReactNode } from 'react';
import {
  APPLICANT_TYPES,
  CATEGORY_POLICY,
  CONTRACT_BLOCKING_FLAGS,
  GOV_POLICY,
  IBAN_POLICY,
  IDENTIFICATION_RULES,
  MOBILE_RULES,
  NAFATH_POLICY,
  OTP_POLICY,
  REVENUE_BANDS,
  REVENUE_ROUTING,
} from '../rules/config';
import { CATEGORY_CATALOGUE, GOV_ACTIVITY_TO_MADFU } from '../rules/categories';
import { DECISIONS, type DecisionType } from '../rules/decisionLog';

export function Table({ head, rows, testId, dense }: { head: string[]; rows: ReactNode[][]; testId?: string; dense?: boolean }) {
  return (
    <table data-testid={testId} className={`w-full border-collapse text-left ${dense ? 'text-[11.5px]' : 'text-[13px]'}`}>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border border-neutral-400 bg-neutral-100 px-2.5 py-1.5 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="align-top">
            {r.map((c, j) => (
              <td key={j} className="border border-neutral-300 px-2.5 py-1.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TableBlock({ id, title, note, children }: { id?: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-2 break-inside-avoid">
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {note && <p className="text-[12.5px] text-neutral-600">{note}</p>}
      {children}
    </section>
  );
}

const journeyLabel = (j: string) => (j === 'SALES_LEAD' ? 'Sales lead → O-C' : 'Self-onboarding → S03');

export const RevenueTable = () => (
  <TableBlock
    title="R1 · Revenue routing (after OTP)"
    note="Exactly SAR 100,000 and SAR 20,000,000 fall in the middle band (provisional D-01). Configurable: REVENUE_BANDS / REVENUE_ROUTING."
  >
    <Table
      testId="table-revenue"
      head={['Annual revenue', 'Numeric range', 'Registered Business', 'Freelancer']}
      rows={REVENUE_BANDS.map((b) => [b.label, b.rangeNote, journeyLabel(REVENUE_ROUTING.CR[b.value]), journeyLabel(REVENUE_ROUTING.FREELANCER[b.value])])}
    />
  </TableBlock>
);

export const DuplicateTable = () => (
  <TableBlock
    title="R2 · Existing-account detection"
    note="Check 1 (identity) always runs first. If the identity exists the application stops and Check 2 (mobile) is skipped. Mobile reuse is informational only."
  >
    <Table
      testId="table-duplicate"
      head={['Example', 'Result', 'Reason']}
      rows={[
        ['Mobile A + CR 1', 'Allowed', 'New identity'],
        ['Mobile A + CR 2', 'Allowed', 'Different identity; mobile reuse permitted'],
        ['Mobile A + National ID 1', 'Allowed', 'Different identity type'],
        ['Same CR again', 'Not allowed → S01-X', 'Identity already registered'],
        ['Same National ID again', 'Not allowed → S01-X', 'Identity already registered (freelancer: add-certificate is a future flow)'],
      ]}
    />
  </TableBlock>
);

export const ValidationTable = () => (
  <TableBlock title="R3 · Frontend structural validation (configurable, not government validation)">
    <Table
      testId="table-validation"
      head={['Field', 'Rule (placeholder)', 'Message']}
      rows={[
        ...APPLICANT_TYPES.map((t) => [
          IDENTIFICATION_RULES[t.value].label,
          <code key="p">{String(IDENTIFICATION_RULES[t.value].pattern)}</code>,
          IDENTIFICATION_RULES[t.value].error,
        ]),
        ['Mobile number', <code key="m">{`${MOBILE_RULES.countryCode} ${String(MOBILE_RULES.pattern)}`}</code>, MOBILE_RULES.error],
        ['IBAN', 'SA + 22 digits + ISO 13616 mod-97', 'Enter a valid Saudi IBAN / This IBAN is not valid'],
        ['OTP', `${OTP_POLICY.codeLength} digits`, `Enter the ${OTP_POLICY.codeLength}-digit code.`],
      ]}
    />
  </TableBlock>
);

export const OtpTable = () => (
  <TableBlock title="R4 · OTP policy" note="Values other than the 3-attempt maximum are provisional (D-04).">
    <Table
      testId="table-otp"
      head={['Rule', 'Value', 'Behaviour']}
      rows={[
        ['Max incorrect attempts', OTP_POLICY.maxIncorrectAttempts, 'Third incorrect code → S02-L locked'],
        ['Code expiry', `${OTP_POLICY.expirySeconds} s`, 'Expired code: message + resend; does not consume an attempt'],
        ['Resend cooldown', `${OTP_POLICY.resendCooldownSeconds} s`, 'Resend link disabled with countdown'],
        ['Max resends', OTP_POLICY.maxResends, 'Further requests blocked with support message'],
        ['Resend resets attempts', OTP_POLICY.resendResetsAttempts ? 'Yes' : 'No', ''],
      ]}
    />
  </TableBlock>
);

export function CategoryTable({ dense }: { dense?: boolean }) {
  const behaviour = (e: string) =>
    ({
      ALLOWED: 'Continue',
      BLOCKED: 'Stop → lead (O-C) before paid checks',
      CR_ONLY: 'CR: continue · Freelancer: continue + flag',
      MANUAL_REVIEW: CATEGORY_POLICY.manualReviewBehaviour === 'STOP_AS_LEAD' ? 'Stop → review lead (O-C) before paid checks' : 'Continue + flag',
    })[e];
  return (
    <TableBlock
      title="R5 · Category catalogue and eligibility (FIXTURE — not Madfu's real list)"
      note="Category API shape: category ID/name, subcategory ID/name, eligibility, permitted applicant types, manual-review requirement."
    >
      <Table
        dense={dense}
        testId="table-categories"
        head={['Category', 'Subcategory', 'ID', 'Eligibility', 'Permitted types', 'Manual review', 'Behaviour']}
        rows={CATEGORY_CATALOGUE.flatMap((c) =>
          c.subcategories.map((s) => [
            `${c.categoryId} ${c.categoryName}`,
            s.subcategoryName,
            s.subcategoryId,
            s.eligibility,
            s.permittedApplicantTypes.join(', '),
            s.manualReviewRequired ? 'Yes' : 'No',
            behaviour(s.eligibility),
          ]),
        )}
      />
    </TableBlock>
  );
}

export const CertificateMappingTable = () => (
  <TableBlock
    title="R6 · Certificate activity → Madfu category mapping (FIXTURE)"
    note="Government and Madfu taxonomies do not share IDs. Restricted mapping after Nafath → lead with cost recorded; mismatch → flag, preliminary selection preserved."
  >
    <Table
      testId="table-cert-map"
      head={['Certificate activity code', 'Madfu subcategory']}
      rows={Object.entries(GOV_ACTIVITY_TO_MADFU).map(([k, v]) => [k, v ?? 'Unmapped → CATEGORY_MISMATCH'])}
    />
  </TableBlock>
);

export const GovTable = () => (
  <TableBlock
    title="R7 · Government CR verification outcomes"
    note={`Automatic retries: ${GOV_POLICY.autoRetries}; manual retries: ${GOV_POLICY.maxManualRetries}; then save-and-exit (D-08). Authorized-person data is never fabricated.`}
  >
    <Table
      testId="table-gov"
      head={['Result', 'Applicant sees', 'Internal', 'Next']}
      rows={[
        ['Valid', 'Business found + details', '—', 'S05'],
        ['Expired', 'Expired notice, may continue', 'Flag CR_EXPIRED', 'S05'],
        ['Not found / invalid', 'Correction state', '—', 'Edit CR → S01'],
        ['Temporarily unavailable', 'Recovery state, progress saved', 'Retry counters', 'Retry → S04 / save & exit'],
        ['Provider error', 'Generic error + retry + support', 'Retry counters', 'Retry → S04'],
      ]}
    />
  </TableBlock>
);

export const NafathTable = () => (
  <TableBlock
    title="R8 · Nafath attempts"
    note={`Max ${NAFATH_POLICY.maxAttemptsPerApplication} attempts per application, shared across individuals. Technical failure consumes an attempt: ${NAFATH_POLICY.technicalFailureConsumesAttempt ? 'yes' : 'no'} (max ${NAFATH_POLICY.maxTechnicalFailures}, D-11).`}
  >
    <Table
      testId="table-nafath"
      head={['Situation', 'Registered Business', 'Freelancer']}
      rows={[
        ['Verified', 'S08 Business details', 'S07 Certificate selection'],
        ['1st unsuccessful (rejected / timed out)', 'Retry same person, or choose another person (counter kept)', 'Retry'],
        ['2nd unsuccessful', 'Manual verification; continue to S08; contract disabled', 'S07-M manual certificate → S08 (IBAN without API) → O-B'],
        ['Technical failure', 'Retry without using an attempt', 'Retry without using an attempt'],
        ['No eligible individual on CR', 'Manual verification; continue to S08; contract disabled', '—'],
      ]}
    />
  </TableBlock>
);

export const IbanTable = () => (
  <TableBlock
    title="R9 · IBAN ownership verification"
    note={`Ownership API runs when the field is left, never twice for an unchanged value. Max ${IBAN_POLICY.maxUnsuccessfulOwnershipAttempts} unsuccessful checks; ${IBAN_POLICY.maxTechnicalErrors} technical errors → pending (D-10). Format validation ≠ ownership.`}
  >
    <Table
      testId="table-iban"
      head={['Status', 'Applicant can continue?', 'Internal', 'Contract impact']}
      rows={[
        ['Verified', 'Yes', '—', 'None'],
        ['Not verified (1st)', 'No — correct or retry', 'Attempt 1 recorded', '—'],
        ['Not verified (2nd)', 'Yes', 'IBAN_UNVERIFIED_MANUAL_FINANCIAL_REVIEW', 'Allowed if Nafath verified'],
        ['Technical error (< 3)', 'No — retry', 'Technical counter', '—'],
        ['Technical error (3)', 'Yes', 'IBAN_VERIFICATION_PENDING_PROVIDER (separate from failure)', 'Allowed subject to processing rules'],
        ['Nafath unverified', 'Yes (format only)', 'IBAN_NOT_CHECKED_NAFATH_UNVERIFIED', 'Contract not available anyway'],
        ['Invalid format', 'No — must be corrected', '—', '—'],
      ]}
    />
  </TableBlock>
);

export const ContractTable = () => (
  <TableBlock title="R10 · Contract eligibility matrix" note={`Additional provisional blocking flags (D-06/D-16): ${CONTRACT_BLOCKING_FLAGS.join(', ')}.`}>
    <Table
      testId="table-contract"
      head={['Nafath', 'IBAN ownership', 'Contract']}
      rows={[
        ['Verified', 'Verified', 'Allowed'],
        ['Verified', 'Failed twice', 'Allowed'],
        ['Verified', 'Pending / technical issue', 'Allowed subject to required processing rules'],
        ['Not verified', 'Any status', 'Not allowed → O-B'],
        ['Verified + blocking review flag', 'Any status', 'Not allowed → O-B (provisional)'],
      ]}
    />
  </TableBlock>
);

export const StatusTable = () => (
  <TableBlock title="R11 · Internal statuses vs applicant-facing messages" note="Internal classifications are never shown to applicants.">
    <Table
      testId="table-status"
      head={['Internal status', 'Set when', 'Applicant sees']}
      rows={[
        ['SALES_LEAD', 'Revenue lead, restricted / review category, restricted certificate', 'O-C “Thank you for your interest in Madfu. Our team will contact you.”'],
        ['CATEGORY_REVIEW_REQUIRED', 'Restricted / review / CR-only (freelancer) / mismatch', 'No change in copy'],
        ['NAFATH_MANUAL_VERIFICATION', '2 unsuccessful attempts or no eligible individual', 'O-B “Thank you. Your application has been received…”'],
        ['IBAN_VERIFICATION_PENDING', 'Failed twice, provider pending, or not checked', 'Neutral inline note'],
        ['CR_EXPIRED', 'CR lookup returned expired', 'Expired notice on S04'],
        ['CERTIFICATE_REVIEW_REQUIRED', 'Expired / inconsistent / manual certificate', 'No change in copy'],
        ['CONTRACT_PENDING', 'Contract offered or declined', 'S09 / S09-D'],
        ['CONTRACT_ACCEPTED', 'Simulated acceptance', 'O-A'],
        ['APPLICATION_SUBMITTED', 'Outcome A or B', 'O-A / O-B'],
      ]}
    />
  </TableBlock>
);

export const IntegrationTable = () => (
  <TableBlock title="R12 · Integration adapters (all simulated)" note="Typed interfaces in src/mocks/services.ts. Real API behaviour is not proven by this prototype.">
    <Table
      testId="table-integrations"
      head={['Adapter', 'Operation', 'Simulated outcomes', 'Paid call (cost ledger)']}
      rows={[
        ['IdentityRegistryService', 'identityExists · mobileLinkedAccounts · certificateAttached', 'exists / new; linked count', 'No'],
        ['OtpService', 'send', 'code sent (verification simulated locally)', 'No'],
        ['GovernmentCrService', 'lookup · relatedParties', 'valid · expired · not_found · unavailable · provider_error', 'Yes (lookup)'],
        ['CertificateService', 'listByNationalId', '0–3 certificates · unavailable', 'Yes'],
        ['NafathService', 'createRequest · status', 'verified · rejected · timeout · technical_failure', 'Yes'],
        ['IbanOwnershipService', 'verify', 'verified · not_verified · technical_error', 'Yes'],
        ['CategoryService', 'catalogue', 'fixture catalogue', 'No'],
        ['ContractService', 'document · recordAcceptance', 'placeholder document; simulated acceptance', 'No'],
      ]}
    />
  </TableBlock>
);

export function DecisionLogTable({ dense, types }: { dense?: boolean; types?: DecisionType[] }) {
  const items = DECISIONS.filter((d) => !types || types.includes(d.type));
  return (
    <Table
      dense={dense}
      testId="table-decisions"
      head={['ID', 'Type', 'Topic', 'Statement', 'Prototype behaviour', 'Owner']}
      rows={items.map((d) => [
        <strong key="id" className="whitespace-nowrap">
          {d.id}
        </strong>,
        d.type,
        d.topic,
        d.statement,
        d.prototypeBehaviour ?? '—',
        d.owner ?? '—',
      ])}
    />
  );
}

export function AllRuleTables({ dense }: { dense?: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <RevenueTable />
      <DuplicateTable />
      <ValidationTable />
      <OtpTable />
      <CategoryTable dense={dense} />
      <CertificateMappingTable />
      <GovTable />
      <NafathTable />
      <IbanTable />
      <ContractTable />
      <StatusTable />
      <IntegrationTable />
    </div>
  );
}
