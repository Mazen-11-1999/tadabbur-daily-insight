import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ confirmed: z.literal(true) }).parse(input))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: cleanupError } = await supabaseAdmin.rpc("delete_account_data", { target_user: context.userId });
    if (cleanupError) return { success: false, error: "تعذّر حذف بيانات الحساب. يمكنك المحاولة مجدداً." };
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) return { success: false, error: "حُذفت بياناتك، لكن تعذّر إنهاء حذف الحساب. أعد المحاولة." };
    return { success: true, error: null };
  });