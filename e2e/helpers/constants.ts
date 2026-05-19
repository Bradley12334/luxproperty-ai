/**
 * Shared constants for the LuxProperty.ai QA suite.
 *
 * POSTCODES
 * ---------
 * SW3 1AA — Chelsea, London. Strong data postcode: curated enrichment,
 *            good Land Registry volume, all sections should render fully.
 *
 * LS1 1AA — Leeds city centre. Strong UK regional data; tests non-London paths.
 *
 * LL55 1TU — Caernarfon, rural Wales. Thin/sparse data postcode:
 *             verifies graceful degradation rather than crashes or empty errors.
 *
 * INVALID1  — Deliberately invalid. Must produce a graceful error, not a crash.
 *
 * TEST USERS
 * ----------
 * These are injected via localStorage (lux_session key) to simulate plan tiers
 * without a real Supabase roundtrip. The authStore reads from localStorage on
 * load, so writing the session before navigation is sufficient.
 *
 * NOTE: Test user IDs use a "qa-" prefix so they are clearly synthetic.
 * They do NOT correspond to real Supabase rows — plan-gating tests rely only
 * on the client-side plan field, which is all the brief page checks.
 */

export const POSTCODES = {
  strongLondon: "SW3 1AA",
  strongRegional: "LS1 1AA",
  thinData: "LL55 1TU",
  invalid: "INVALID1",
} as const;

export const TEST_USERS = {
  explorer: {
    id: "qa-explorer-001",
    name: "QA Explorer",
    email: "qa-explorer@test.luxproperty.ai",
    plan: "explorer" as const,
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  professional: {
    id: "qa-pro-001",
    name: "QA Professional",
    email: "qa-pro@test.luxproperty.ai",
    plan: "professional" as const,
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  investor: {
    id: "qa-investor-001",
    name: "QA Investor",
    email: "qa-investor@test.luxproperty.ai",
    plan: "investor" as const,
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
} as const;

export type PlanTier = "explorer" | "professional" | "investor";

/** Stripe live Professional checkout URL */
export const STRIPE_PRO_URL = "https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00";

/** Expected plan names as shown in the UI */
export const PLAN_DISPLAY_NAMES = {
  explorer: "Explorer",
  professional: "Professional",
  investor: "Investor",
} as const;
