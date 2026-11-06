-- Fiados 2.0 — sincronización completa de módulos adicionales.
-- Migración aditiva e idempotente: NO borra ni transforma clientes/movimientos existentes.
-- Ejecutar después de 0001. La importación local se inicia por separado desde la app.

create extension if not exists pgcrypto;

create table if not exists public.payment_plans (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint payment_plans_client_owner_fk foreign key (owner_id, client_id)
    references public.clients(owner_id, id) on delete restrict,
  constraint payment_plans_payload_object check (jsonb_typeof(payload) = 'object')
);
create index if not exists payment_plans_owner_client_idx on public.payment_plans(owner_id, client_id);

create table if not exists public.expenses (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Otros',
  occurred_on date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint expenses_payload_object check (jsonb_typeof(payload) = 'object')
);
create index if not exists expenses_owner_date_idx on public.expenses(owner_id, occurred_on desc);

create table if not exists public.collectors (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint collectors_payload_object check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.reward_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  points_per_hundred numeric(10,2) not null default 1 check (points_per_hundred >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_ledger (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  transaction_id text,
  points integer not null,
  reason text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint reward_ledger_client_owner_fk foreign key (owner_id, client_id)
    references public.clients(owner_id, id) on delete restrict,
  constraint reward_ledger_tx_owner_fk foreign key (owner_id, transaction_id)
    references public.transactions(owner_id, id) on delete restrict,
  constraint reward_ledger_payload_object check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.receipts (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null,
  verification_code text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint receipts_tx_owner_fk foreign key (owner_id, transaction_id)
    references public.transactions(owner_id, id) on delete restrict,
  constraint receipts_payload_object check (jsonb_typeof(payload) = 'object'),
  unique (owner_id, verification_code)
);

create table if not exists public.device_registry (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Dispositivo',
  last_seen_at timestamptz not null default now(),
  app_version text not null default '2.0',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint device_registry_payload_object check (jsonb_typeof(payload) = 'object')
);

-- RLS y políticas de propietario. Las policies se recrean de forma segura.
do $$
declare t text;
begin
  foreach t in array array['payment_plans','expenses','collectors','reward_settings','reward_ledger','receipts','device_registry'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || '_owner_all', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Realtime para actualización entre dispositivos. Sin triggers que borren o reescriban datos.
do $$
declare t text;
begin
  foreach t in array array['payment_plans','expenses','collectors','reward_settings','reward_ledger','receipts','device_registry'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

comment on table public.payment_plans is 'Planes de pago por usuario; payload conserva la estructura de Fiados 2.0.';
comment on table public.expenses is 'Gastos del negocio aislados por propietario.';
comment on table public.collectors is 'Cobradores por propietario.';
comment on table public.reward_settings is 'Configuración de puntos por propietario.';
comment on table public.reward_ledger is 'Libro de puntos; no modifica transacciones históricas.';
comment on table public.receipts is 'Recibos vinculados a abonos existentes.';
comment on table public.device_registry is 'Dispositivos registrados para sincronización.';
