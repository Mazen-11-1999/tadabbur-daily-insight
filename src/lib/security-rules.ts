import { z } from "zod";

export const AI_DAILY_LIMIT = 30;
export const AI_LIMIT_MESSAGE = "وصلت إلى الحد اليومي: ٣٠ طلب ذكاء اصطناعي. يمكنك المحاولة مجدداً غداً (يتجدد الحد عند منتصف الليل بتوقيت UTC).";

export const timezoneSchema = z.string().min(1).max(100).refine((zone) => {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
  catch { return false; }
}, "المنطقة الزمنية غير صالحة");

export const subscriptionEndpointSchema = z.string().url().refine((value) => new URL(value).protocol === "https:", "عنوان الاشتراك غير صالح");

export function localNotificationTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezoneSchema.parse(timezone), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { hour: Number(value("hour")), day: `${value("year")}-${value("month")}-${value("day")}` };
}

export function notificationIsDue(date: Date, subscription: { timezone: string; notification_hour: number; last_sent_date: string | null }) {
  const local = localNotificationTime(date, subscription.timezone);
  return { ...local, due: local.hour === subscription.notification_hour && local.day !== subscription.last_sent_date };
}