-- Fiados 2.0 — ampliación progresiva de perfiles y negocios.
-- Ejecutar después de 0001_fiados_v2_schema.sql. No borra ni reescribe datos.
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  currency text not null default 'DOP' check (currency = 'DOP'),
  timezone text not null default 'America/Santo_Domingo',
  created_at timestamptz not null default now()
);
create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','collector','viewer')),
  created_at timestamptz not null default now(),
  primary key (business_id,user_id)
);
alter table public.clients add column if not exists email text not null default '';
alter table public.clients add column if not exists address text not null default '';
alter table public.clients add column if not exists risk_status text not null default 'unrated'
  check (risk_status in ('unrated','good','watch','high'));
alter table public.transactions add column if not exists payment_method text not null default '';
alter table public.transactions add column if not exists receipt_number text;
alter table public.transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
create policy "business_owner_manage" on public.businesses for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "business_member_read_own" on public.business_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "business_owner_add_members" on public.business_members for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
revoke all on public.businesses, public.business_members from anon;
grant select,insert,update,delete on public.businesses to authenticated;
grant select,insert on public.business_members to authenticated;
