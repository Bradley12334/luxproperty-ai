-- brief-carryover-migration.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ANONYMOUS BRIEF CARRY-OVER — a signed-up account keeps the brief it generated
-- while anonymous, rather than losing it.
--
-- WHAT IT IS: a BOOKMARK, not ownership. When an anonymous visitor generates their
-- one free brief, the postcode is remembered in their signed HttpOnly cookie. If they
-- then create an account, POST /api/my-briefs (action=claim) reads that cookie and
-- writes a row here, so the brief shows in the account "My briefs" card.
--
-- WHAT IT IS NOT:
--   - NOT entitlement. ownsFullBrief() reads public.brief_purchases ONLY; this table is
--     never consulted for access. A carried brief regenerates at the account's normal
--     plan tier — carrying it over unlocks nothing.
--   - NOT the Investor portfolio. That is public.saved_briefs (client/portfolioStore.ts),
--     a separate feature. This table is deliberately distinct so carry-over never mixes
--     into the portfolio dashboard.
--
-- ACCESS MODEL: service-role only. RLS ENABLED, NO policies (anon/authenticated get
-- nothing), matching brief_generations / brief_purchases. The browser reads these via
-- GET /api/my-briefs, never directly.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.carried_briefs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  postcode   text        not null,   -- the anon-generated postcode/outcode (display + deep link)
  outcode    text        not null,   -- derived district key, for dedup vs owned briefs
  created_at timestamptz not null default now(),
  unique (user_id, outcode)          -- one carried entry per district per account
);

create index if not exists carried_briefs_user_idx on public.carried_briefs (user_id);

alter table public.carried_briefs enable row level security;
-- Intentionally NO policies: service-role only (bypasses RLS).

comment on table public.carried_briefs is
  'Carry-over bookmarks: an anonymous visitor''s free brief, linked to their account at sign-up. NOT ownership (never checked by ownsFullBrief) and distinct from the Investor portfolio (saved_briefs). Surfaced in account My briefs.';
