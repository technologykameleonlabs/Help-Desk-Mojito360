-- Add assigned_to column to entities
alter table public.entities
  add column if not exists assigned_to uuid references public.profiles(id);

create index if not exists entities_assigned_to_idx
  on public.entities (assigned_to);
