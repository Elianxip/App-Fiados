-- Fiados 2.0 — esquema inicial Supabase/PostgreSQL
-- Ejecutar en un proyecto NUEVO de Supabase después de revisar el respaldo local.
-- No ejecuta importación ni modifica el localStorage del navegador.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.transactions (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  type text not null check (type in ('DEBT', 'PAYMENT')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  occurred_at timestamptz not null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint transactions_client_owner_fk
    foreign key (owner_id, client_id)
    references public.clients(owner_id, id) on delete restrict
);

create index if not exists transactions_owner_client_date_idx
  on public.transactions(owner_id, client_id, occurred_at desc);
create index if not exists transactions_owner_due_idx
  on public.transactions(owner_id, due_at) where due_at is not null;

create table if not exists public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  enabled boolean not null default true,
  days_before integer[] not null default array[1]::integer[],
  remind_on_due_date boolean not null default true,
  overdue_interval_days integer not null default 3 check (overdue_interval_days between 1 and 30),
  notification_time time not null default '09:00',
  timezone text not null default 'America/Santo_Domingo',
  updated_at timestamptz not null default now(),
  constraint reminder_preferences_client_fk
    foreign key (owner_id, client_id)
    references public.clients(owner_id, id) on delete cascade
);
create unique index if not exists reminder_preferences_owner_global_uidx
  on public.reminder_preferences(owner_id) where client_id is null;
create unique index if not exists reminder_preferences_owner_client_uidx
  on public.reminder_preferences(owner_id, client_id) where client_id is not null;

create table if not exists public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  transaction_id text,
  reminder_type text not null check (reminder_type in ('UPCOMING', 'DUE_TODAY', 'OVERDUE', 'PAYMENT_RECEIVED', 'FOLLOW_UP')),
  scheduled_for timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSED', 'CANCELLED', 'FAILED')),
  idempotency_key text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (owner_id, client_id) references public.clients(owner_id, id) on delete cascade,
  foreign key (owner_id, transaction_id) references public.transactions(owner_id, id) on delete set null,
  unique (owner_id, idempotency_key)
);
create index if not exists reminder_events_queue_idx
  on public.reminder_events(status, scheduled_for) where status = 'PENDING';

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(owner_id, endpoint)
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS: cada cuenta solo puede consultar y modificar sus propios registros.
alter table public.clients enable row level security;
alter table public.transactions enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.reminder_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_events enable row level security;

create policy "clients_owner_all" on public.clients
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "transactions_owner_all" on public.transactions
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "reminder_preferences_owner_all" on public.reminder_preferences
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "reminder_events_owner_read" on public.reminder_events
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "audit_events_owner_read" on public.audit_events
  for select to authenticated using (owner_id = (select auth.uid()));

-- Privilegios explícitos: RLS y GRANT deben trabajar juntos.
revoke all on public.clients, public.transactions, public.reminder_preferences,
  public.reminder_events, public.push_subscriptions, public.audit_events from anon;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.reminder_preferences to authenticated;
grant select on public.reminder_events to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.audit_events to authenticated;

-- El backend de confianza podrá insertar eventos; nunca exponer su clave en frontend.
grant insert, update on public.reminder_events to service_role;
grant insert on public.audit_events to service_role;


-- Habilitar eventos Realtime para sincronizar dispositivos (si no están añadidos).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients'
  ) then
    alter publication supabase_realtime add table public.clients;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
end $$;
