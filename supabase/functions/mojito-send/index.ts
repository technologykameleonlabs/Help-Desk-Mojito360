import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type MojitoSendPayload = {
  ticket_id?: string | null
  external_ref?: string | null
  status?: string | null
  stage?: string | null
  title?: string | null
  description?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const originHeader = req.headers.get('X-Origin') || 'HelpDesk'
    const payload = (await req.json()) as MojitoSendPayload

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const tokenUrl = Deno.env.get('MOJITO_TOKEN_URL') || ''
    const clientId = Deno.env.get('MOJITO_CLIENT_ID') || ''
    const clientSecret = Deno.env.get('MOJITO_CLIENT_SECRET') || ''
    const scope = Deno.env.get('MOJITO_SCOPE') || ''
    const apiBase = Deno.env.get('MOJITO_API_BASE_URL') || ''
    const updatePath = Deno.env.get('MOJITO_API_UPDATE_PATH') || '/tickets/update'

    if (!supabaseUrl || !serviceKey || !tokenUrl || !clientId || !clientSecret || !apiBase) {
      return new Response(JSON.stringify({ error: 'Faltan variables de entorno' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    let externalRef = payload.external_ref ?? null
    let title = payload.title ?? null
    let description = payload.description ?? null

    if (!externalRef && payload.ticket_id) {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('external_ref, external_source, title, description')
        .eq('id', payload.ticket_id)
        .maybeSingle()

      if (error) throw error
      if (!ticket?.external_ref || ticket.external_source !== 'Mojito360') {
        return new Response(JSON.stringify({ error: 'Ticket no es de Mojito360' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      externalRef = ticket.external_ref
      title = title ?? ticket.title
      description = description ?? ticket.description
    }

    if (!externalRef) {
      return new Response(JSON.stringify({ error: 'external_ref requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mojitoStatus = payload.status || mapStageToMojitoStatus(payload.stage)

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
      console.error('Mojito token error:', err)
      return new Response(JSON.stringify({ error: 'Token Mojito inválido' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenData = await tokenResp.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Token Mojito no retornó access_token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const updateUrl = buildUpdateUrl(apiBase, updatePath)

    const updateResp = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Origin': originHeader,
      },
      body: JSON.stringify({
        Id: Number(externalRef),
        Subject: title ?? undefined,
        Description: description ?? undefined,
        Status: mojitoStatus ?? undefined,
      }),
    })

    if (!updateResp.ok) {
      const errText = await updateResp.text()
      console.error('Mojito update error:', errText)
      return new Response(JSON.stringify({ error: 'Error actualizando Mojito' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, external_ref: externalRef, status: mojitoStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'Error inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
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

function buildUpdateUrl(apiBase: string, updatePath: string): string {
  if (updatePath.startsWith('http')) return updatePath
  const base = apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  const path = updatePath.startsWith('/') ? updatePath.slice(1) : updatePath
  return new URL(path, base).toString()
}
