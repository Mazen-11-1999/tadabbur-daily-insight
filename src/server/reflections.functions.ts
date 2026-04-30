import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface GenInput {
  surah_number: number;
  ayah_number: number;
  arabic: string;
  tafsir: string;
}

export const getOrGenerateReflection = createServerFn({ method: "POST" })
  .inputValidator((input: GenInput) => {
    if (!input || typeof input.surah_number !== "number" || typeof input.ayah_number !== "number") {
      throw new Error("invalid input");
    }
    if (!input.arabic || !input.tafsir) throw new Error("missing ayah text");
    return input;
  })
  .handler(async ({ data }) => {
    // 1. Try cache
    const { data: existing } = await supabaseAdmin
      .from("daily_reflections")
      .select("applications")
      .eq("surah_number", data.surah_number)
      .eq("ayah_number", data.ayah_number)
      .maybeSingle();

    if (existing?.applications) {
      return { applications: existing.applications as string[], cached: true };
    }

    // 2. Generate via Lovable AI
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { applications: [], cached: false, error: "AI غير متاح حالياً" };
    }

    const prompt = `أنت معين على التدبر في القرآن الكريم. استخرج من هذه الآية ٤ تطبيقات عملية في حياة المسلم اليومية، عملية وقابلة للتنفيذ اليوم. كن مختصراً (جملة واحدة لكل تطبيق).

الآية: ${data.arabic}
التفسير: ${data.tafsir}

أجب فقط بـ JSON على هذه الصيغة بدون أي شرح:
{"applications":["…","…","…","…"]}`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "تجيب فقط بـ JSON صالح بالعربية الفصحى." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        const txt = await aiRes.text();
        console.error("AI error", aiRes.status, txt);
        return { applications: [], cached: false, error: "تعذّر توليد التطبيقات" };
      }

      const j = await aiRes.json();
      const content: string = j?.choices?.[0]?.message?.content ?? "";
      const cleaned = content.replace(/```json|```/g, "").trim();
      let parsed: { applications?: string[] } = {};
      try { parsed = JSON.parse(cleaned); } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
      }
      const applications = Array.isArray(parsed.applications) ? parsed.applications.slice(0, 6) : [];

      if (applications.length > 0) {
        await supabaseAdmin
          .from("daily_reflections")
          .upsert({
            surah_number: data.surah_number,
            ayah_number: data.ayah_number,
            applications,
          }, { onConflict: "surah_number,ayah_number" });
      }

      return { applications, cached: false };
    } catch (e) {
      console.error("reflection gen failed", e);
      return { applications: [], cached: false, error: "حدث خطأ في توليد التطبيقات" };
    }
  });