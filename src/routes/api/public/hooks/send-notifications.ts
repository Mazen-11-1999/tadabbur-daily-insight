import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDailyAyahRef, getAyah } from "@/lib/quran-api";

// نُشغّل الـ cron كل ساعة. لكل مستخدم: إن كانت ساعته الحالية (UTC)
// تساوي notification_hour الخاصة به ولم يُرسل له اليوم → أرسل.

export const Route = createFileRoute("/api/public/hooks/send-notifications")({
  server: {
    handlers: {
      POST: async () => {
        const pub = process.env.VAPID_PUBLIC_KEY;
        const priv = process.env.VAPID_PRIVATE_KEY;
        const subject = process.env.VAPID_SUBJECT || "mailto:noreply@tadabbor.app";
        if (!pub || !priv) {
          return new Response(JSON.stringify({ error: "VAPID keys missing" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        webpush.setVapidDetails(subject, pub, priv);

        const now = new Date();
        const currentHourUTC = now.getUTCHours();
        const today = now.toISOString().slice(0, 10);

        // اجلب المشتركين الذين حان وقتهم ولم يُرسل لهم اليوم
        const { data: subs, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth, last_sent_date")
          .eq("enabled", true)
          .eq("notification_hour", currentHourUTC)
          .or(`last_sent_date.is.null,last_sent_date.neq.${today}`);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        if (!subs || subs.length === 0) {
          return new Response(JSON.stringify({ sent: 0, hour: currentHourUTC }), { headers: { "Content-Type": "application/json" } });
        }

        // اجلب آية اليوم مرة واحدة
        const ref = getDailyAyahRef(now);
        let payload: { title: string; body: string; url: string };
        try {
          const ayah = await getAyah(ref.surah, ref.ayah, "ar.muyassar");
          const trimmedBody = ayah.arabic.length > 180 ? ayah.arabic.slice(0, 177) + "…" : ayah.arabic;
          payload = {
            title: `تدبر — ${ayah.surah.name}`,
            body: trimmedBody,
            url: "/",
          };
        } catch {
          payload = { title: "تدبر — آية اليوم", body: "افتح التطبيق لقراءة آية اليوم وتدبّرها.", url: "/" };
        }
        const payloadStr = JSON.stringify(payload);

        let sent = 0;
        const toDelete: string[] = [];
        const sentIds: string[] = [];

        await Promise.all(subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payloadStr,
            );
            sent++;
            sentIds.push(s.id);
          } catch (err: any) {
            const code = err?.statusCode;
            if (code === 404 || code === 410) {
              toDelete.push(s.endpoint);
            } else {
              console.error("push send failed", code, err?.body);
            }
          }
        }));

        if (sentIds.length) {
          await supabaseAdmin.from("push_subscriptions").update({ last_sent_date: today }).in("id", sentIds);
        }
        if (toDelete.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", toDelete);
        }

        return new Response(JSON.stringify({ sent, removed: toDelete.length, hour: currentHourUTC }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});