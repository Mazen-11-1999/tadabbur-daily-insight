import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { timezoneSchema, subscriptionEndpointSchema } from "./security-rules";

export const saveSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    endpoint: subscriptionEndpointSchema,
    p256dh: z.string().min(1), auth: z.string().min(1),
    notification_hour: z.number().int().min(0).max(23),
    timezone: timezoneSchema, user_agent: z.string().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert({
      ...data, user_id: context.userId, enabled: true,
      user_agent: data.user_agent ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw new Error("تعذّر حفظ اشتراك الإشعارات");
    return { success: true };
  });

export const updateHour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    endpoint: subscriptionEndpointSchema, notification_hour: z.number().int().min(0).max(23), timezone: timezoneSchema,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions")
      .update({ notification_hour: data.notification_hour, timezone: data.timezone, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId).eq("endpoint", data.endpoint);
    if (error) throw new Error("تعذّر حفظ وقت الإشعار");
    return { success: true };
  });

export const removeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: subscriptionEndpointSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").delete().eq("user_id", context.userId).eq("endpoint", data.endpoint);
    if (error) throw new Error("تعذّر حذف اشتراك الإشعارات");
    return { success: true };
  });

export const getMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: subscriptionEndpointSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: subscription, error } = await context.supabase.from("push_subscriptions")
      .select("endpoint, notification_hour, timezone, enabled").eq("user_id", context.userId).eq("endpoint", data.endpoint).maybeSingle();
    if (error) throw new Error("تعذّر قراءة اشتراك الإشعارات");
    return { subscription };
  });