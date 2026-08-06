import { withSupabase } from 'npm:@supabase/server@^1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders })
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeIcs(value = '') {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r?\n/g, '\\n')
}

function localIcsDate(date: string, time: string) {
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
}

function addOneHour(date: string, time: string) {
  const temporary = new Date(`${date}T${time}:00Z`)
  temporary.setUTCHours(temporary.getUTCHours() + 1)
  return {
    date: `${temporary.getUTCFullYear()}-${String(temporary.getUTCMonth() + 1).padStart(2, '0')}-${String(temporary.getUTCDate()).padStart(2, '0')}`,
    time: `${String(temporary.getUTCHours()).padStart(2, '0')}:${String(temporary.getUTCMinutes()).padStart(2, '0')}`,
  }
}

function textToBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function displayDate(dateString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${dateString}T12:00:00Z`))
}

function createCalendarFile(event: any, invite: any, action: string, replyEmail: string) {
  const timezone = event.timezone || 'America/Sao_Paulo'
  const startTime = String(event.start_time || '09:00').slice(0, 5)
  const fallbackEnd = addOneHour(event.start_date, startTime)
  const endDate = event.end_date || (event.end_time ? event.start_date : fallbackEnd.date)
  const endTime = String(event.end_time || fallbackEnd.time).slice(0, 5)
  const cancelled = event.status === 'cancelado' || action === 'cancelled'
  const method = cancelled ? 'CANCEL' : 'REQUEST'
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apollus//Agenda de Reunioes//PT-BR',
    `METHOD:${method}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@apollusart.com`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${timezone}:${localIcsDate(event.start_date, startTime)}`,
    `DTEND;TZID=${timezone}:${localIcsDate(endDate, endTime)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description || 'Reunião Apollus')}`,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : '',
    event.external_url ? `URL:${escapeIcs(event.external_url)}` : '',
    `ORGANIZER;CN=Apollus:mailto:${replyEmail}`,
    `ATTENDEE;CN=${escapeIcs(invite.invitee_name)};RSVP=TRUE:mailto:${invite.invitee_email}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

function emailHtml(event: any, invite: any, action: string) {
  const startTime = String(event.start_time || '').slice(0, 5)
  const endTime = String(event.end_time || '').slice(0, 5)
  const actionText = action === 'updated' ? 'Os detalhes desta reunião foram atualizados.' : 'Você foi convidado(a) para uma reunião da Apollus.'
  const cancelled = event.status === 'cancelado' || action === 'cancelled'

  return `<!doctype html>
  <html lang="pt-BR"><body style="margin:0;background:#f7efe4;font-family:Arial,sans-serif;color:#101010">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px">
      <div style="background:#101010;color:white;padding:24px 28px;border-radius:22px 22px 0 0;border-top:7px solid #ffe12d">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#dcbcff">Agenda Apollus</div>
        <h1 style="margin:10px 0 0;font-size:30px">${cancelled ? 'Reunião cancelada' : escapeHtml(event.title)}</h1>
      </div>
      <div style="background:white;padding:28px;border-radius:0 0 22px 22px;border:1px solid #e5ddd3">
        <p style="font-size:16px;line-height:1.65;margin-top:0">Olá, <strong>${escapeHtml(invite.invitee_name)}</strong>.</p>
        <p style="font-size:16px;line-height:1.65">${cancelled ? 'Esta reunião foi cancelada.' : actionText}</p>
        <div style="margin:24px 0;padding:20px;background:#fffaf3;border-left:5px solid #bd87ff;border-radius:14px">
          <p style="margin:0 0 10px"><strong>Data:</strong> ${escapeHtml(displayDate(event.start_date))}</p>
          <p style="margin:0 0 10px"><strong>Horário:</strong> ${escapeHtml(startTime)}${endTime ? `–${escapeHtml(endTime)}` : ''}</p>
          ${event.location ? `<p style="margin:0 0 10px"><strong>Local:</strong> ${escapeHtml(event.location)}</p>` : ''}
          ${event.description ? `<p style="margin:0"><strong>Detalhes:</strong> ${escapeHtml(event.description)}</p>` : ''}
        </div>
        ${event.external_url ? `<p><a href="${escapeHtml(event.external_url)}" style="display:inline-block;padding:13px 20px;background:#101010;color:white;text-decoration:none;border-radius:999px;font-weight:bold">Abrir link da reunião</a></p>` : ''}
        <p style="margin-top:26px;color:#6f6a64;font-size:13px;line-height:1.6">O arquivo anexado permite adicionar ou atualizar a reunião no seu calendário.</p>
      </div>
    </div>
  </body></html>`
}

const securedHandler = withSupabase({ auth: 'user' }, async (request, ctx) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('MEETING_FROM_EMAIL') || 'Apollus <onboarding@resend.dev>'
  const replyEmail = Deno.env.get('MEETING_REPLY_EMAIL') || 'jallerson29@gmail.com'
  if (!resendApiKey) return json({ error: 'RESEND_API_KEY não configurada.' }, 500)

  const { data: isAdmin, error: adminError } = await ctx.supabase.rpc('is_admin')
  if (adminError || !isAdmin) return json({ error: 'Acesso administrativo necessário.' }, 403)

  let payload: { event_id?: string; action?: string }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400)
  }

  if (!payload.event_id) return json({ error: 'event_id é obrigatório.' }, 400)

  const { data: event, error: eventError } = await ctx.supabaseAdmin
    .from('agenda_events')
    .select('*')
    .eq('id', payload.event_id)
    .single()

  if (eventError || !event) return json({ error: 'Reunião não encontrada.' }, 404)
  if (!event.is_meeting) return json({ error: 'O item informado não está marcado como reunião.' }, 400)

  const { data: invites, error: invitesError } = await ctx.supabaseAdmin
    .from('meeting_invites')
    .select('*')
    .eq('agenda_event_id', event.id)
    .order('created_at', { ascending: true })

  if (invitesError) return json({ error: invitesError.message }, 500)
  if (!invites?.length) return json({ sent: 0, failed: 0, message: 'Nenhum convidado selecionado.' })

  let sent = 0
  let failed = 0
  const results: Array<{ email: string; status: string; error?: string }> = []
  const action = payload.action || 'created'
  const cancelled = event.status === 'cancelado' || action === 'cancelled'

  for (const invite of invites) {
    const calendar = createCalendarFile(event, invite, action, replyEmail)
    const subjectPrefix = cancelled ? 'Cancelamento' : action === 'updated' ? 'Atualização' : 'Convite'

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [invite.invitee_email],
          subject: `${subjectPrefix}: ${event.title} — Apollus`,
          html: emailHtml(event, invite, action),
          attachments: [{
            filename: 'reuniao-apollus.ics',
            content: textToBase64(calendar),
          }],
          tags: [
            { name: 'type', value: 'meeting_invite' },
            { name: 'event', value: String(event.id).replaceAll('-', '_') },
          ],
        }),
      })

      const responseData = await response.json()
      if (!response.ok) throw new Error(responseData?.message || 'Falha no provedor de e-mail.')

      sent += 1
      results.push({ email: invite.invitee_email, status: 'sent' })
      await ctx.supabaseAdmin.from('meeting_invites').update({
        delivery_status: 'sent',
        notified_at: new Date().toISOString(),
        provider_message_id: responseData.id || null,
        last_error: null,
      }).eq('id', invite.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed += 1
      results.push({ email: invite.invitee_email, status: 'failed', error: message })
      await ctx.supabaseAdmin.from('meeting_invites').update({
        delivery_status: 'failed',
        last_error: message.slice(0, 1000),
      }).eq('id', invite.id)
    }
  }

  return json({ sent, failed, results })
})

export default {
  fetch: async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    const response = await securedHandler(request)
    const headers = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
}
