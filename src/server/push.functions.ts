import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface SaveInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  notification_hour: number;
  user_agent?: string;
}

export const saveSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveInput) => {
    if (!input?.endpoint || !input?.p256dh || !input?.auth) throw new Error("invalid subscription");
    const h = Number(input.notification_hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error("invalid hour");
    return { ...input, notification_hour: h };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      notification_hour: data.notification_hour,
      enabled: true,
      user_agent: data.user_agent ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateHour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { notification_hour: number }) => {
    const h = Number(input?.notification_hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error("invalid hour");
    return { notification_hour: h };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions")
      .update({ notification_hour: data.notification_hour, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const removeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = supabase.from("push_subscriptions").delete().eq("user_id", userId);
    if (data.endpoint) q.eq("endpoint", data.endpoint);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("push_subscriptions")
      .select("endpoint, notification_hour, enabled")
      .eq("user_id", userId)
      .maybeSingle();
    return { subscription: data };
  });