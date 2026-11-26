import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reserveAIRequest } from "./ai-usage.server";
import { SYSTEM, callGateway } from "./tadabbur.server";

interface ChatInput {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: string;
}

export const askTadabbur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ChatInput) => {
    if (!input || !Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error("invalid input");
    }
    return {
      context: typeof input.context === "string" ? input.context.slice(0, 4000) : "",
      messages: input.messages.slice(-12).map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content).slice(0, 4000),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    const usageError = await reserveAIRequest(context.supabase);
    if (usageError) return { reply: "", error: usageError };
    const msgs = [
      { role: "system", content: SYSTEM + (data.context ? `\n\nسياق الآية الحالية:\n${data.context}` : "") },
      ...data.messages,
    ];
    const r = await callGateway(msgs);
    if ("error" in r) return { reply: "", error: r.error };
    return { reply: r.content, error: null as string | null };
  });

export const suggestByMood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mood: string }) => {
    if (!input?.mood) throw new Error("invalid input");
    return { mood: String(input.mood).slice(0, 200) };
  })
  .handler(async ({ data, context }) => {
    const usageError = await reserveAIRequest(context.supabase);
    if (usageError) return { items: [], error: usageError };
    const prompt = `المستخدم يشعر بـ: ${data.mood}.
اقترح ٣ آيات قرآنية مناسبة لحاله تبعث الطمأنينة أو التذكير المناسب.
أجب فقط بـ JSON بهذه الصيغة بدون أي شرح إضافي:
{"items":[{"surah":2,"ayah":286,"surah_name":"البقرة","arabic":"نص الآية","why":"سبب المناسبة في جملة واحدة","action":"خطوة عملية اليوم"}]}`;

    const r = await callGateway([
      { role: "system", content: SYSTEM + "\nتجيب فقط بـ JSON صالح." },
      { role: "user", content: prompt },
    ]);
    if ("error" in r) return { items: [], error: r.error };

    const cleaned = (r.content ?? "").replace(/```json|```/g, "").trim();
    let parsed: { items?: unknown[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
      }
    }
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 5) : [];
    return { items: items as { surah: number; ayah: number; surah_name: string; arabic: string; why: string; action: string }[], error: null as string | null };
  });
