import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { getSurahs, type SurahMeta } from "@/lib/quran-api";
import { Search, Loader2, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/quran")({
  head: () => ({
    meta: [
      { title: "المصحف — تدبر" },
      { name: "description", content: "تصفّح سور القرآن الكريم كاملاً." },
    ],
  }),
  component: QuranIndex,
});

function QuranIndex() {
  const [surahs, setSurahs] = useState<SurahMeta[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    getSurahs().then(setSurahs).catch(() => setSurahs([]));
  }, []);

  const filtered = useMemo(() => {
    if (!surahs) return [];
    const t = q.trim();
    if (!t) return surahs;
    return surahs.filter((s) => s.name.includes(t) || s.englishName.toLowerCase().includes(t.toLowerCase()) || String(s.number) === t);
  }, [surahs, q]);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-3xl font-bold text-gradient-gold mb-2">المصحف</h1>
        <p className="text-sm text-muted-foreground">١١٤ سورة. اختر سورة لتصفّح آياتها.</p>
      </header>

      <div className="relative mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          dir="rtl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم السورة أو رقمها"
          className="pr-10 bg-card border-border/60"
        />
      </div>

      {!surahs ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((s) => (
            <Link
              key={s.number}
              to="/surah/$surahNumber"
              params={{ surahNumber: String(s.number) }}
              className="group flex items-center justify-between gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-gold/40 hover:bg-gold/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-gold/10 border border-gold/30 flex items-center justify-center text-gold font-bold text-sm">
                  {toArabic(s.number)}
                </div>
                <div>
                  <div className="font-arabic text-lg font-bold text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.revelationType === "Meccan" ? "مكية" : "مدنية"} • {toArabic(s.numberOfAyahs)} آية
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function toArabic(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}