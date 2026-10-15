import { GLOBAL_UX_NOTE, SCREENS } from '../journeys/screens';
import { GALLERY_STATES } from '../journeys/galleryStates';
import { SCENARIOS } from '../scenarios/scenarios';
import { DecisionLogTable, Table, TableBlock } from './RuleTables';

export function GlobalUxNote({ id = 'ux-handover-note' }: { id?: string }) {
  return (
    <div id={id} data-testid="global-ux-note" className="rounded-md border-[3px] border-black bg-white p-6">
      <div className="text-[12px] font-bold uppercase tracking-[0.2em]">G-UX · Global UX/UI handover note — applies to every screen</div>
      <p className="mt-3 text-[17px] font-semibold leading-relaxed">{GLOBAL_UX_NOTE}</p>
    </div>
  );
}

export const ScreenInventoryTable = ({ dense }: { dense?: boolean }) => (
  <TableBlock title="H1 · Screen inventory" note="Screen IDs match the interactive prototype, the gallery and the journey maps.">
    <Table
      dense={dense}
      testId="table-inventory"
      head={['ID', 'Screen', 'Audience', 'Entry condition', 'Primary action', 'Next', 'States in gallery']}
      rows={SCREENS.map((s) => [
        <strong key="id" className="whitespace-nowrap">
          {s.id}
        </strong>,
        s.name,
        s.audience,
        s.annotation.entryCondition,
        s.annotation.primaryAction,
        s.annotation.next,
        GALLERY_STATES.filter((g) => g.screen === s.id).length,
      ])}
    />
  </TableBlock>
);

export const FieldBehaviourTable = ({ dense }: { dense?: boolean }) => (
  <TableBlock title="H2 · Field behaviour">
    <Table
      dense={dense}
      testId="table-fields"
      head={['Screen', 'Field', 'Required', 'Behaviour / validation', 'Error copy (draft)']}
      rows={[
        ['S01', 'Applicant type', 'Yes', 'Segmented choice; switching resets ID and dependent verifications', 'Select an applicant type.'],
        ['S01', 'CR number / National ID', 'Yes', 'Label + rule switch with type; digits only; read-only after Nafath starts', 'Enter a valid … number (10 digits).'],
        ['S01', 'Annual revenue', 'Yes', '3 bands, no gap / overlap', 'Select your annual revenue.'],
        ['S01', 'Mobile', 'Yes', '+966 default; accepts 5X… or 05X…; change resets OTP', 'Enter a valid Saudi mobile number.'],
        ['S02', 'OTP code', 'Yes', '6 digits; 3 wrong → lock; expiry not counted', 'The code you entered is incorrect. N attempts remaining.'],
        ['S03', 'Category / subcategory', 'Yes', 'Subcategory enabled after category; classification hidden from user', 'Select a subcategory.'],
        ['S05', 'Authorized person', 'Yes', 'Single select; Continue disabled until chosen', '—'],
        ['S07', 'Certificate', 'Yes', 'Single select; attached certificates disabled', 'Select one freelancing certificate.'],
        ['S07-M', 'Certificate number', 'Yes', 'Structural pattern; duplicate check against existing accounts', 'Enter a valid freelancing certificate number.'],
        ['S08', 'IBAN', 'Yes', 'Format (mod-97) on submit; ownership check on blur; editing invalidates result', 'Enter a valid Saudi IBAN.'],
        ['S08', 'VAT registered + number', 'Yes / if Yes', 'Number shown only when Yes', 'Enter your VAT registration number.'],
        ['S08', 'Sales channel + URLs', 'Yes', 'Online → website; Offline → Google Maps; Both → both', 'Enter a valid website URL / Google Maps link.'],
        ['S08', 'Number of branches', 'No', 'Optional; internal prioritisation only', '—'],
        ['S09', 'Agreement confirmation', 'Yes', 'Required before simulated acceptance', 'Confirm that you have read and agree…'],
      ]}
    />
  </TableBlock>
);

export const RequiredStatesTable = ({ dense }: { dense?: boolean }) => (
  <TableBlock title="H3 · Required state designs per integration" note="Minimum set the UX/UI team must design. See G-UX: absence from the wireframes does not mean exclusion.">
    <Table
      dense={dense}
      testId="table-states"
      head={['Step', 'Loading', 'Empty', 'Error / failure', 'Retry / recovery', 'Edge cases']}
      rows={[
        ['Duplicate checks (S01)', 'Button spinner', '—', 'Existing account', 'Edit details', 'Mobile reused (no block)'],
        ['OTP (S02)', 'Sending / verifying', '—', 'Incorrect, expired, locked', 'Resend with cooldown', 'Resend limit, edit mobile'],
        ['CR lookup (S04)', 'Retrieving CR', '—', 'Not found, provider error', 'Auto + manual retry, save & exit', 'Expired CR'],
        ['Authorized persons (S05)', 'Loading list', 'No eligible individual', 'Data unavailable', 'Try again', 'One person, entities filtered, person changed'],
        ['Nafath (S06)', 'Sending request, waiting', '—', 'Rejected, timed out, technical', 'Retry / change person', 'Attempts exhausted, refresh while waiting'],
        ['Certificates (S07)', 'Retrieving', 'None found', 'Service unavailable', 'Try again / manual entry', 'Expired, inconsistent, attached, mismatch'],
        ['IBAN (S08)', 'Verifying', '—', 'Not verified, technical error', 'Retry verification', 'Failed twice, provider outage, not checked'],
        ['Contract (S09)', 'Recording acceptance', '—', 'Confirmation missing', 'Review again after decline', 'Decline confirmation'],
      ]}
    />
  </TableBlock>
);

export const UxDecisionsBlock = ({ dense }: { dense?: boolean }) => (
  <TableBlock title="H4 · Design decisions and open UX questions">
    <ul className={`list-disc pl-5 ${dense ? 'text-[12px]' : 'text-[13.5px]'} leading-relaxed`}>
      <li>Desktop-first (1440 px); single-column form (max 760 px) under a 7-step progress indicator that adapts to applicant type.</li>
      <li>Back is always bottom-left (secondary); the primary action is bottom-right. Browser Back maps to the same allowed transition.</li>
      <li>Errors: inline per field plus an error summary when two or more fields fail. Error states use weight and borders, not colour.</li>
      <li>Verification results use neutral language; internal classifications (restricted, manual review, flags) are never shown.</li>
      <li>Nafath uses a dedicated screen with a 192 px circular number and numbered instructions; remaining attempts shown after failures.</li>
      <li>Development simulator strips are hatched and labelled “prototype only” — they are not part of the product UI.</li>
      <li>Masking: names (first + last visible), National IDs (first 3 + last 3), mobile (last 3).</li>
      <li>Outcome pages share one layout and never state approval or activation.</li>
    </ul>
    <div className="mt-3">
      <DecisionLogTable dense={dense} types={['UX/UI decision needed']} />
    </div>
  </TableBlock>
);

export const ScenarioTable = ({ dense }: { dense?: boolean }) => (
  <Table
    dense={dense}
    testId="table-scenarios"
    head={['#', 'Scenario', 'What it demonstrates', 'Expected end']}
    rows={SCENARIOS.map((s) => [s.id, s.title, s.summary, s.expected.finalScreen])}
  />
);
