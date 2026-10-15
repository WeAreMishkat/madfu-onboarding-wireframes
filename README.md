# Madfu — Merchant Onboarding Wireframe System

A working, end-to-end, **low-fidelity desktop wireframe prototype** of merchant onboarding for Madfu (Saudi BNPL), covering both applicant types — **Registered Business (CR)** and **Freelancer** — with every branch, decision, fallback and outcome. Built for Product, Engineering, UX/UI, Risk, Compliance and Sales.

- **Live prototype:** https://wearemishkat.github.io/madfu-onboarding-wireframes/
- **Annotated PDF:** [deliverables/Madfu_Merchant_Onboarding_Wireframes.pdf](deliverables/Madfu_Merchant_Onboarding_Wireframes.pdf) · [download from the site](https://wearemishkat.github.io/madfu-onboarding-wireframes/Madfu_Merchant_Onboarding_Wireframes.pdf)
- **Journey decision maps:** [docs/journey-map/](docs/journey-map/README.md) · [interactive](https://wearemishkat.github.io/madfu-onboarding-wireframes/#/map/A)
- **Product rules:** [docs/business-rules/PRODUCT_RULES.md](docs/business-rules/PRODUCT_RULES.md)
- **Decision log:** [docs/business-rules/DECISION_LOG.md](docs/business-rules/DECISION_LOG.md)
- **UX/UI handover:** [docs/ux-handover/UX_HANDOVER.md](docs/ux-handover/UX_HANDOVER.md)
- **QA report:** [docs/QA_REPORT.md](docs/QA_REPORT.md) · end-state screenshots of all 29 scenarios in [docs/qa-screenshots/](docs/qa-screenshots/)

> **Prototype only.** All data is synthetic. No real SMS, Nafath, government, banking or e-signature service is called. Contract text is a placeholder and not legally binding. Values marked *provisional* are assumptions, not confirmed business rules.

## What's inside

| Area | Where |
| --- | --- |
| 18 screens (15 journey screens + 3 outcomes), incl. future-flow placeholder | `src/screens/`, registry + annotations in `src/journeys/screens.ts` |
| Deterministic journey state machine | `src/journeys/engine.ts` (commands → decisions → next screen) |
| Single authoritative rule model (configurable) | `src/rules/config.ts`, `src/rules/categories.ts` (fixture catalogue), `src/rules/decisions.ts` |
| Typed integration adapters + deterministic mocks | `src/mocks/services.ts`, synthetic fixtures in `src/mocks/fixtures.ts` |
| 29 ready-made scenarios (24 required + 5 extra) | `src/scenarios/scenarios.ts` |
| Prototype Controls (scenario loader, simulator, internal state, audit log) | `src/components/PrototypeControls.tsx` |
| 64 documented screen states (gallery + PDF) | `src/journeys/galleryStates.ts` |
| Journey maps (Mermaid) | `src/journeys/maps.ts` → `docs/journey-map/` |
| PDF source (rendered from the live components) | `src/pages/PrintPage.tsx`, `scripts/generate-pdf/generate.ts` |
| Tests | `tests/unit/` (Vitest), `tests/e2e/` (Playwright) |

## Using the prototype

1. Open the site → **Overview** lists all scenarios. Click **Run** on one, or open **Prototype**.
2. The customer wireframe is on the left; **Prototype Controls** (right, collapsible) never overlays it.
3. Prototype Controls let you load scenarios, change every simulated integration outcome (identity registry, CR lookup, authorized persons, Nafath per attempt, certificates, IBAN per check, latency), and see internal statuses, flags, the paid-call ledger and an audit log that are never shown to applicants.
4. The demo OTP code is `123456` (shown only in Prototype Controls). OTP and Nafath screens also include a hatched **development simulator** strip.
5. Progress persists in browser storage — refresh at any time. Opening **Prototype** with saved progress shows the *Welcome back* resume screen.
6. **Screens** (gallery) opens any of the 64 states as an interactive sandbox with its annotation.

## Development

```bash
npm ci
npm run dev            # http://localhost:5173
npm run test:unit      # Vitest — rules, engine, all scenarios at engine level
npm run build          # type-check + production build to dist/
npx playwright install chromium
npm run test:e2e       # Playwright — every scenario through the real UI (serves dist/ on :4391)
npm run pdf            # renders #/print to deliverables/ + public/ (requires a build)
npm run docs           # regenerates docs/ from the source of truth (+ latest test results)
```

Run the e2e suite against the live site: `E2E_BASE_URL=https://wearemishkat.github.io/madfu-onboarding-wireframes/ npm run test:e2e`.

## Deployment

`.github/workflows/deploy.yml` runs type-check, unit tests, build and the Playwright suite, then deploys `dist/` to GitHub Pages. The app uses a hash router and relative base path, so deep links and refreshes work on static hosting. The committed PDF in `public/` is shipped with the site.

## Changing business rules

Edit `src/rules/config.ts` (policies, bands, attempt limits, blocking flags) or replace `src/rules/categories.ts` with the real category API data. Screens never hard-code eligibility; they call the engine, which calls `src/rules/decisions.ts`. Then run `npm test`, `npm run build && npm run pdf`, and `npm run docs` so the PDF and documents stay in sync.
