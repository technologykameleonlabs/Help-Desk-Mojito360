-- ============================================================
-- RLS para ticket_labels: permitir a usuarios autenticados
-- leer, insertar y borrar (asignar/quitar etiquetas a tickets).
-- El 403 en INSERT venía de tener RLS activo sin políticas que lo permitan.
-- ============================================================

-- Asegurar RLS (por si la tabla se creó sin él)
alter table if exists public.ticket_labels enable row level security;

-- SELECT: cualquier usuario autenticado puede ver las filas
drop policy if exists "ticket_labels are viewable by authenticated users" on public.ticket_labels;
create policy "ticket_labels are viewable by authenticated users"
  on public.ticket_labels for select
  to authenticated
  using (true);

-- INSERT: cualquier usuario autenticado puede añadir etiquetas a un ticket
-- (alineado con "Authenticated users can create/update tickets")
drop policy if exists "Authenticated users can insert ticket_labels" on public.ticket_labels;
create policy "Authenticated users can insert ticket_labels"
  on public.ticket_labels for insert
  to authenticated
  with check (true);

-- DELETE: cualquier usuario autenticado puede quitar etiquetas de un ticket
drop policy if exists "Authenticated users can delete ticket_labels" on public.ticket_labels;
create policy "Authenticated users can delete ticket_labels"
  on public.ticket_labels for delete
  to authenticated
  using (true);
