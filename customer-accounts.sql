begin;

create table if not exists public.olive_customer_sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  csrf text not null,
  expires bigint not null
);
create index if not exists olive_customer_sessions_expires_idx on public.olive_customer_sessions (expires);

alter table public.olive_customer_sessions enable row level security;
revoke all on public.olive_customer_sessions from public, anon, authenticated;
grant select, insert, delete on public.olive_customer_sessions to service_role;

notify pgrst, 'reload schema';
commit;
