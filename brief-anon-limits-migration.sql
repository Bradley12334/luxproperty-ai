-- brief-anon-limits-migration.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ANONYMOUS BRIEF HARD LIMIT — per-IP daily cap (anti-abuse, NOT the product gate).
--
-- The product gate for anonymous visitors is the ONE-free-brief soft gate (a signed
-- HttpOnly cookie, see lib/auth/anon-cookie.js). This table is the anti-abuse backstop
-- that sits WELL ABOVE normal use: a hard cap of 10 anonymous generations per IP per
-- UTC day, to blunt someone cycling the cookie (clearing it / incognito) to farm briefs.
--
-- PRIVACY: we store a HASH of the IP (HMAC-SHA256, keyed by SESSION_SECRET), never the
-- raw IP. The hash is one-way and useless outside this counter.
--
-- TTL / BOUNDED GROWTH: rows are aggregated per (ip_hash, day) and the bump function
-- opportunistically deletes rows older than 2 days on every call, so the table never
-- grows unbounded without any external scheduler (pg_cron etc.).
--
-- ACCESS MODEL: service-role only. RLS is ENABLED with NO policies (anon/authenticated
-- get nothing), matching brief_generations / brief_purchases. Read/written only by the
-- serverless brief function via the service-role key (which bypasses RLS) and the
-- SECURITY DEFINER bump function below.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.anon_brief_limits (
  ip_hash    text        not null,   -- HMAC-SHA256(ip) hex; the raw IP is never stored
  day        date        not null,   -- UTC calendar day the generations were counted in
  count      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, day)
);

-- Supports the range delete in the TTL cleanup below.
create index if not exists anon_brief_limits_day_idx on public.anon_brief_limits (day);

alter table public.anon_brief_limits enable row level security;
-- Intentionally NO policies: service-role only (bypasses RLS).

-- Atomic increment-and-return, with opportunistic TTL cleanup. Called via the
-- service-role key from lib/brief/anon-limit.js. Returns the post-increment count
-- for (ip_hash, day) so the caller can compare against the daily cap in one round trip.
create or replace function public.bump_anon_brief_limit(p_ip_hash text, p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  insert into public.anon_brief_limits (ip_hash, day, count, updated_at)
  values (p_ip_hash, p_day, 1, now())
  on conflict (ip_hash, day)
  do update set count = public.anon_brief_limits.count + 1, updated_at = now()
  returning count into v_count;

  -- TTL: drop rows older than 2 days. Cheap (indexed on day) and keeps the table
  -- bounded to ~one day of distinct IP hashes without any external scheduler.
  delete from public.anon_brief_limits where day < p_day - 2;

  return v_count;
end;
$$;

revoke all on function public.bump_anon_brief_limit(text, date) from public;
grant execute on function public.bump_anon_brief_limit(text, date) to service_role;

comment on table public.anon_brief_limits is
  'Anti-abuse: per-IP-hash daily cap on anonymous brief generations. Stores a hash of the IP, not the IP; opportunistic TTL keeps it bounded. Service-role only.';
