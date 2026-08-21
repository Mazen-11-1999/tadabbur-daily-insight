import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthHero3D } from "@/components/AuthHero3D";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getSurahs, getSurahWithAyahs, type SurahMeta } from "@/lib/quran-api";
import { Brain, Plus, Loader2, Eye, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/memorize")({
  head: () => ({
    meta: [
      { title: "الحفظ بالتكرار المتباعد — تدبر" },
      { name: "description", content: "احفظ القرآن بنظام التكرار المتباعد: راجع الآيات في الوقت المثالي قبل أن تنساها." },
      { property: "og:title", content: "الحفظ بالتكرار المتباعد — تدبر" },
      { property: "og:description", content: "نظام مراجعة ذكي يحدد لك الآيات المستحقة للمراجعة كل يوم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MemorizePage,
});

interface Item {
  id: string;
  surah_number: number;
  ayah_number: number;
  surah_name: string;
  arabic: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const toArabic = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

/** SM-2 lite: quality 0 (نسيت) / 3 (صعب) / 5 (سهل) */
function schedule(item: Item, quality: number) {
  let { ease, interval_days: interval, repetitions } = item;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }
  const due = new Date();
  due.setDate(due.getDate() + interval);
  return { ease, interval_days: interval, repetitions, due_date: due.toISOString().slice(0, 10) };
}

function MemorizePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [surahNo, setSurahNo] = useState(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(7);
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => { void getSurahs().then(setSurahs).catch(() => {}); }, []);

  const load = async (uid: string) => {
    const { data, error } = await supabase
      .from("memorization_items")
      .select("*")
      .eq("user_id", uid)
      .order("due_date", { ascending: true });
    if (error) toast.error("تعذّر تحميل قائمة الحفظ");
    setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void load(user.id);
  }, [user?.id]);

  const due = useMemo(() => items.filter((i) => i.due_date <= today()), [items]);
  const meta = surahs.find((s) => s.number === surahNo);

  const addRange = async () => {
    if (!user) return;
    setAdding(true);
    try {
      const surah = await getSurahWithAyahs(surahNo);
      const start = Math.max(1, Math.min(from, to));
      const end = Math.min(surah.ayahs.length, Math.max(from, to));
      const rows = surah.ayahs
        .filter((a) => a.numberInSurah >= start && a.numberInSurah <= end)
        .map((a) => ({
          user_id: user.id,
          surah_number: surahNo,
          ayah_number: a.numberInSurah,
          surah_name: surah.name,
          arabic: a.text,
          due_date: today(),
        }));
      const { error } = await supabase
        .from("memorization_items")
        .upsert(rows, { onConflict: "user_id,surah_number,ayah_number", ignoreDuplicates: true });
      if (error) throw error;
      toast.success(`أُضيفت ${toArabic(rows.length)} آية لخطة الحفظ`);
      await load(user.id);
    } catch {
      toast.error("تعذّر إضافة الآيات");
    } finally {
      setAdding(false);
    }
  };

  const review = async (item: Item, quality: number) => {
    const next = schedule(item, quality);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...next } : i)));
    setRevealed(null);
    const { error } = await supabase
      .from("memorization_items")
      .update({ ...next, last_reviewed_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) toast.error("تعذّر حفظ المراجعة");
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("memorization_items").delete().eq("id", id);
  };

  if (!user) {
    return (
      <AppShell>
        <h1 className="font-arabic text-2xl font-bold text-gradient-gold mb-4">الحفظ بالتكرار المتباعد</h1>
        <AuthHero3D />
      </AppShell>
    );
  }

  const current = due[0];

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-2xl font-bold text-gradient-gold flex items-center gap-2">
          <Brain className="w-6 h-6 text-gold" /> الحفظ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          نظام تكرار متباعد يعيد عليك الآية قبل نسيانها بالضبط.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "محفوظات", value: items.length },
          { label: "مستحقة اليوم", value: due.length },
          { label: "مستقرة", value: items.filter((i) => i.interval_days >= 21).length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/40 bg-card p-4 text-center">
            <div className="text-2xl font-bold text-gold">{toArabic(s.value)}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Review */}
      <section className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-6 mb-6">
        <h2 className="font-bold mb-4">مراجعة اليوم</h2>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-gold mx-auto" />
        ) : !current ? (
          <div className="text-center py-6 text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-gold" />
            أنهيت مراجعات اليوم. بارك الله فيك.
          </div>
        ) : (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              سورة {current.surah_name} — آية {toArabic(current.ayah_number)}
            </div>
            {revealed === current.id ? (
              <p className="font-arabic text-2xl leading-loose text-foreground mb-5">{current.arabic}</p>
            ) : (
              <button
                onClick={() => setRevealed(current.id)}
                className="w-full py-8 rounded-xl border border-dashed border-gold/40 text-sm text-muted-foreground hover:text-gold flex items-center justify-center gap-2 mb-5"
              >
                <Eye className="w-4 h-4" /> استظهر الآية ثم اضغط للكشف
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => review(current, 0)}>نسيت</Button>
              <Button variant="outline" onClick={() => review(current, 3)}>بصعوبة</Button>
              <Button className="bg-gradient-gold text-primary-foreground shadow-gold" onClick={() => review(current, 5)}>
                سهل
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Add */}
      <section className="rounded-2xl border border-border/40 bg-card p-5 mb-6">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-gold" /> أضف آيات للحفظ</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-muted-foreground col-span-3 sm:col-span-1">
            السورة
            <select
              value={surahNo}
              onChange={(e) => { setSurahNo(+e.target.value); setFrom(1); setTo(Math.min(7, surahs.find((s) => s.number === +e.target.value)?.numberOfAyahs ?? 7)); }}
              className="mt-1 w-full h-10 rounded-lg bg-background border border-border/60 px-2 text-sm text-foreground"
            >
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            من آية
            <input type="number" min={1} max={meta?.numberOfAyahs ?? 286} value={from}
              onChange={(e) => setFrom(+e.target.value)}
              className="mt-1 w-full h-10 rounded-lg bg-background border border-border/60 px-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            إلى آية
            <input type="number" min={1} max={meta?.numberOfAyahs ?? 286} value={to}
              onChange={(e) => setTo(+e.target.value)}
              className="mt-1 w-full h-10 rounded-lg bg-background border border-border/60 px-2 text-sm text-foreground" />
          </label>
        </div>
        <Button onClick={addRange} disabled={adding} className="mt-4 w-full bg-gradient-gold text-primary-foreground shadow-gold">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة إلى خطة الحفظ"}
        </Button>
      </section>

      {/* List */}
      {items.length > 0 && (
        <section className="rounded-2xl border border-border/40 bg-card p-5">
          <h2 className="font-bold mb-3">قائمة الحفظ</h2>
          <ul className="divide-y divide-border/40">
            {items.map((i) => (
              <li key={i.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-foreground truncate">{i.surah_name} — آية {toArabic(i.ayah_number)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    المراجعة القادمة: {i.due_date} · كل {toArabic(i.interval_days || 1)} يوم
                  </div>
                </div>
                <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
