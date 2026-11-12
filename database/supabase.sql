begin;

create table if not exists public.olive_workspace (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  state jsonb not null
);
create table if not exists public.olive_staff (
  email text primary key,
  salt text not null,
  password_hash text not null
);
create table if not exists public.olive_sessions (
  token_hash text primary key,
  email text not null references public.olive_staff(email) on delete cascade,
  csrf text not null,
  expires bigint not null
);
create index if not exists olive_sessions_expires_idx on public.olive_sessions (expires);
create table if not exists public.olive_audit (
  revision bigint primary key,
  created timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text not null
);
create table if not exists public.olive_rate_limits (
  bucket text primary key,
  hits integer not null,
  expires bigint not null
);
create index if not exists olive_rate_expires_idx on public.olive_rate_limits (expires);

alter table public.olive_workspace enable row level security;
alter table public.olive_staff enable row level security;
alter table public.olive_sessions enable row level security;
alter table public.olive_audit enable row level security;
alter table public.olive_rate_limits enable row level security;
revoke all on public.olive_workspace, public.olive_staff, public.olive_sessions, public.olive_audit, public.olive_rate_limits from public, anon, authenticated;
grant select, insert on public.olive_workspace, public.olive_staff to service_role;
grant update on public.olive_workspace to service_role;
grant select, insert, delete on public.olive_sessions to service_role;
grant insert on public.olive_audit to service_role;
grant select, insert, update, delete on public.olive_rate_limits to service_role;

create or replace function public.olive_commit(
  p_revision bigint, p_state jsonb, p_actor text, p_action text, p_target text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.olive_workspace
    set state = p_state, revision = p_revision + 1
    where id = 1 and revision = p_revision;
  if not found then
    return false;
  end if;
  insert into public.olive_audit (revision, actor, action, target)
    values (p_revision + 1, p_actor, p_action, p_target);
  return true;
end;
$$;

create or replace function public.olive_rate_hit(
  p_bucket text, p_now bigint, p_window bigint
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  current_hits integer;
begin
  delete from public.olive_rate_limits where expires <= p_now;
  insert into public.olive_rate_limits as rate (bucket, hits, expires)
    values (p_bucket, 1, p_now + p_window)
    on conflict (bucket) do update set hits =
      case when rate.expires <= p_now then 1 else least(rate.hits + 1, 1000000) end,
      expires = case when rate.expires <= p_now then p_now + p_window else rate.expires end
    returning hits into current_hits;
  return current_hits;
end;
$$;

create or replace function public.olive_start_session(
  p_hash text, p_email text, p_csrf text, p_expires bigint, p_previous text, p_now bigint
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.olive_sessions where token_hash = p_previous or expires <= p_now;
  insert into public.olive_sessions (token_hash, email, csrf, expires)
    values (p_hash, p_email, p_csrf, p_expires);
end;
$$;

revoke all on function public.olive_commit(bigint, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.olive_rate_hit(text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.olive_start_session(text, text, text, bigint, text, bigint) from public, anon, authenticated;
grant execute on function public.olive_commit(bigint, jsonb, text, text, text) to service_role;
grant execute on function public.olive_rate_hit(text, bigint, bigint) to service_role;
grant execute on function public.olive_start_session(text, text, text, bigint, text, bigint) to service_role;

notify pgrst, 'reload schema';
commit;
