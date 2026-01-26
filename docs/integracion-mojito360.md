# Integracion Mojito360 (Supabase + Help Desk)

Este documento describe la integracion entre Mojito360 y el Help Desk, las Edge Functions disponibles, el cron job y las consideraciones de datos para tickets y adjuntos.

## Estado actual

- La logica general de tickets y adjuntos ya funciona en la app.
- Las funciones **no dependientes** de la integracion (auto cierre y notificaciones) estan en uso.
- Las funciones de integracion con Mojito (envio y webhook) **no estan probadas** aun.

## Edge Functions

### 1) auto-close-pending-validation

**Proposito**: Cierra automaticamente tickets en estado `pending_validation` cuando no hay actividad del cliente durante N horas. Agrega un comentario publico y envia email si hay correo.

**Entrada**: Sin payload. Se ejecuta por cron.

**Salida**: JSON con cantidad de tickets cerrados y si se envio email.

**Variables de entorno**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

**Tablas usadas**:
- `app_settings` (id=1, `auto_close_pending_validation_hours`, `system_user_id`)
- `tickets`
- `comments`
- `profiles`

---

### 2) mojito-send

**Proposito**: Envia actualizaciones de ticket hacia Mojito360 usando OAuth client_credentials.

**Entrada** (JSON):
```json
{
  "external_ref": "string",
  "title": "string",
  "description": "string",
  "status": "string"
}
```

**Salida**: `{ "ok": true }` o error 500 si falla token o llamada a Mojito.

**Variables de entorno**:
- `MOJITO_TOKEN_URL`
- `MOJITO_CLIENT_ID`
- `MOJITO_CLIENT_SECRET`
- `MOJITO_SCOPE` (opcional)
- `MOJITO_API_BASE_URL`

---

### 3) mojito-webhook

**Proposito**: Recibe webhooks de Mojito360 y crea/actualiza tickets en Supabase.

**Auth**: Header `Authorization: Bearer <MOJITO_WEBHOOK_SECRET>`.

**Entrada** (JSON, ejemplo):
```json
{
  "Id": 952,
  "Subject": "Test Ticket de Alerta",
  "Description": "<p>Texto con HTML...</p>",
  "Status": "created",
  "CreatedOn": "2026-01-26T14:12:19.8129496+00:00",
  "UpdatedOn": "2026-01-26T14:12:19.7576311+00:00",
  "Category": "alerts",
  "Subcategory": "subcat",
  "Company": "Demo",
  "User": "david@kameleonlabs.ai",
  "Attachments": [
    "https://mojitoprestorage.blob.core.windows.net/support/952/1769436740759/requisitos-tickets%20(4).xlsx"
  ]
}
```

**Salida**: `{ "ok": true }` o errores 4xx/5xx.

**Variables de entorno**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MOJITO_WEBHOOK_SECRET`
**Dependencias de datos**:
- `app_settings.system_user_id` se usa como `uploaded_by` para adjuntos externos.

**Mapeo de estado** (actual):
- `created` -> `new`
- `asigned` -> `assigned`
- `infoPending` -> `pending_client`
- `approvalPending` -> `pending_validation`
- `paused` -> `paused`
- `cancelled` -> `cancelled`
- `completed` -> `done`
- default -> `new`

**Upsert**: por `external_source + external_ref`.

**Adjuntos externos**:
- Si viene `Attachments`/`attachments`, se insertan en `public.attachments` con `external_url`.
- `storage_path` queda `null` (no se sube a Storage).

---

### 4) send-notification-email

**Proposito**: Envia emails agrupados de notificaciones por usuario usando Resend.

**Entrada** (JSON):
```json
{ "notificationIds": ["uuid", "uuid"] }
```

**Salida**: `{ ok: true, sentIds: [], skippedIds: [] }`

**Variables de entorno**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM` (opcional)
- `APP_BASE_URL` (opcional)

## Cron job (Supabase)

Se usa `pg_net` para invocar la Edge Function `auto-close-pending-validation`.

SQL (actual):
```sql
select
  net.http_post(
      url:='https://evhwlybmnimzdepnlqrn.supabase.co/functions/v1/auto-close-pending-validation',
      headers:=jsonb_build_object(),
      timeout_milliseconds:=1000
  );
```

**Nota**: La frecuencia del cron se configura en Supabase (Scheduler). No se requiere auth para esta funcion.

## Tickets y campos externos

La tabla `tickets` incluye campos externos (segun configuracion actual en Supabase):
- `external_ref`, `external_source`, `external_url`
- `category`, `created_by_email`, `updated_by`
- `last_client_activity_at`, `pending_validation_since`

Estos campos permiten integracion Mojito y trazabilidad de origen.

## Description con HTML

Los tickets de Mojito pueden incluir HTML en `description` (incluyendo imagenes). La app debe **sanitizar** el HTML al renderizarlo para evitar XSS y permitir tags/atributos seguros.

## Adjuntos externos (URLs)

En Mojito, `attachments` es una lista de URLs directas de descarga. La decision actual es **guardar las URLs tal cual** y mostrarlas como enlaces.

**Implicaciones**:
- Si el archivo se elimina del origen, el link quedara roto.
- No se sube nada a `ticket-attachments` (Supabase Storage).

**Requisitos en DB**:
- `attachments.external_url` debe existir.
- `attachments.storage_path`, `file_type`, `file_size` deben permitir `NULL`.

## SQL recomendado (borrador, no ejecutar)

Si se quiere reforzar integridad y performance:
```sql
-- Unicidad por sistema externo
create unique index if not exists tickets_external_source_ref_uq
  on public.tickets (external_source, external_ref);

-- Busquedas rapidas por referencia externa
create index if not exists tickets_external_ref_idx
  on public.tickets (external_ref);
```

SQL para adjuntos externos:
```sql
alter table public.attachments
  add column if not exists external_url text;

alter table public.attachments
  alter column storage_path drop not null,
  alter column file_type drop not null,
  alter column file_size drop not null;

create index if not exists attachments_external_url_idx
  on public.attachments (external_url);
```

