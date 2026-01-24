import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

type TicketRow = {
  id: string;
  ticket_ref: number | null;
  title: string | null;
  created_by: string | null;
  created_by_email: string | null;
  pending_validation_since: string | null;
  last_client_activity_at: string | null;
};

Deno.serve(async () => {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("auto_close_pending_validation_hours, system_user_id")
      .eq("id", 1)
      .single();

    if (settingsError) throw settingsError;
    if (!settings?.system_user_id) {
      throw new Error("app_settings.system_user_id no esta configurado");
    }

    const hours = settings.auto_close_pending_validation_hours ?? 72;
    const thresholdMs = hours * 60 * 60 * 1000;
    const now = Date.now();

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select(
        "id,ticket_ref,title,created_by,created_by_email,pending_validation_since,last_client_activity_at"
      )
      .eq("stage", "pending_validation")
      .not("pending_validation_since", "is", null);

    if (ticketsError) throw ticketsError;

    const candidates = (tickets as TicketRow[]).filter((ticket) => {
      const pendingSince = ticket.pending_validation_since
        ? new Date(ticket.pending_validation_since).getTime()
        : 0;
      const lastClient = ticket.last_client_activity_at
        ? new Date(ticket.last_client_activity_at).getTime()
        : 0;
      const effectiveLast = Math.max(pendingSince, lastClient);
      return now - effectiveLast >= thresholdMs;
    });

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ closed: 0, message: "Sin candidatos" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const missingEmailIds = [
      ...new Set(
        candidates
          .filter((ticket) => !ticket.created_by_email && ticket.created_by)
          .map((ticket) => ticket.created_by as string)
      )
    ];

    const emailByUserId = new Map<string, string>();
    if (missingEmailIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email")
        .in("id", missingEmailIds);

      (profiles || []).forEach((profile: { id: string; email: string | null }) => {
        if (profile.email) emailByUserId.set(profile.id, profile.email);
      });
    }

    const results: Array<{ ticket_id: string; emailed: boolean }> = [];

    for (const ticket of candidates) {
      const email =
        ticket.created_by_email ||
        (ticket.created_by ? emailByUserId.get(ticket.created_by) : null);

      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          stage: "done",
          updated_at: new Date().toISOString(),
          updated_by: settings.system_user_id
        })
        .eq("id", ticket.id);

      if (updateError) throw updateError;

      const autoCloseMessage =
        "Cierre automatico: no hubo respuesta del cliente en " +
        `${hours} horas. Asumimos que la solucion fue exitosa.`;

      const { error: commentError } = await supabase.from("comments").insert({
        ticket_id: ticket.id,
        user_id: settings.system_user_id,
        content: autoCloseMessage,
        is_internal: false
      });

      if (commentError) throw commentError;

      if (email) {
        const subject = `Ticket #${ticket.ticket_ref ?? ""} cerrado automaticamente`;
        const emailText =
          "Hola,\n\n" +
          `Dado que no hemos recibido respuesta en ${hours} horas, ` +
          "asumimos que la solucion fue exitosa y procedemos a cerrar el ticket.\n\n" +
          `Ticket: #${ticket.ticket_ref ?? "-"} - ${ticket.title ?? ""}\n\n` +
          "Saludos,\nSoporte";

        await resend.emails.send({
          from: "Mojito360 <no-reply@mojito360.com>",
          to: email,
          subject,
          text: emailText
        });
      }

      results.push({ ticket_id: ticket.id, emailed: !!email });
    }

    return new Response(JSON.stringify({ closed: results.length, results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
