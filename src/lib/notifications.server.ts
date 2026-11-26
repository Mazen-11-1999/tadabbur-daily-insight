import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDailyAyahRef, getAyah } from "./quran-api";
import { notificationIsDue } from "./security-rules";

export async function sendNotifications() {
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:noreply@tadabbor.app";
  if (!pub || !priv) return Response.json({ error: "تعذّر إرسال الإشعارات حالياً" }, { status: 500 });
  webpush.setVapidDetails(subject, pub, priv);
  const now = new Date();
  const { data: subs, error } = await supabaseAdmin.from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, notification_hour, timezone, last_sent_date").eq("enabled", true);
  if (error) return Response.json({ error: "تعذّر إرسال الإشعارات حالياً" }, { status: 500 });
  const due = (subs ?? []).flatMap((subscription) => {
    try {
      const local = notificationIsDue(now, subscription);
      return local.due ? [{ ...subscription, localDay: local.day }] : [];
    } catch { return []; }
  });
  if (!due.length) return Response.json({ sent: 0 });
  const ref = getDailyAyahRef(now);
  let payload = { title: "تدبر — آية اليوم", body: "افتح التطبيق لقراءة آية اليوم وتدبّرها.", url: "/" };
  try {
    const ayah = await getAyah(ref.surah, ref.ayah, "ar.muyassar");
    payload = { title: `تدبر — ${ayah.surah.name}`, body: ayah.arabic.length > 180 ? ayah.arabic.slice(0, 177) + "…" : ayah.arabic, url: "/" };
  } catch { /* use fallback reminder */ }
  let sent = 0;
  let removed = 0;
  await Promise.all(due.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
      const { error: updateError } = await supabaseAdmin.from("push_subscriptions").update({ last_sent_date: subscription.localDay }).eq("id", subscription.id);
      if (!updateError) sent++;
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : null;
      if (code === 404 || code === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
        removed++;
      }
    }
  }));
  return Response.json({ sent, removed });
}