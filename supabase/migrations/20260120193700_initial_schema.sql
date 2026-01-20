-- ============================================
-- Mojito360 Help Desk - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension (usually enabled by default)
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  role text check (role in ('admin', 'agent', 'dev')) default 'agent',
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Trigger to create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 2. ENTITIES (Clients/Partners)
-- ============================================
create table if not exists public.entities (
  id uuid default gen_random_uuid() primary key,
  external_id text, -- ID from Odoo
  name text not null,
  status text check (status in ('active', 'inactive')) default 'active',
  usage text, -- 'Producción', 'Interna', 'Test'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.entities enable row level security;

create policy "Entities are viewable by authenticated users"
  on public.entities for select
  to authenticated
  using (true);

create policy "Admins can manage entities"
  on public.entities for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================
-- 3. TICKETS
-- ============================================
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  ticket_ref serial,
  title text not null,
  description text,
  
  -- Stage (Kanban column)
  stage text check (stage in (
    'new', 'assigned', 'in_progress', 'pending_dev', 'pending_sales',
    'pending_client', 'testing', 'pending_validation', 'done', 'paused', 'cancelled'
  )) default 'new',
  
  priority text check (priority in ('low', 'medium', 'high', 'critical')) default 'medium',
  
  -- Relations
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  entity_id uuid references public.entities(id),
  
  -- Custom fields (from Odoo x_studio_*)
  application text, -- 'Mojito360', 'Wintruck', 'Odoo'
  classification text, -- 'Soporte', 'Desarrollo'
  channel text, -- 'APP Tickets', 'Email', 'Teams'
  origin text, -- 'Externo', 'Interno'
  ticket_type text, -- 'Alertas', 'Carga', 'Dato', etc.
  commitment_date timestamptz,
  estimated_time int, -- minutes
  responsibility text, -- 'Propia', 'Cliente'
  sharepoint_url text,
  solution text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.tickets enable row level security;

create policy "Tickets are viewable by authenticated users"
  on public.tickets for select
  to authenticated
  using (true);

create policy "Authenticated users can create tickets"
  on public.tickets for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update tickets"
  on public.tickets for update
  to authenticated
  using (true);

-- ============================================
-- 4. COMMENTS
-- ============================================
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  is_internal boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.comments enable row level security;

create policy "Comments are viewable by authenticated users"
  on public.comments for select
  to authenticated
  using (true);

create policy "Authenticated users can create comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ============================================
-- 5. ENABLE REALTIME
-- ============================================
alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.comments;

-- ============================================
-- DONE! Now run the seed script to load entities.
-- ============================================
