-- ============================================================
-- Integración Mojito: URL fija, trigger ampliado (stage/category/company)
-- y trigger para mensajes en comments.
-- Ejecutar en el SQL Editor de Supabase en este orden (todo el archivo).
-- ============================================================

-- Requiere extensión pg_net (ya disponible en Supabase).
-- La URL de la Edge es: https://evhwlybmnimzdepnlqrn.supabase.co/functions/v1/mojito-send

-- --------------------------------------------------------------
-- 1) Función notify_mojito_on_stage_change (URL + category + company)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_mojito_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  webhook_url text := 'https://evhwlybmnimzdepnlqrn.supabase.co/functions/v1/mojito-send';
  company_name text;
begin
  -- Si el cambio viene de Mojito, no se reenvía y se limpia el flag
  if new.skip_mojito_sync = true then
    if pg_trigger_depth() = 1 then
      update public.tickets
      set skip_mojito_sync = false
      where id = new.id;
    end if;
    return new;
  end if;

  -- Disparar cuando sea ticket de Mojito360 y cambie stage, category o entity_id
  if new.external_source = 'Mojito360'
     and (
       new.stage is distinct from old.stage
       or new.category is distinct from old.category
       or new.entity_id is distinct from old.entity_id
     ) then

    -- Resolver company desde entidad (entities.name)
    company_name := null;
    if new.entity_id is not null then
      select name into company_name
      from public.entities
      where id = new.entity_id;
    end if;

    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Origin', 'HelpDesk'
      ),
      body := jsonb_build_object(
        'ticket_id', new.id,
        'stage', new.stage,
        'category', new.category,
        'company', company_name
      )
    );
  end if;

  return new;
end;
$function$;

-- El trigger on_ticket_stage_notify_mojito ya existe y usa esta función;
-- no es necesario crearlo de nuevo. Si en tu proyecto tiene otro nombre,
-- asegúrate de que apunte a notify_mojito_on_stage_change.

-- --------------------------------------------------------------
-- 2) Función para notificar a Mojito al insertar un comentario público
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_mojito_on_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  webhook_url text := 'https://evhwlybmnimzdepnlqrn.supabase.co/functions/v1/mojito-send';
  v_ticket record;
begin
  if new.is_internal = true then
    return new;
  end if;

  select external_source, external_ref into v_ticket
  from public.tickets
  where id = new.ticket_id;

  if v_ticket.external_source = 'Mojito360' and v_ticket.external_ref is not null then
    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Origin', 'HelpDesk'
      ),
      body := jsonb_build_object(
        'action', 'message',
        'ticket_id', new.ticket_id,
        'comment_id', new.id
      )
    );
  end if;

  return new;
end;
$function$;

-- --------------------------------------------------------------
-- 3) Trigger en comments para enviar mensajes públicos a Mojito
-- --------------------------------------------------------------
DROP TRIGGER IF EXISTS on_comment_notify_mojito ON public.comments;

CREATE TRIGGER on_comment_notify_mojito
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mojito_on_comment_insert();
