import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const appBaseUrl =
  Deno.env.get("APP_BASE_URL") ??
  "https://help-desk-mojito360-llq6l8xi6-kameleonlabs-projects.vercel.app";
const entitiesUrl = `${appBaseUrl}/entities`;

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  message: string | null;
  ticket_id: string | null;
  entity_id: string | null;
  created_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
  tickets: { ticket_ref: number | null; title: string | null } | null;
  entities: { name: string | null } | null;
};

const getNotificationLink = (notification: NotificationRow) => {
  if (notification.ticket_id) {
    return `${appBaseUrl}/ticket/${notification.ticket_id}`;
  }
  if (notification.entity_id) {
    return entitiesUrl;
  }
  return appBaseUrl;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { notificationIds } = await req.json();
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return new Response(JSON.stringify({ error: "notificationIds requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") ?? "onboarding@resend.dev";

    if (!supabaseUrl || !serviceKey || !resendApiKey) {
      return new Response(JSON.stringify({ error: "Faltan variables de entorno" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select(`
        id,
        user_id,
        type,
        message,
        ticket_id,
        entity_id,
        created_at,
        profiles:profiles!notifications_user_id_fkey ( email, full_name ),
        tickets ( ticket_ref, title ),
        entities ( name )
      `)
      .in("id", notificationIds);

    if (error) throw error;

    const rows = (notifications || []) as NotificationRow[];

    const byUser = new Map<string, NotificationRow[]>();
    for (const row of rows) {
      const key = row.user_id;
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(row);
    }

    const sentIds: string[] = [];
    const skippedIds: string[] = [];

    for (const [, userNotifications] of byUser.entries()) {
      const email = userNotifications[0]?.profiles?.email;
      const fullName = userNotifications[0]?.profiles?.full_name;

      if (!email) {
        skippedIds.push(...userNotifications.map((n) => n.id));
        continue;
      }

      const subject =
        userNotifications.length === 1
          ? "Tienes una nueva notificación"
          : `Tienes ${userNotifications.length} notificaciones nuevas`;

      const lines = userNotifications.map((notification) => {
        const ticketInfo = notification.tickets
          ? `Ticket #${notification.tickets.ticket_ref ?? ""} ${notification.tickets.title ?? ""}`.trim()
          : null;
        const entityInfo = notification.entities?.name
          ? `Entidad: ${notification.entities.name}`
          : null;
        const msg = notification.message ?? "";
        const link = getNotificationLink(notification);
        return {
          text: [msg, ticketInfo, entityInfo].filter(Boolean).join(" | "),
          link,
        };
      });

      const text = [
        `Hola ${fullName ?? "usuario"},`,
        "",
        "Tienes nuevas notificaciones en HelpDesk:",
        ...lines.map((line) => `- ${line.text} (${line.link})`),
        "",
        "Ingresa al sistema para ver los detalles."
      ].join("\n");

      const html = `
        <div>
          <p>Hola ${fullName ?? "usuario"},</p>
          <p>Tienes nuevas notificaciones en HelpDesk:</p>
          <ul>
            ${lines
              .map(
                (line) => `
                  <li style="margin-bottom: 12px;">
                    <div style="margin-bottom: 6px;">${line.text}</div>
                    <a
                      href="${line.link}"
                      style="display: inline-block; padding: 8px 14px; background: #6353FF; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 12px;"
                    >
                      Visitar sitio
                    </a>
                  </li>
                `
              )
              .join("")}
          </ul>
          <p>Ingresa al sistema para ver los detalles.</p>
        </div>
      `;

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject,
          html,
          text,
        }),
      });

      if (!resendResp.ok) {
        const errText = await resendResp.text();
        console.error("Resend error:", errText);
        continue;
      }

      sentIds.push(...userNotifications.map((n) => n.id));
    }

    if (sentIds.length > 0) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_email_sent: true })
        .in("id", sentIds);

      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ ok: true, sentIds, skippedIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Error inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
