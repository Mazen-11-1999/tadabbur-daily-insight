import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { reserveAIRequest } from "./ai-usage.server";
import { cachedReflection, generateReflection, validateAyahRef } from "./reflections.server";

export const getOrGenerateReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => validateAyahRef(z.object({ surah_number: z.number().int(), ayah_number: z.number().int() }).parse(input)))
  .handler(async ({ data, context }) => {
    const cached = await cachedReflection(data.surah_number, data.ayah_number);
    if (cached) return { applications: cached, cached: true, error: null as string | null };
    const usageError = await reserveAIRequest(context.supabase);
    if (usageError) return { applications: [], cached: false, error: usageError };
    return generateReflection(data.surah_number, data.ayah_number);
  });
