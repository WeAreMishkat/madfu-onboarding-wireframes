/**
 * JOURNEY DECISION MAPS (Mermaid source).
 *
 * Node shapes / styles (legend):
 *   screen    ["…"]   user-facing screen (white, solid)  — clickable → screen gallery
 *   decision  {"…"}   decision (diamond)
 *   backend   ("…")   internal backend check (grey, rounded)
 *   external  [["…"]] external integration (double border)
 *   manual    ["…"]   manual-review route (dashed)
 *   outcome   (["…"]) final outcome (black, pill)
 *   ref       >"…"]   continuation reference to another map
 *
 * Node IDs that match a screen ID (S04, S01_X …) automatically link to that
 * screen's primary state in the screen gallery.
 */
import { SCREENS } from './screens';
import { primaryStateFor } from './galleryStates';
import type { ScreenId } from '../state/types';

export interface JourneyMap {
  id: string;
  title: string;
  description: string;
  code: string;
}

const CLASSES = `
  classDef screen fill:#ffffff,stroke:#111111,stroke-width:1.6px,color:#111111;
  classDef decision fill:#ffffff,stroke:#111111,stroke-width:1.2px,color:#111111;
  classDef backend fill:#e6e6e6,stroke:#666666,stroke-width:1px,color:#111111;
  classDef external fill:#f4f4f4,stroke:#111111,stroke-width:1.4px,color:#111111;
  classDef manual fill:#fafafa,stroke:#444444,stroke-width:1.4px,stroke-dasharray:6 4,color:#111111;
  classDef outcome fill:#111111,stroke:#111111,stroke-width:1px,color:#ffffff;
  classDef ref fill:#ffffff,stroke:#999999,stroke-width:1px,stroke-dasharray:2 2,color:#555555;
`;

function withLinks(code: string): string {
  const links = SCREENS.map((s) => {
    const nodeId = s.id.replace(/-/g, '_');
    if (!new RegExp(`\\b${nodeId}\\b[\\[\\(\\{]`).test(code)) return '';
    const state = primaryStateFor(s.id as ScreenId);
    return state ? `  click ${nodeId} href "#/gallery/${state.id}" "Open ${s.id} in the screen gallery"` : '';
  })
    .filter(Boolean)
    .join('\n');
  return `${code}\n${CLASSES}\n${links}`;
}

const legend = `flowchart LR
  L1["User-facing screen"]:::screen
  L2{"Decision"}:::decision
  L3("Backend check"):::backend
  L4[["External integration"]]:::external
  L5["Manual-review route"]:::manual
  L6(["Final outcome"]):::outcome
  L7>"See another map"]:::ref
  L1 ~~~ L2 ~~~ L3 ~~~ L4 ~~~ L5 ~~~ L6 ~~~ L7`;

const master = `flowchart TB
  S01["S01 Start application<br/>type · ID · revenue · mobile"]:::screen --> D1{"Identity already registered?<br/>(check 1, then mobile check 2)"}:::decision
  D1 -- "Yes" --> S01_X["S01-X Existing account"]:::screen
  D1 -- "No" --> S02["S02 Mobile OTP"]:::screen
  S02 -- "3 incorrect" --> S02_L["S02-L Locked"]:::screen
  S02 -- "Verified" --> D3{"Revenue routing"}:::decision
  D3 -- "CR below 100K / above 20M" --> O_C(["O-C Interest received (sales lead)"]):::outcome
  D3 -- "CR 100K–20M · all freelancers" --> S03["S03 Business category"]:::screen
  S03 --> D4{"Category eligibility"}:::decision
  D4 -- "Restricted / review" --> O_C
  D4 -- "Registered Business" --> R1>"S04 CR lookup → S05 person → S06 Nafath<br/>(Maps C1–C2)"]:::ref
  D4 -- "Freelancer" --> R2>"S06 Nafath → S07 / S07-M certificate<br/>(Maps D1–D2)"]:::ref
  R1 --> S08["S08 Business details"]:::screen
  R2 --> S08
  S08 --> D5{"Contract eligible?<br/>(Nafath verified)"}:::decision
  D5 -- "No" --> O_B(["O-B Application received (manual verification)"]):::outcome
  D5 -- "Yes" --> S09["S09 Merchant agreement"]:::screen
  S09 -- "Accept" --> O_A(["O-A Application submitted"]):::outcome
  S09 -- "Decline" --> S09_D["S09-D Not accepted"]:::screen`;

const entry = `flowchart TB
  S00["S00 Resume application"]:::screen -- "Continue" --> RES>"Last active step"]:::ref
  S00 -- "Start new" --> S01
  S01["S01 Start application"]:::screen --> V1{"Frontend structural<br/>validation OK?"}:::decision
  V1 -- "No" --> S01
  V1 -- "Yes" --> B1("Check 1: CR / National ID<br/>already registered?"):::backend
  B1 -- "Exists" --> S01_X["S01-X Existing account"]:::screen
  S01_X -- "Freelancer: add certificate" --> S01_F["S01-F Add certificate<br/>FUTURE FLOW"]:::manual
  S01_X -- "Edit details" --> S01
  B1 -- "New" --> B2("Check 2: mobile linkage<br/>(informational, never blocks)"):::backend
  B2 --> D0{"Mobile already verified<br/>in this application?"}:::decision
  D0 -- "Yes, unchanged" --> D3
  D0 -- "No" --> X1[["SMS OTP service"]]:::external
  X1 --> S02["S02 Mobile OTP"]:::screen
  S02 -- "Incorrect (attempt < 3)" --> S02
  S02 -- "Expired → resend" --> S02
  S02 -- "Edit mobile" --> S01
  S02 -- "3rd incorrect" --> S02_L["S02-L Verification locked"]:::screen
  S02 -- "Verified" --> D3{"Revenue routing"}:::decision
  D3 -- "CR · below SAR 100,000" --> O_C(["O-C Sales lead"]):::outcome
  D3 -- "CR · above SAR 20,000,000" --> O_C
  D3 -- "CR · SAR 100,000 to 20,000,000" --> S03["S03 Business category"]:::screen
  D3 -- "Freelancer · any band" --> S03`;

const cr1 = `flowchart TB
  S03["S03 Business category"]:::screen --> D1{"Category<br/>classification"}:::decision
  D1 -- "Restricted" --> O_C(["O-C Sales lead"]):::outcome
  D1 -- "Pending review<br/>(config: stop)" --> O_C
  D1 -- "Allowed / CR-only" --> S04["S04 Business verification"]:::screen
  S04 --> X1[["Government CR lookup"]]:::external
  X1 --> D2{"CR result"}:::decision
  D2 -- "Unavailable" --> RT("Auto-retry ×2, then manual ×3,<br/>then save & exit"):::backend
  RT --> S04
  D2 -- "Provider error → retry" --> S04
  D2 -- "Not found" --> S01["S01 Edit CR number"]:::screen
  D2 -- "Expired" --> F1["Flag CR_EXPIRED<br/>(may continue)"]:::manual
  F1 --> S05
  D2 -- "Valid" --> S05["S05 Authorized person"]:::screen
  S05 --> B1("Filter: individuals only<br/>(companies / entities hidden)"):::backend
  B1 --> D3{"Eligible<br/>individuals?"}:::decision
  D3 -- "None" --> M1["Manual identity verification<br/>contract disabled"]:::manual
  M1 --> R2>"Map F · S08 Business details"]:::ref
  D3 -- "One or more → select exactly one" --> R1>"Map C2 · Nafath"]:::ref`;

const cr2 = `flowchart TB
  S05["S05 Authorized person<br/>(one selected)"]:::screen --> S06["S06 Nafath"]:::screen
  S06 -- "Send request" --> X2[["Nafath request<br/>2-digit number"]]:::external
  X2 --> D4{"Nafath result"}:::decision
  D4 -- "Technical failure<br/>(no attempt used)" --> S06
  D4 -- "Verified" --> S08["S08 Business details"]:::screen
  D4 -- "Rejected / timed out<br/>attempts used = 1" --> D5{"Retry or<br/>change person?"}:::decision
  D5 -- "Retry same person" --> S06
  D5 -- "Change person<br/>(shared counter kept)" --> S05
  D4 -- "Rejected / timed out<br/>attempts used = 2" --> M2["NAFATH_MANUAL_VERIFICATION<br/>contract disabled"]:::manual
  M2 --> S08
  S08 --> R1>"Map F · details, contract, outcomes"]:::ref`;

const freelancer1 = `flowchart TB
  S03["S03 Business category<br/>(preliminary)"]:::screen --> D1{"Category<br/>classification"}:::decision
  D1 -- "Restricted / review" --> O_C(["O-C Sales lead"]):::outcome
  D1 -- "CR-only" --> F1["Flag CR_ONLY_CATEGORY_FREELANCER<br/>(not rejected)"]:::manual
  F1 --> S06
  D1 -- "Allowed" --> S06["S06 Nafath<br/>(National ID from S01)"]:::screen
  S06 --> X1[["Nafath request"]]:::external
  X1 --> D2{"Nafath result"}:::decision
  D2 -- "Technical failure<br/>(no attempt used)" --> S06
  D2 -- "Rejected / timed out,<br/>1 attempt left" --> S06
  D2 -- "2 unsuccessful" --> S07_M["S07-M Manual certificate entry"]:::screen
  S07_M --> M1["Identity + certificate unverified<br/>IBAN collected without API<br/>contract disabled"]:::manual
  M1 --> R2>"Map F · S08"]:::ref
  D2 -- "Verified" --> R1>"Map D2 · certificates"]:::ref`;

const freelancer2 = `flowchart TB
  N1["S06 Nafath verified"]:::screen --> X2[["Certificate lookup<br/>by National ID"]]:::external
  X2 --> S07["S07 Certificate selection"]:::screen
  S07 --> D3{"Certificates?"}:::decision
  D3 -- "Service unavailable → retry" --> S07
  D3 -- "None found" --> S07_M["S07-M Manual certificate entry"]:::screen
  S07_M --> F4["CERT_NOT_FOUND_MANUAL_ENTRY<br/>contract disabled"]:::manual
  D3 -- "1+ found (attached ones disabled)<br/>select exactly one" --> B1("Reconcile certificate activity<br/>→ Madfu category"):::backend
  B1 --> D4{"Mapped category"}:::decision
  D4 -- "Restricted<br/>(cost already incurred)" --> O_C(["O-C Sales lead"]):::outcome
  D4 -- "Mismatch / unmapped" --> F2["Flag CATEGORY_MISMATCH<br/>preliminary kept"]:::manual
  D4 -- "Expired / inconsistent" --> F3["Certificate review<br/>contract disabled"]:::manual
  D4 -- "Match" --> S08["S08 Business details"]:::screen
  F2 --> S08
  F3 --> S08
  F4 --> S08
  S08 --> R1>"Map F · details, contract, outcomes"]:::ref`;

const manual = `flowchart LR
  subgraph LEAD["Sales / business review (Outcome C)"]
    A1["Revenue outside CR range"]:::manual
    A2["Restricted category (pre-cost)"]:::manual
    A3["Category pending review (pre-cost)"]:::manual
    A4["Certificate maps to restricted category<br/>(post-Nafath, cost recorded)"]:::manual
  end
  subgraph MV["Manual verification (Outcome B)"]
    B1["CR has no eligible individual"]:::manual
    B2["Nafath: 2 unsuccessful attempts (CR)"]:::manual
    B3["Nafath: 2 unsuccessful attempts (Freelancer)<br/>+ manual certificate"]:::manual
    B4["Verified freelancer, no certificate found<br/>+ manual certificate"]:::manual
    B5["Expired / inconsistent certificate"]:::manual
  end
  subgraph FLAG["Flag only — journey continues, contract allowed"]
    C1["CR expired"]:::manual
    C2["IBAN failed twice → manual financial verification"]:::manual
    C3["IBAN provider outage → pending (policy TBD)"]:::manual
    C4["Freelancer chose CR-only category"]:::manual
    C5["Certificate / category mismatch"]:::manual
    C6["Mobile linked to other accounts"]:::manual
  end
  LEAD --> O_C(["O-C Interest received"]):::outcome
  MV --> O_B(["O-B Application received"]):::outcome
  FLAG --> S09["S09 Agreement → O-A"]:::screen`;

const contract = `flowchart TB
  S08["S08 Business details"]:::screen --> V1{"Fields valid?<br/>(IBAN format, VAT, URLs)"}:::decision
  V1 -- "No" --> S08
  V1 -- "Yes" --> D0{"Call IBAN ownership API?"}:::decision
  D0 -- "Nafath unverified<br/>(FL: never; CR: config)" --> N1["IBAN not checked<br/>manual review"]:::manual
  D0 -- "Nafath verified" --> X1[["IBAN ownership<br/>CR → business · FL → National ID"]]:::external
  X1 --> D1{"Result"}:::decision
  D1 -- "Verified" --> E1
  D1 -- "Not verified (1st)" --> S08
  D1 -- "Not verified (2nd)" --> M1["IBAN unverified<br/>manual financial check"]:::manual
  D1 -- "Technical error < 3" --> S08
  D1 -- "Technical error ×3" --> M2["IBAN pending (provider)<br/>policy decision"]:::manual
  M1 --> E1
  M2 --> E1
  N1 --> E1
  E1{"Contract eligibility<br/>Nafath verified AND<br/>no blocking review flag"}:::decision
  E1 -- "Not allowed" --> O_B(["O-B Application received"]):::outcome
  E1 -- "Allowed" --> S09["S09 Merchant agreement"]:::screen
  S09 -- "Accept (simulated)" --> X2[["Contract acceptance<br/>placeholder"]]:::external
  X2 --> O_A(["O-A Application submitted"]):::outcome
  S09 -- "Decline → confirm" --> S09_D["S09-D Not accepted<br/>(saved, not submitted)"]:::screen
  S09_D -- "Review again" --> S09
  S09_D -- "Edit details" --> S08`;

export const JOURNEY_MAPS: JourneyMap[] = [
  {
    id: 'A',
    title: 'Map A — Master overview',
    description: 'End-to-end routing for both applicant types, with continuation references to detailed maps.',
    code: withLinks(master),
  },
  {
    id: 'B',
    title: 'Map B — Entry, duplicate checks, OTP and revenue routing',
    description: 'Shared steps up to eligibility routing. Identity check always runs before the mobile check.',
    code: withLinks(entry),
  },
  {
    id: 'C1',
    title: 'Map C1 — Registered Business: category, CR lookup, authorized person',
    description: 'Category screening before paid calls, government CR verification outcomes, individuals-only person selection.',
    code: withLinks(cr1),
  },
  {
    id: 'C2',
    title: 'Map C2 — Registered Business: Nafath attempts',
    description: 'Two Nafath attempts per application, shared across authorized individuals.',
    code: withLinks(cr2),
  },
  {
    id: 'D1',
    title: 'Map D1 — Freelancer: category and Nafath',
    description: 'Preliminary category screening and Nafath on the National ID entered at the start.',
    code: withLinks(freelancer1),
  },
  {
    id: 'D2',
    title: 'Map D2 — Freelancer: certificates and reconciliation',
    description: 'Certificate retrieval, single selection and reconciliation with the preliminary Madfu category.',
    code: withLinks(freelancer2),
  },
  { id: 'E', title: 'Map E — Manual-review routes', description: 'Every route that ends in a lead, a manual verification, or a flag-only review.', code: withLinks(manual) },
  {
    id: 'F',
    title: 'Map F — Business details, contract and outcomes',
    description: 'IBAN verification, contract eligibility matrix and final outcomes.',
    code: withLinks(contract),
  },
];

export const LEGEND_MAP: JourneyMap = { id: 'legend', title: 'Legend', description: 'Visual distinctions used in every map.', code: `${legend}\n${CLASSES}` };
