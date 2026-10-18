-- REVISED PROPOSAL ONLY. Not a migration and not applied by Codex.
-- Replaces the earlier FIVE-table proposal. Do not run both versions.
-- Read billing-plan.md first. This creates storage, not purchase-delivery logic.
-- Intentionally fails if the table exists; do not use a second run to repair it.
begin;

-- One row per App Store subscription chain: immutable ownership plus latest verified facts.
-- Apple statuses: 1 active, 2 expired, 3 billing retry, 4 billing grace period, 5 revoked.
-- Product, expiry, renewal choice, grace date and account token come from the signed JWS.
-- No copied plan, active flag, balance, product catalog, or transaction/event ledger.
create table public.apple_subscriptions (
    environment text not null check (environment in ('Production', 'Sandbox')),
    original_transaction_id text not null check (length(original_transaction_id) > 0),
    user_id uuid references auth.users(id) on delete set null,
    status smallint check (status between 1 and 5),
    signed_transaction_info text check (length(signed_transaction_info) > 0),
    signed_renewal_info text check (length(signed_renewal_info) > 0),
    version bigint not null default 1 check (version > 0),
    verified_at timestamptz not null default now(),
    primary key (environment, original_transaction_id),
    check (user_id is null or (status is not null and signed_transaction_info is not null))
);
create index apple_subscriptions_user_idx
    on public.apple_subscriptions(user_id) where user_id is not null;

-- user_id = NULL is a retained ownership tombstone, never an unclaimed subscription.
-- The conditional server writer must reject ownership changes and stale expected-version writes.
-- On deletion, erase signed evidence when retention no longer has a lawful basis.
-- Nullable evidence permits a minimal tombstone without retaining the old account UUID in a JWS.
-- Define a lawful retention period for the remaining chain identifier too.

alter table public.apple_subscriptions enable row level security;
revoke all on table public.apple_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.apple_subscriptions to service_role;

commit;
