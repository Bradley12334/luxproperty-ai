-- subscription-lifecycle-migration.sql  (Step 1 of the subscription lifecycle work)
-- Applied: NOT YET — review, then run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- THE PROBLEM THIS SOLVES
--   Stripe's revocation events (customer.subscription.deleted / .updated,
--   invoice.payment_failed) carry ONLY `cus_XXX`. `client_reference_id` — the one
--   trustworthy link from a payment to a LuxProperty account — exists ONLY on
--   checkout.session.completed. We store no Stripe ids on `users`, so today there is
--   literally no path from a revocation event back to a user row. Consequence: a
--   cancelled or failed Investor subscription keeps full access forever.
--
-- WHY NOT JUST MATCH ON EMAIL
--   api/billing-portal.js does exactly that, and its own header documents why it is a
--   liability: the buyer can edit the email at checkout, edit it later in the Stripe
--   portal, or change their LuxProperty email — each silently breaks the join. For a
--   GRANT a failed match is fail-closed (nobody is over-granted). For a REVOCATION a
--   failed match is fail-OPEN: the downgrade silently does not happen and the
--   over-grant persists. Email is kept only as a last-resort fallback, logged loudly.
--
-- THE FIX
--   Persist the join key at the ONE moment both identities are in the same payload:
--   checkout.session.completed carries both `client_reference_id` (the verified userId)
--   and `session.customer`. Step 2 writes them together in the existing plan UPDATE.
--
-- TWO OBJECTS:
--   1. users.stripe_customer_id / .stripe_subscription_id — the immutable join key
--   2. plan_changes — the grant/revoke audit ledger (the subscription-side counterpart
--      to brief_purchases, which the subscription path has never had)
--
-- SAFETY: purely additive. Two nullable columns on `users` (no default, no backfill, no
--   rewrite of existing rows) and one new table. Nothing reads these yet — Step 2 writes
--   them, Step 4 reads them. Applying this alone changes no behaviour.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. users: the Stripe join key ───────────────────────────────────────────
-- Nullable because existing subscribers have no value until the Step 3 backfill.
-- UNIQUE tolerates unlimited NULLs in Postgres, so un-backfilled rows never collide.
-- UNIQUE is deliberate: two user rows sharing a Stripe customer is a cross-wiring bug
-- we want the database to reject at write time, not discover during a revocation.

alter table public.users
  add column if not exists stripe_customer_id text;

alter table public.users
  add column if not exists stripe_subscription_id text;

-- Guarded so the whole file is re-runnable. conrelid pins the check to public.users,
-- so an identically-named constraint on another table cannot cause a false skip.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname  = 'users_stripe_customer_id_key'
  ) then
    alter table public.users
      add constraint users_stripe_customer_id_key unique (stripe_customer_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname  = 'users_stripe_subscription_id_key'
  ) then
    alter table public.users
      add constraint users_stripe_subscription_id_key unique (stripe_subscription_id);
  end if;
end $$;

-- The hot lookup: cus_XXX → user row, on every subscription webhook.
-- Partial index — only rows that actually carry a customer id are worth indexing.
create index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.users.stripe_customer_id is
  'Stripe customer (cus_…) for this account. Written by api/stripe-webhook.js on checkout.session.completed — the only payload carrying both client_reference_id and session.customer. THE join key for subscription revocation events, which carry no user identity of their own.';

comment on column public.users.stripe_subscription_id is
  'The account''s CURRENT Stripe subscription (sub_…). Overwritten on resubscribe. Audit/diagnostic — revocation resolves via stripe_customer_id, not this.';


-- ─── 2. plan_changes: the grant/revoke audit ledger ──────────────────────────
-- brief_purchases gives the £149 one-off a full history with a Stripe idempotency key.
-- The subscription path has had neither: users.plan is a single mutable column with no
-- record of who changed it, when, or why. That was tolerable while the only writer was
-- "grant on purchase"; it stops being tolerable in Step 4, when automated code starts
-- REVOKING access. When a customer says "I've lost my Investor features", this table is
-- the answer.
--
-- IDEMPOTENCY: stripe_event_id is UNIQUE — the same trick brief_purchases plays with
-- stripe_session_id. Stripe retries webhooks and delivers out of order; an insert with
-- ON CONFLICT (stripe_event_id) DO NOTHING makes replay a no-op.
--
-- NULLABLE stripe_event_id: not every plan change comes from a Stripe event (the Step 3
-- backfill, and any manual support action). UNIQUE allows unlimited NULLs, so those rows
-- coexist with webhook-driven ones.

create table if not exists public.plan_changes (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references public.users(id) on delete cascade,

  -- Idempotency key. NULL for non-webhook changes (backfill, manual support action).
  stripe_event_id        text        unique,

  stripe_customer_id     text,
  stripe_subscription_id text,

  -- The Stripe event that drove this, e.g. 'customer.subscription.deleted', or a
  -- synthetic marker like 'backfill' / 'manual' for non-webhook writes.
  event_type             text        not null,

  -- The transition. from_plan is the value READ immediately before the write, so a
  -- no-op (from = to) is still recorded — that is how we prove a webhook fired and
  -- correctly decided to do nothing.
  from_plan              text,
  to_plan                text        not null,

  -- Human-readable WHY, e.g. 'subscription deleted, no other live subscription'
  -- or 'kept: cancel_at_period_end, access runs to period end'.
  reason                 text,

  created_at             timestamptz not null default now()
);

-- The hot query: this account's plan history, newest first (support diagnostics).
create index if not exists plan_changes_user_created_idx
  on public.plan_changes (user_id, created_at desc);

-- Sweep by customer when diagnosing a Stripe-side incident.
create index if not exists plan_changes_customer_idx
  on public.plan_changes (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.plan_changes enable row level security;
-- Intentionally NO policies: service-role only. RLS-on + no-policies denies all
-- anon/authenticated access, matching brief_purchases / brief_generations.

comment on table public.plan_changes is
  'Append-only audit ledger for every users.plan transition — grants AND revocations. stripe_event_id unique = webhook idempotency (mirrors brief_purchases.stripe_session_id). Records no-op decisions too, so a webhook that correctly declined to downgrade leaves evidence. Service-role only.';


-- ─── 3. Verify ───────────────────────────────────────────────────────────────
-- Expect: two new users columns, both nullable, both unique-constrained;
--         plan_changes present with rls_enabled = true.

select
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'users'
  and c.column_name in ('stripe_customer_id', 'stripe_subscription_id')
order by c.column_name;

select
  t.tablename,
  t.rowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = t.tablename) as policy_count
from pg_tables t
where t.schemaname = 'public'
  and t.tablename = 'plan_changes';
