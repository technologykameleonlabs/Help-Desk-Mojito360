-- ============================================
-- Mojito360 Help Desk - Saved Views (Dashboard)
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1) Tabla: saved_views
-- ============================================
create table if not exists public.saved_views (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  scope text check (scope in ('dashboard')) not null,
  visibility text check (visibility in ('private', 'public')) default 'private' not null,
  config jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Evitar nombres duplicados por usuario y scope
create unique index if not exists saved_views_owner_scope_name_uq
  on public.saved_views (owner_id, scope, name);

-- Indices para listados y filtros
create index if not exists saved_views_owner_id_idx
  on public.saved_views (owner_id);
create index if not exists saved_views_scope_visibility_idx
  on public.saved_views (scope, visibility);

-- ============================================
-- 2) RLS (Row Level Security)
-- ============================================
alter table public.saved_views enable row level security;

-- Lectura: propio o publico
create policy "Saved views are viewable by owner or public"
  on public.saved_views for select
  to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
  );

-- Insercion: privados para cualquiera; publicos solo admin
create policy "Users can create private saved views"
  on public.saved_views for insert
  to authenticated
  with check (
    visibility = 'private'
    and owner_id = auth.uid()
  );

create policy "Admins can create public saved views"
  on public.saved_views for insert
  to authenticated
  with check (
    visibility = 'public'
    and owner_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Actualizacion: privados por owner; publicos solo admin
create policy "Owners can update private saved views"
  on public.saved_views for update
  to authenticated
  using (
    owner_id = auth.uid()
    and visibility = 'private'
  )
  with check (
    owner_id = auth.uid()
    and visibility = 'private'
  );

create policy "Admins can update public saved views"
  on public.saved_views for update
  to authenticated
  using (
    visibility = 'public'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    visibility = 'public'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Borrado: privados por owner; publicos solo admin
create policy "Owners can delete private saved views"
  on public.saved_views for delete
  to authenticated
  using (
    owner_id = auth.uid()
    and visibility = 'private'
  );

create policy "Admins can delete public saved views"
  on public.saved_views for delete
  to authenticated
  using (
    visibility = 'public'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- ============================================
-- 3) Notas de uso
-- ============================================
-- config: JSON con filtros, busqueda y vista actual del Dashboard.
-- scope: actualmente solo 'dashboard'.
