import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askTadabbur, suggestByMood } from "@/lib/tadabbur.functions";
import { Sparkles, Send, Loader2, HeartHandshake } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tadabbur")({
  head: () => ({
    meta: [
      { title: "معين التدبر — مساعد قرآني ذكي" },
      { name: "description", content: "اسأل عن أي آية واحصل على شرح من التفاسير المعتبرة مع تطبيقات عملية، أو اختر حالتك النفسية لتُقترح لك آيات مناسبة." },
      { property: "og:title", content: "معين التدبر — مساعد قرآني ذكي" },
      { property: "og:description", content: "شرح الآيات من التفاسير المعتبرة واقتراح آيات حسب حالتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TadabburPage,
});

const MOODS = ["حزين", "قلق", "ممتنّ", "تائب", "خائف من المستقبل", "مُتعب", "أبحث عن دافع", "أشعر بالوحدة"];

interface Msg { role: "user" | "assistant"; content: string }
interface Suggestion { surah: number; ayah: number; surah_name: string; arabic: string; why: string; action: string }

function TadabburPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [moodLoading, setMoodLoading] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const r = await askTadabbur({ data: { messages: next } });
      if (r.error) toast.error(r.error);
      else setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch {
      toast.error("تعذّر الاتصال بالمساعد");
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const pickMood = async (mood: string) => {
    setMoodLoading(mood);
    setSuggestions([]);
    try {
      const r = await suggestByMood({ data: { mood } });
      if (r.error) toast.error(r.error);
      else setSuggestions(r.items ?? []);
    } catch {
      toast.error("تعذّر جلب الاقتراحات");
    } finally {
      setMoodLoading(null);
    }
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-2xl font-bold text-gradient-gold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-gold" />
          معين التدبر
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          اسأل عن أي آية أو معنى، أو اختر حالتك وسنقترح لك آيات تناسبها.
        </p>
      </header>

      {/* Mood */}
      <section className="mb-6 rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-5">
        <h2 className="flex items-center gap-2 font-bold mb-3">
          <HeartHandshake className="w-5 h-5 text-gold" />
          كيف تشعر الآن؟
        </h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => pickMood(m)}
              disabled={!!moodLoading}
              className="px-3 py-1.5 rounded-full text-sm border border-border/60 hover:border-gold/60 hover:text-gold transition-colors disabled:opacity-50"
            >
              {moodLoading === m ? <Loader2 className="w-4 h-4 animate-spin" /> : m}
            </button>
          ))}
        </div>

        {suggestions.length > 0 && (
          <ul className="mt-4 space-y-3">
            {suggestions.map((s, i) => (
              <li key={i} className="rounded-xl bg-background/50 border border-border/40 p-4">
                <p className="font-arabic text-lg leading-loose text-foreground">{s.arabic}</p>
                <Link
                  to="/surah/$surahNumber"
                  params={{ surahNumber: String(s.surah) }}
                  hash={String(s.ayah)}
                  className="text-xs text-gold hover:underline"
                >
                  {s.surah_name} — آية {s.ayah} ←
                </Link>
                {s.why && <p className="text-sm text-muted-foreground mt-2">{s.why}</p>}
                {s.action && <p className="text-sm text-foreground/90 mt-1">• {s.action}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Chat */}
      <section className="rounded-2xl border border-border/40 bg-card p-4">
        <div className="space-y-3 min-h-[120px]">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              مثال: «ما معنى قوله تعالى ﴿وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا﴾؟»
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gold/10 border border-gold/25 text-foreground"
                  : "bg-background/60 border border-border/40 text-foreground/90"
              }`}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-gold" /> يتأمّل...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب سؤالك عن آية أو معنى..."
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !input.trim()} className="bg-gradient-gold text-primary-foreground shadow-gold">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
