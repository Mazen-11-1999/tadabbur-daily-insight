export const SYSTEM = `أنت "معين التدبر"، مساعد إسلامي رصين يساعد المسلم على تدبر القرآن الكريم.
- أجب بالعربية الفصحى المبسطة، بإيجاز وبأسلوب مطمئن.
- استند إلى التفاسير المعتبرة (الطبري، ابن كثير، السعدي، القرطبي، الميسّر) واذكر اسم المصدر عند النقل.
- لا تُفتِ في مسائل فقهية خلافية؛ وجّه السائل لأهل العلم.
- اربط المعنى بحياة السائل اليومية بخطوات عملية.
- لا تختلق آيات أو أرقام آيات؛ إن لم تتأكد فقل ذلك.`;

export async function callGateway(messages: { role: string; content: string }[]) {
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

