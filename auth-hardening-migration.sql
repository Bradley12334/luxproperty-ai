-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH HARDENING MIGRATION
--
-- DO NOT RUN THIS ALL AT ONCE. Steps 2 and 3 must run only AFTER the new auth
-- code is promoted to production. Read the ordering notes.
--
-- WHY:
--   * `password_hash` stored RAW PASSWORDS (17 users, 0 hashed).
--   * RLS policy `users_anon_select USING (true)` let the public anon key SELECT
--     every row and column of `users` — so any visitor could read every user's
--     email and plaintext password out of the browser bundle.
--   Those 17 passwords must be treated as COMPROMISED.
--
-- ZERO-LOCKOUT GUARANTEE:
--   The new sign-in is dual-mode: it verifies bcrypt hashes AND legacy plaintext,
--   re-hashing a legacy password on first successful login. So the code is correct
--   whether or not the bulk hash has run, and deploy/migration order cannot lock
--   anyone out. Users keep their existing passwords; nobody is emailed.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ STEP 1 — SCHEMA (safe to run any time, including BEFORE the deploy) ═════
-- Purely additive. Existing code ignores these columns.

alter table public.users
  add column if not exists email_verified      boolean not null default false,
  add column if not exists must_reset_password boolean not null default false;

create table if not exists public.email_verification_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists evt_token_idx on public.email_verification_tokens(token);

-- Tokens are only ever touched by the server (service key). Deny anon outright,
-- exactly as password_reset_tokens already does.
alter table public.email_verification_tokens enable row level security;

drop policy if exists evt_anon_deny on public.email_verification_tokens;
create policy evt_anon_deny on public.email_verification_tokens
  for all to anon using (false) with check (false);

-- (Grandfathering happens in STEP 1B, at promote time — see below. It must NOT run
--  here, or accounts created between this step and the promote would be left
--  unverified with no verification email ever sent, since the old sign-up path
--  doesn't send one.)


-- ═══ STEP 1B — GRANDFATHER EXISTING ACCOUNTS  ⚠ RUN AT THE MOMENT OF PROMOTE ══
-- Policy: existing users are treated as verified and are NOT asked to re-verify.
-- Only NEW sign-ups (which go through the new code, and therefore do receive a
-- confirmation email) must verify.
--
-- The cutoff is what makes that precise:
--   * created BEFORE the promote → old sign-up path → never got a confirmation
--     email → grandfather as verified.
--   * created AFTER the promote  → new sign-up path → confirmation email sent →
--     must verify (do NOT grandfather, or they'd skip verification entirely).
--
-- So run this immediately BEFORE or AT the promote, while the old code is still
-- the one serving sign-ups. `now()` is then exactly the right boundary.

update public.users
   set email_verified = true
 where created_at < now();

-- Confirm (expect: all current accounts verified, e.g. 17):
--   select count(*) filter (where email_verified) as verified,
--          count(*) filter (where not email_verified) as unverified
--     from public.users;


-- ═══ STEP 2 — HASH EXISTING PASSWORDS  ⚠ RUN ONLY AFTER THE DEPLOY ═══════════
-- Uses pgcrypto (already installed) so plaintext NEVER leaves Postgres.
-- gen_salt('bf') emits standard $2a$ bcrypt, which bcryptjs verifies natively.
-- IDEMPOTENT: the WHERE clause means re-running cannot double-hash.
--
-- Verify first (expect bcrypt_hashed = 0, plaintext = 17):
--   select count(*) filter (where password_hash like '$2%') as bcrypt_hashed,
--          count(*) filter (where password_hash not like '$2%') as plaintext
--     from public.users;

update public.users
   set password_hash = crypt(password_hash, gen_salt('bf', 12))
 where password_hash not like '$2%';

-- Confirm (expect plaintext = 0):
--   select count(*) filter (where password_hash not like '$2%') as plaintext from public.users;


-- ═══ STEP 3 — REVOKE PASSWORD READ FROM THE BROWSER  ⚠ AFTER THE DEPLOY ══════
-- Column-level revoke, NOT a blanket one. Deliberate: restoreSession() and
-- api/valuation-entitlement.js both read `users` with the anon key but never need
-- password_hash. A blanket `revoke select on users from anon` would break both.
-- After the deploy, only the server (service key) reads password_hash.

revoke select (password_hash) on public.users from anon;

-- Sign-up is server-side now, so anon has no business inserting users either.
revoke insert on public.users from anon;
drop policy if exists users_anon_insert on public.users;

-- Verify anon can no longer read the column (should ERROR: permission denied):
--   set role anon; select password_hash from public.users limit 1; reset role;


-- ═══ STEP 4 — FORCE ROTATION OF THE COMPROMISED PASSWORDS  ⚠ AFTER THE DEPLOY ═
-- The 17 existing passwords were world-readable, so hashing them protects them
-- going forward but does NOT un-expose them. Flagging these accounts makes the
-- next sign-in require a new password (framed as a security update) — no mass
-- email, and nobody is locked out: they sign in with the password they have, then
-- immediately set a new one.
--
-- Scope: only accounts that existed during the exposure. Run AFTER step 2.

update public.users
   set must_reset_password = true
 where created_at < '2026-07-11'::timestamptz;   -- ← set to the deploy timestamp

-- Confirm:
--   select count(*) from public.users where must_reset_password;


-- ═══ STEP 5 — LATER, AFTER A BAKE PERIOD ════════════════════════════════════
-- Once no plaintext rows remain and everyone has signed in at least once, delete
-- the legacy plaintext branch in verifyPassword() (api/auth-email.js) so only
-- bcrypt is accepted. Nothing to run here — it is a code change.
