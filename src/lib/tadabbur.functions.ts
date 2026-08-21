import { createServerFn } from "@tanstack/react-start";

interface ChatInput {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: string;
}

const SYSTEM = `أنت "معين التدبر"، مساعد إسلامي رصين يساعد المسلم على تدبر القرآن الكريم.
- أجب بالعربية الفصحى المبسطة، بإيجاز وبأسلوب مطمئن.
- استند إلى التفاسير المعتبرة (الطبري، ابن كثير، السعدي، القرطبي، الميسّر) واذكر اسم المصدر عند النقل.
- لا تُفتِ في مسائل فقهية خلافية؛ وجّه السائل لأهل العلم.
- اربط المعنى بحياة السائل اليومية بخطوات عملية.
- لا تختلق آيات أو أرقام آيات؛ إن لم تتأكد فقل ذلك.`;

async function callGateway(messages: { role: string; content: string }[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { error: "AI غير متاح حالياً", status: 500 as const };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "openai/gpt-5.6-sol", messages }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("AI gateway error", res.status, txt);
    if (res.status === 429) return { error: "تجاوزت الحد المسموح، حاول بعد قليل.", status: 429 as const };
    if (res.status === 402) return { error: "نفدت أرصدة الذكاء الاصطناعي في مساحة العمل.", status: 402 as const };
    if (res.status === 403) return { error: "الذكاء الاصطناعي معطّل لهذه المساحة.", status: 403 as const };
    return { error: "تعذّر الاتصال بالمساعد حالياً.", status: 500 as const };
  }

  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { content: j?.choices?.[0]?.message?.content ?? "" };
}

export const askTadabbur = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const msgs = [
      { role: "system", content: SYSTEM + (data.context ? `\n\nسياق الآية الحالية:\n${data.context}` : "") },
      ...data.messages,
    ];
    const r = await callGateway(msgs);
    if ("error" in r) return { reply: "", error: r.error };
    return { reply: r.content, error: null as string | null };
  });

export const suggestByMood = createServerFn({ method: "POST" })
  .inputValidator((input: { mood: string }) => {
    if (!input?.mood) throw new Error("invalid input");
    return { mood: String(input.mood).slice(0, 200) };
  })
  .handler(async ({ data }) => {
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
