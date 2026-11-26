import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AI_LIMIT_MESSAGE } from "./security-rules";

export async function reserveAIRequest(client: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await client.rpc("consume_ai_usage");
  if (error) return "تعذّر التحقق من الاستخدام اليومي. حاول لاحقاً.";
  return data === true ? null : AI_LIMIT_MESSAGE;
}