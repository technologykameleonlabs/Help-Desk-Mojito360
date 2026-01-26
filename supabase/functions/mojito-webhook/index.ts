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
  Attachments?: string[] | null
  attachments?: string[] | null
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
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

    const ticketData = {
      external_ref: String(payload.Id),
      external_source: 'Mojito360',
      title: payload.Subject ?? 'Sin título',
      description: payload.Description ?? null,
      stage: mapStatus(payload.Status),
      application: 'Mojito360',
      external_url: payload.Id
        ? `https://app.mojito360.com/resources/support/detail-case/${payload.Id}`
        : null,
      updated_at: new Date().toISOString(),
    }

    const { data: savedTicket, error } = await supabase
      .from('tickets')
      .upsert(ticketData, {
        onConflict: 'external_source,external_ref',
      })
      .select('id')
      .single()

    if (error) {
      console.error(error)
      return new Response('Supabase error', { status: 500 })
    }

    const attachmentUrls = normalizeAttachmentUrls(payload)
    if (attachmentUrls.length > 0) {
      const { data: settings, error: settingsError } = await supabase
        .from('app_settings')
        .select('system_user_id')
        .eq('id', 1)
        .single()

      if (settingsError) {
        console.warn('app_settings error:', settingsError)
      }

      if (!settings?.system_user_id) {
        console.warn('app_settings.system_user_id no esta configurado')
      } else {
        const { data: existingRows, error: existingError } = await supabase
          .from('attachments')
          .select('external_url')
          .eq('ticket_id', savedTicket.id)
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
            ticket_id: savedTicket.id,
            comment_id: null,
            uploaded_by: settings.system_user_id,
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
