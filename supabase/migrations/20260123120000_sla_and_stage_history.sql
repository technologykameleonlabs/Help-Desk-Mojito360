-- =====================================================
-- SLA policies/thresholds + ticket stage history
-- =====================================================

-- ======================
-- 1) SLA CONFIG TABLES
-- ======================
create table if not exists public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sla_thresholds (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.sla_policies(id) on delete cascade,
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  application text,
  entity_id uuid references public.entities(id) on delete set null,
  warning_minutes int not null,
  breach_minutes int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sla_thresholds_policy
  on public.sla_thresholds (policy_id);

create index if not exists idx_sla_thresholds_entity
  on public.sla_thresholds (entity_id);

create unique index if not exists sla_thresholds_scope_unique
  on public.sla_thresholds (
    policy_id,
    coalesce(priority, ''),
    coalesce(application, ''),
    coalesce(entity_id::text, '')
  );

-- RLS
alter table public.sla_policies enable row level security;
alter table public.sla_thresholds enable row level security;

drop policy if exists "SLA policies are viewable by authenticated users" on public.sla_policies;
create policy "SLA policies are viewable by authenticated users"
  on public.sla_policies for select
  to authenticated
  using (true);

drop policy if exists "SLA thresholds are viewable by authenticated users" on public.sla_thresholds;
create policy "SLA thresholds are viewable by authenticated users"
  on public.sla_thresholds for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage SLA policies" on public.sla_policies;
create policy "Admins can manage SLA policies"
  on public.sla_policies for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can manage SLA thresholds" on public.sla_thresholds;
create policy "Admins can manage SLA thresholds"
  on public.sla_thresholds for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- =======================================
-- 2) TICKET STAGE HISTORY (TIMINGS)
-- =======================================
create table if not exists public.ticket_stage_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  stage text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds int,
  is_paused boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_ticket_stage_history_ticket_id
  on public.ticket_stage_history (ticket_id);

create index if not exists idx_ticket_stage_history_stage
  on public.ticket_stage_history (stage);

alter table public.ticket_stage_history enable row level security;

drop policy if exists "Stage history is viewable by authenticated users" on public.ticket_stage_history;
create policy "Stage history is viewable by authenticated users"
  on public.ticket_stage_history for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage stage history" on public.ticket_stage_history;
create policy "Admins can manage stage history"
  on public.ticket_stage_history for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Create initial stage history on insert
create or replace function public.handle_ticket_stage_history_insert()
returns trigger as $$
begin
  insert into public.ticket_stage_history (
    ticket_id, stage, started_at, is_paused
  ) values (
    new.id,
    new.stage,
    coalesce(new.created_at, now()),
    new.stage in ('pending_client', 'paused')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Update stage history on stage change
create or replace function public.handle_ticket_stage_history_update()
returns trigger as $$
begin
  if new.stage is distinct from old.stage then
    update public.ticket_stage_history
      set ended_at = now(),
          duration_seconds = extract(epoch from (now() - started_at))::int
    where ticket_id = new.id and ended_at is null;

    insert into public.ticket_stage_history (
      ticket_id, stage, started_at, is_paused
    ) values (
      new.id,
      new.stage,
      now(),
      new.stage in ('pending_client', 'paused')
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_ticket_stage_history_insert on public.tickets;
create trigger on_ticket_stage_history_insert
  after insert on public.tickets
  for each row
  execute function public.handle_ticket_stage_history_insert();

drop trigger if exists on_ticket_stage_history_update on public.tickets;
create trigger on_ticket_stage_history_update
  after update on public.tickets
  for each row
  execute function public.handle_ticket_stage_history_update();

-- Backfill for existing tickets without history
insert into public.ticket_stage_history (ticket_id, stage, started_at, is_paused)
select t.id,
       t.stage,
       t.created_at,
       t.stage in ('pending_client', 'paused')
from public.tickets t
where not exists (
  select 1 from public.ticket_stage_history h
  where h.ticket_id = t.id
);

-- =========================
-- 3) REALTIME PUBLICATION
-- =========================
alter publication supabase_realtime add table public.sla_policies;
alter publication supabase_realtime add table public.sla_thresholds;
alter publication supabase_realtime add table public.ticket_stage_history;

-- =========================
-- 4) SLA STATUS VIEW
-- =========================
create or replace view public.ticket_sla_status as
select
  t.id as ticket_id,
  t.created_at,
  t.priority,
  t.application,
  t.entity_id,
  th.id as threshold_id,
  th.policy_id,
  th.warning_minutes,
  th.breach_minutes,
  floor(extract(epoch from (now() - t.created_at)) / 60)::int as elapsed_minutes,
  case
    when th.id is null then null
    when floor(extract(epoch from (now() - t.created_at)) / 60)::int >= th.breach_minutes then 'Atrasado'
    when floor(extract(epoch from (now() - t.created_at)) / 60)::int >= th.warning_minutes then 'En riesgo'
    else 'A tiempo'
  end as sla_status
from public.tickets t
left join lateral (
  select *
  from public.sla_thresholds th
  where th.policy_id in (select id from public.sla_policies where is_active = true)
    and (th.priority is null or th.priority = t.priority)
    and (th.application is null or th.application = t.application)
    and (th.entity_id is null or th.entity_id = t.entity_id)
  order by
    (th.priority is not null)::int desc,
    (th.application is not null)::int desc,
    (th.entity_id is not null)::int desc
  limit 1
) th on true;
