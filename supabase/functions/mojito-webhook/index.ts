// index.ts (Supabase Edge Function - mojito-webhook)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type TicketDto = {
  Id?: number | null
  Subject?: string | null
  Description?: string | null
  Status?: string | null
  CreatedOn?: string | null
  UpdatedOn?: string | null
  Category?: string | null
  Subcategory?: string | null
  Company?: string | null
  User?: string | null
  UserEmail?: string | null
  MessageAuthorEmail?: string | null
  LastMessageAuthorEmail?: string | null
  MessageBody?: string | null
  MessageIsPublic?: boolean | null
  Attachments?: string[] | null
  attachments?: string[] | null
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const originHeader = req.headers.get('X-Origin')
    if (originHeader === 'HelpDesk') {
      return new Response(JSON.stringify({ ok: true, skipped: 'origin' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Auth header
    const auth = req.headers.get('Authorization') || ''
    const secret = Deno.env.get('MOJITO_WEBHOOK_SECRET') || ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = (await req.json()) as TicketDto

    if (!payload?.Id) {
      return new Response('Bad Request: missing Id', { status: 400 })
    }

    // Supabase client (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const externalRef = String(payload.Id)
    const nowIso = new Date().toISOString()

    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id, stage, created_by_email, closed_at, ticket_ref, title, description')
      .eq('external_source', 'Mojito360')
      .eq('external_ref', externalRef)
      .maybeSingle()

    const clientEmail = getClientEmail(payload)
    const creatorEmail = normalizeEmail(existingTicket?.created_by_email || payload.UserEmail || payload.User || null)
    const isClientInteraction =
      !!clientEmail && !!creatorEmail && clientEmail === creatorEmail

    const { data: settings } = await supabase
      .from('app_settings')
      .select('reopen_window_days, system_user_id')
      .eq('id', 1)
      .maybeSingle()

    const reopenWindowDays = settings?.reopen_window_days ?? 15

    // Resolver entidad por Company (match exacto por entities.name) y tomar asignado/responsable
    type ResolvedEntity = { id: string; assigned_to: string | null }
    let resolvedEntity: ResolvedEntity | null = null
    const companyName = typeof payload.Company === 'string' ? payload.Company.trim() : ''
    if (companyName) {
      const { data: entityRow } = await supabase
        .from('entities')
        .select('id, assigned_to')
        .eq('name', companyName)
        .limit(1)
        .maybeSingle()
      if (entityRow?.id) {
        resolvedEntity = {
          id: entityRow.id,
          assigned_to: entityRow.assigned_to ?? null,
        }
      }
    }

    const baseTicketData = {
      external_ref: externalRef,
      external_source: 'Mojito360',
      title: payload.Subject ?? existingTicket?.title ?? 'Sin título',
      description: payload.Description ?? existingTicket?.description ?? null,
      stage: mapStatus(payload.Status),
      application: 'Mojito360',
      external_url: payload.Id
        ? `https://app.mojito360.com/resources/support/detail-case/${payload.Id}`
        : null,
      created_by_email: creatorEmail ?? null,
      skip_mojito_sync: true,
      updated_at: nowIso,
      ...(resolvedEntity && {
        entity_id: resolvedEntity.id,
        ...(resolvedEntity.assigned_to && { assigned_to: resolvedEntity.assigned_to }),
      }),
    }

    let savedTicket = existingTicket

    // Reapertura automática si el ticket está completado y el cliente interactúa
    if (existingTicket && existingTicket.stage === 'done' && isClientInteraction) {
      const withinWindow = isWithinReopenWindow(existingTicket.closed_at, reopenWindowDays)

      if (withinWindow) {
        const { data: reopenedTicket, error } = await supabase
          .from('tickets')
          .upsert(
            {
              ...baseTicketData,
              stage: 'assigned',
              last_client_activity_at: nowIso,
            },
            { onConflict: 'external_source,external_ref' }
          )
          .select('id')
          .single()

        if (error) {
          console.error(error)
          return new Response('Supabase error', { status: 500 })
        }

        savedTicket = reopenedTicket
      } else {
        // Reapertura caducada: crear nuevo ticket y referenciar al anterior
        const { data: existingChild } = await supabase
          .from('tickets')
          .select('id, stage')
          .eq('reopened_from_ticket_id', existingTicket.id)
          .not('stage', 'in', '("done","cancelled")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingChild?.id) {
          await supabase
            .from('tickets')
            .update({ last_client_activity_at: nowIso, updated_at: nowIso, skip_mojito_sync: true })
            .eq('id', existingChild.id)
          savedTicket = existingChild
        } else {
          const newDescription = buildLateReopenDescription(
            payload.Description ?? null,
            existingTicket.ticket_ref,
            externalRef
          )

          const { data: newTicket, error } = await supabase
            .from('tickets')
            .insert({
              title: baseTicketData.title,
              description: newDescription,
              stage: 'assigned',
              application: 'Mojito360',
              created_by_email: creatorEmail ?? null,
              reopened_from_ticket_id: existingTicket.id,
              last_client_activity_at: nowIso,
              skip_mojito_sync: true,
              updated_at: nowIso,
              ...(resolvedEntity && {
                entity_id: resolvedEntity.id,
                ...(resolvedEntity.assigned_to && { assigned_to: resolvedEntity.assigned_to }),
              }),
            })
            .select('id')
            .single()

          if (error) {
            console.error(error)
            return new Response('Supabase error', { status: 500 })
          }

          savedTicket = newTicket
        }
      }
    } else {
      const { data: upsertedTicket, error } = await supabase
        .from('tickets')
        .upsert(baseTicketData, {
          onConflict: 'external_source,external_ref',
        })
        .select('id')
        .single()

      if (error) {
        console.error(error)
        return new Response('Supabase error', { status: 500 })
      }

      savedTicket = upsertedTicket
    }

    const attachmentUrls = normalizeAttachmentUrls(payload)
    if (attachmentUrls.length > 0) {
      const systemUserId = settings?.system_user_id

      if (!systemUserId) {
        console.warn('app_settings.system_user_id no esta configurado')
      } else {
        const { data: existingRows, error: existingError } = await supabase
          .from('attachments')
          .select('external_url')
          .eq('ticket_id', savedTicket?.id)
          .in('external_url', attachmentUrls)

        if (existingError) {
          console.warn('Attachments lookup error:', existingError)
        }

        const existingUrls = new Set(
          (existingRows || []).map(row => row.external_url).filter(Boolean) as string[]
        )

        const newRows = attachmentUrls
          .filter(url => !existingUrls.has(url))
          .map(url => ({
            ticket_id: savedTicket?.id,
            comment_id: null,
            uploaded_by: systemUserId,
            file_name: extractFileName(url),
            file_size: null,
            file_type: null,
            storage_path: null,
            external_url: url,
          }))

        if (newRows.length > 0) {
          const { error: insertError } = await supabase
            .from('attachments')
            .insert(newRows)

          if (insertError) {
            console.warn('Attachments insert error:', insertError)
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response('Server error', { status: 500 })
  }
})

function normalizeAttachmentUrls(payload: TicketDto): string[] {
  const urls = payload.Attachments ?? payload.attachments ?? []
  return urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : null
}

function getClientEmail(payload: TicketDto): string | null {
  return (
    normalizeEmail(payload.MessageAuthorEmail ?? null) ||
    normalizeEmail(payload.LastMessageAuthorEmail ?? null) ||
    normalizeEmail(payload.UserEmail ?? null) ||
    normalizeEmail(payload.User ?? null)
  )
}

function isWithinReopenWindow(closedAt: string | null, windowDays: number): boolean {
  if (!closedAt) return true
  const closed = new Date(closedAt)
  const limit = new Date(closed.getTime() + windowDays * 24 * 60 * 60 * 1000)
  return new Date() <= limit
}

function buildLateReopenDescription(
  description: string | null,
  ticketRef: number | null,
  externalRef: string
): string | null {
  const header = `Reapertura tardía del ticket #${ticketRef ?? ''} (Mojito ID ${externalRef}).`
    .replace(/\s+/g, ' ')
    .trim()
  if (!description) return header
  return `${header}\n\n${description}`
}

function extractFileName(url: string): string {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname || ''
    const last = pathname.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : 'archivo'
  } catch {
    const last = url.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : 'archivo'
  }
}

// Mapeo de estados (ajústalo cuando definan equivalencias)
function mapStatus(status?: string | null) {
  switch (status) {
    case 'created': return 'new'
    case 'asigned': return 'assigned'
    case 'infoPending': return 'pending_client'
    case 'approvalPending': return 'pending_validation'
    case 'paused': return 'paused'
    case 'cancelled': return 'cancelled'
    case 'completed': return 'done'
    default: return 'new'
  }
}
