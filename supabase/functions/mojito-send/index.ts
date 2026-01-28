import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-origin',
}

type MojitoSendPayload = {
  action?: 'create' | 'update' | 'message' | null
  ticket_id?: string | null
  comment_id?: string | null
  message?: string | null
  is_solution?: boolean | null
  author?: string | null
  external_ref?: string | null
  status?: string | null
  stage?: string | null
  title?: string | null
  description?: string | null
  category?: string | null
  company?: string | null
}

const MOJITO_HEADERS = (accessToken: string, origin: string) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/json',
  'x-language': 'es-ES',
  'X-Origin': origin,
})

function mapStageToMojitoStatus(stage?: string | null): string | null {
  switch (stage) {
    case 'new': return 'created'
    case 'assigned': return 'asigned'
    case 'pending_client': return 'infoPending'
    case 'pending_validation': return 'approvalPending'
    case 'paused': return 'paused'
    case 'cancelled': return 'cancelled'
    case 'done': return 'completed'
    default: return null
  }
}

function apiUrl(apiBase: string, path: string): string {
  const base = apiBase.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

async function getMojitoToken(env: {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope: string
}): Promise<string> {
  const { tokenUrl, clientId, clientSecret, scope } = env
  const tokenResp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  })
  if (!tokenResp.ok) {
    const err = await tokenResp.text()
    console.error('[mojito-send] getMojitoToken: respuesta no ok', { status: tokenResp.status, response: err })
    throw new Error(`Token Mojito: ${err}`)
  }
  const data = await tokenResp.json()
  if (!data.access_token) {
    console.error('[mojito-send] getMojitoToken: sin access_token en respuesta', { keys: Object.keys(data ?? {}) })
    throw new Error('Token no retornó access_token')
  }
  return data.access_token
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const tokenUrl = Deno.env.get('MOJITO_TOKEN_URL') || ''
    const clientId = Deno.env.get('MOJITO_CLIENT_ID') || ''
    const clientSecret = Deno.env.get('MOJITO_CLIENT_SECRET') || ''
    const scope = Deno.env.get('MOJITO_SCOPE') || ''
    const apiBase = Deno.env.get('MOJITO_API_BASE_URL') || ''

    if (!tokenUrl || !clientId || !clientSecret || !apiBase) {
      return new Response(JSON.stringify({ error: 'Faltan variables de entorno (token, api base)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenEnv = { tokenUrl, clientId, clientSecret, scope }
    const originHeader = req.headers.get('X-Origin') || 'HelpDesk'

    // ——— GET: prueba de conexión ———
    if (req.method === 'GET') {
      const accessToken = await getMojitoToken(tokenEnv)
      const getUrl = apiUrl(apiBase, '/api/Help')
      const getResp = await fetch(getUrl, {
        method: 'GET',
        headers: MOJITO_HEADERS(accessToken, originHeader),
      })
      const bodyText = await getResp.text()
      let bodyJson: unknown = null
      try {
        bodyJson = bodyText ? JSON.parse(bodyText) : null
      } catch {
        bodyJson = bodyText.slice(0, 500)
      }
      return new Response(
        JSON.stringify({ ok: getResp.ok, status: getResp.status, url: getUrl, body: bodyJson }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ——— POST: create | update | message ———
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Faltan SUPABASE_URL o SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = (await req.json()) as MojitoSendPayload
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    if (payload.action === 'create') {
      const ticketId = payload.ticket_id
      if (!ticketId) {
        console.error('[mojito-send] create: falta ticket_id', { payload: { action: payload.action } })
        return new Response(JSON.stringify({ error: 'action create requiere ticket_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: ticket, error: te } = await supabase
        .from('tickets')
        .select('id, title, description, stage, category, entity_id, created_by, created_by_email')
        .eq('id', ticketId)
        .maybeSingle()
      if (te || !ticket) {
        console.error('[mojito-send] create: ticket no encontrado', { ticket_id: ticketId, error: te })
        return new Response(JSON.stringify({ error: 'Ticket no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let company = ''
      if (ticket.entity_id) {
        const { data: ent } = await supabase
          .from('entities')
          .select('name')
          .eq('id', ticket.entity_id)
          .maybeSingle()
        if (ent?.name) company = ent.name
      }

      let userEmail = ticket.created_by_email ?? ''
      if (!userEmail && ticket.created_by) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', ticket.created_by)
          .maybeSingle()
        if (prof?.email) userEmail = prof.email
      }
      if (!userEmail) userEmail = ''

      const status = mapStageToMojitoStatus(ticket.stage) || 'created'
      const form = new FormData()
      form.append('User', userEmail)
      form.append('Subject', ticket.title ?? '')
      form.append('Status', status)
      form.append('Description', ticket.description ?? '')
      form.append('Company', company)
      form.append('Category', ticket.category ?? '')
      form.append('Subcategory', '')

      const accessToken = await getMojitoToken(tokenEnv)
      const createUrl = apiUrl(apiBase, '/api/Help')
      const createResp = await fetch(createUrl, {
        method: 'POST',
        headers: MOJITO_HEADERS(accessToken, originHeader),
        body: form,
      })

      if (!createResp.ok) {
        const errText = await createResp.text()
        console.error('[mojito-send] create: error API Mojito', { status: createResp.status, url: createUrl, response: errText, ticket_id: ticketId })
        return new Response(JSON.stringify({ error: 'Error creando ticket en Mojito', details: errText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let mojitoId: number | null = null
      const createBody = await createResp.text()
      try {
        const parsed = JSON.parse(createBody)
        if (typeof parsed === 'number') mojitoId = parsed
        else if (parsed?.id != null) mojitoId = Number(parsed.id)
      } catch {
        // response was "true" or non-JSON
      }

      if (mojitoId == null) {
        const listResp = await fetch(createUrl, {
          method: 'GET',
          headers: MOJITO_HEADERS(accessToken, originHeader),
        })
        if (listResp.ok) {
          const list = (await listResp.json()) as Array<{ id: number; user?: string; subject?: string; createdOn?: string }>
          const recent = list
            ?.filter((t) => (t.user === userEmail || !userEmail) && (t.subject === ticket.title || !ticket.title))
            .sort((a, b) => new Date(b.createdOn ?? 0).getTime() - new Date(a.createdOn ?? 0).getTime())[0]
          if (recent?.id) mojitoId = recent.id
        }
      }

      if (mojitoId == null) {
        console.error('[mojito-send] create: no se pudo obtener id tras POST', { ticket_id: ticketId, createResponseBody: createBody?.slice?.(0, 200) })
        return new Response(JSON.stringify({ error: 'No se pudo obtener el id del ticket creado en Mojito' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const externalUrl = `https://app.mojito360.com/resources/support/detail-case/${mojitoId}`
      const { error: upErr } = await supabase
        .from('tickets')
        .update({
          external_ref: String(mojitoId),
          external_source: 'Mojito360',
          external_url: externalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      if (upErr) {
        console.error('[mojito-send] create: falló update local con external_ref', { ticket_id: ticketId, mojito_id: mojitoId, error: upErr })
        return new Response(JSON.stringify({ error: 'Ticket creado en Mojito pero falló actualizar local', details: String(upErr) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ ok: true, external_ref: String(mojitoId), external_url: externalUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payload.action === 'message') {
      const ticketId = payload.ticket_id
      if (!ticketId) {
        return new Response(JSON.stringify({ error: 'action message requiere ticket_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let author = payload.author ?? ''
      let message = payload.message ?? ''
      let messageDate = new Date().toISOString()

      if (payload.comment_id) {
        const { data: comment, error: ce } = await supabase
          .from('comments')
          .select('content, user_id, created_at')
          .eq('id', payload.comment_id)
          .eq('ticket_id', ticketId)
          .maybeSingle()
        if (ce || !comment) {
          console.error('[mojito-send] message: comentario no encontrado', { ticket_id: ticketId, comment_id: payload.comment_id, error: ce })
          return new Response(JSON.stringify({ error: 'Comentario no encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        message = comment.content ?? ''
        if (comment.created_at) messageDate = new Date(comment.created_at).toISOString()
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', comment.user_id).maybeSingle()
        author = prof?.email ?? ''
      }

      if (!message) {
        console.error('[mojito-send] message: sin contenido', { ticket_id: ticketId, payload: { action: payload.action, comment_id: payload.comment_id } })
        return new Response(JSON.stringify({ error: 'message o comment_id con contenido requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: ticket, error: te } = await supabase
        .from('tickets')
        .select('external_ref, external_source')
        .eq('id', ticketId)
        .maybeSingle()
      if (te || !ticket?.external_ref || ticket.external_source !== 'Mojito360') {
        console.error('[mojito-send] message: ticket no Mojito360 o sin external_ref', { ticket_id: ticketId, error: te })
        return new Response(JSON.stringify({ error: 'Ticket no es de Mojito360 o sin external_ref' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const accessToken = await getMojitoToken(tokenEnv)
      const messageUrl = apiUrl(apiBase, `/api/Help/message/${ticket.external_ref}`)
      const messageBody = {
        type: 'user' as const,
        author: author || 'soporte@helpdesk',
        message,
        date: messageDate,
        attachments: [] as Array<{ filename: string; file: string; uri: string }>,
      }
      const msgResp = await fetch(messageUrl, {
        method: 'POST',
        headers: {
          ...MOJITO_HEADERS(accessToken, originHeader),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      })

      if (!msgResp.ok) {
        const errText = await msgResp.text()
        console.error('[mojito-send] message: error API Mojito', { status: msgResp.status, url: messageUrl, response: errText, ticket_id: ticketId, comment_id: payload.comment_id ?? null })
        return new Response(JSON.stringify({ error: 'Error enviando mensaje a Mojito', details: errText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ——— update (explícito o legacy desde trigger) ———
    let externalRef = payload.external_ref ?? null
    let title = payload.title ?? null
    let description = payload.description ?? null
    let category = payload.category ?? null
    let company = payload.company ?? null

    if (payload.ticket_id) {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('external_ref, external_source, title, description, category, entity_id')
        .eq('id', payload.ticket_id)
        .maybeSingle()
      if (error) {
        console.error('[mojito-send] update: error leyendo ticket', { ticket_id: payload.ticket_id, error })
        throw error
      }
      if (!ticket?.external_ref || ticket.external_source !== 'Mojito360') {
        console.error('[mojito-send] update: ticket no es de Mojito360', { ticket_id: payload.ticket_id })
        return new Response(JSON.stringify({ error: 'Ticket no es de Mojito360' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      externalRef = ticket.external_ref
      title = title ?? ticket.title
      description = description ?? ticket.description
      if (category === null) category = ticket.category
      if (company === null && ticket.entity_id) {
        const { data: ent } = await supabase.from('entities').select('name').eq('id', ticket.entity_id).maybeSingle()
        if (ent?.name) company = ent.name
      }
    }

    if (!externalRef) {
      console.error('[mojito-send] update: sin external_ref ni ticket_id válido', { payload: { action: payload.action, ticket_id: payload.ticket_id, external_ref: payload.external_ref } })
      return new Response(JSON.stringify({ error: 'external_ref o ticket_id de Mojito360 requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mojitoStatus = payload.status ?? mapStageToMojitoStatus(payload.stage)
    const putBody: Record<string, unknown> = {}
    if (mojitoStatus != null) putBody.status = mojitoStatus
    if (category != null) putBody.category = category
    if (company != null) putBody.company = company
    if (title != null) putBody.subject = title
    if (description != null) putBody.description = description

    const accessToken = await getMojitoToken(tokenEnv)
    const putUrl = apiUrl(apiBase, `/api/Help/ticket/${externalRef}`)
    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        ...MOJITO_HEADERS(accessToken, originHeader),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    })

    if (!putResp.ok) {
      const errText = await putResp.text()
      console.error('[mojito-send] update: error API Mojito', { status: putResp.status, url: putUrl, response: errText, ticket_id: payload.ticket_id, external_ref: externalRef })
      return new Response(JSON.stringify({ error: 'Error actualizando Mojito', details: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ ok: true, external_ref: externalRef, status: mojitoStatus ?? undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[mojito-send] error inesperado', { message: msg, stack })
    return new Response(JSON.stringify({ error: 'Error inesperado', details: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
