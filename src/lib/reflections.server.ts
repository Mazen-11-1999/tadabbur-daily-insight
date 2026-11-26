import { getAyah, SURAH_AYAH_COUNTS } from "./quran-api";

export function validateAyahRef(input: { surah_number: number; ayah_number: number }) {
  const max = SURAH_AYAH_COUNTS[input.surah_number - 1];
  if (!Number.isInteger(input.surah_number) || input.surah_number < 1 || input.surah_number > 114 || !max || !Number.isInteger(input.ayah_number) || input.ayah_number < 1 || input.ayah_number > max) {
    throw new Error("رقم السورة أو الآية غير صحيح");
  }
  return input;
}

export async function cachedReflection(surah: number, ayah: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("daily_reflections").select("applications").eq("surah_number", surah).eq("ayah_number", ayah).maybeSingle();
  return Array.isArray(data?.applications) ? data.applications as string[] : null;
}

export async function generateReflection(surah: number, ayah: number) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { applications: [], cached: false, error: "AI غير متاح حالياً" };
  try {
    const verse = await getAyah(surah, ayah, "ar.muyassar");
    const prompt = `أنت معين على التدبر في القرآن الكريم. استخرج من هذه الآية ٤ تطبيقات عملية في حياة المسلم اليومية، عملية وقابلة للتنفيذ اليوم. كن مختصراً (جملة واحدة لكل تطبيق).\n\nالآية: ${verse.arabic}\nالتفسير: ${verse.tafsir}\n\nأجب فقط بـ JSON على هذه الصيغة بدون أي شرح:\n{"applications":["…","…","…","…"]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: "تجيب فقط بـ JSON صالح بالعربية الفصحى." }, { role: "user", content: prompt }] }),
    });
    if (!res.ok) return { applications: [], cached: false, error: "تعذّر توليد التطبيقات" };
    const content = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    let parsed: { applications?: unknown } = {};
    try { parsed = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) try { parsed = JSON.parse(m[0]); } catch { /* invalid response */ } }
    const applications = Array.isArray(parsed.applications) ? parsed.applications.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
    if (applications.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("daily_reflections").upsert({ surah_number: surah, ayah_number: ayah, applications }, { onConflict: "surah_number,ayah_number" });
    }
    return { applications, cached: false, error: null as string | null };
  } catch {
    return { applications: [], cached: false, error: "حدث خطأ في توليد التطبيقات" };
  }
}
