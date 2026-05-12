import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getSurahWithTafsir, type AyahData, type SurahMeta, TAFSIR_OPTIONS } from "@/lib/quran-api";
import { Loader2, Play, Pause, Heart, ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/surah/$surahNumber")({
  head: ({ params }) => ({
    meta: [
      { title: `سورة ${params.surahNumber} — تدبر` },
      { name: "description", content: "اقرأ السورة كاملة مع التلاوة." },
    ],
  }),
  component: SurahPage,
});

function SurahPage() {
  const { surahNumber } = Route.useParams();
  const { user } = useAuth();
  const num = Number(surahNumber);
  const [data, setData] = useState<(SurahMeta & { ayahs: (AyahData & { tafsir: string })[] }) | null>(null);
  const [reciter, setReciter] = useState("ar.alafasy");
  const [tafsirEdition, setTafsirEdition] = useState("ar.muyassar");
  const [playingGlobal, setPlayingGlobal] = useState<number | null>(null);
  const [favSet, setFavSet] = useState<Set<number>>(new Set());
  const [openTafsir, setOpenTafsir] = useState<Set<number>>(new Set());

  // update last read
  useEffect(() => {
    if (data) {
      localStorage.setItem("quran_last_read", JSON.stringify({
        surah: num,
        name: data.name,
      }));
    }
  }, [data, num]);

  const { hash } = useLocation();
  useEffect(() => {
    if (data && hash) {
      const el = document.getElementById(`ayah-${hash.replace("#", "")}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [data, hash]);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("preferred_reciter, preferred_tafsir").eq("id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.preferred_reciter) setReciter(data.preferred_reciter);
          if (data?.preferred_tafsir) setTafsirEdition(data.preferred_tafsir);
        });
      supabase.from("favorites").select("ayah_number").eq("user_id", user.id).eq("surah_number", num)
        .then(({ data }) => setFavSet(new Set((data ?? []).map((r) => r.ayah_number))));
    }
  }, [user, num]);

  useEffect(() => {
    setData(null);
    getSurahWithTafsir(num, tafsirEdition).then(setData).catch(() => toast.error("تعذر تحميل السورة"));
  }, [num, tafsirEdition]);

  let audio: HTMLAudioElement | null = null;
  const playAyah = (ayahNum: number, ayahIdx: number) => {
    if (audio) { audio.pause(); audio = null; }
    if (playingGlobal === ayahNum) { setPlayingGlobal(null); return; }
    const url = `https://cdn.islamic.network/quran/audio/128/${reciter}/${ayahIdx}.mp3`;
    audio = new Audio(url);
    audio.addEventListener("ended", () => setPlayingGlobal(null));
    audio.play().catch(() => toast.error("تعذر تشغيل التلاوة"));
    setPlayingGlobal(ayahNum);
    localStorage.setItem("quran_last_read", JSON.stringify({
      surah: num,
      ayah: ayahNum,
      name: data?.name || "",
    }));
  };

  const toggleFav = async (ayahNum: number) => {
    if (!user) { toast.info("سجّل الدخول للحفظ"); return; }
    if (favSet.has(ayahNum)) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("surah_number", num).eq("ayah_number", ayahNum);
      setFavSet((s) => { const n = new Set(s); n.delete(ayahNum); return n; });
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, surah_number: num, ayah_number: ayahNum });
      setFavSet((s) => new Set(s).add(ayahNum));
    }
  };

  const toggleTafsir = (ayahNum: number) => {
    setOpenTafsir((s) => {
      const n = new Set(s);
      if (n.has(ayahNum)) n.delete(ayahNum); else n.add(ayahNum);
      return n;
    });
  };

  if (!data) return <AppShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div></AppShell>;

  return (
    <AppShell>
      <Link to="/quran" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowRight className="w-4 h-4" /> العودة للمصحف
      </Link>

      <header className="text-center mb-8 p-6 rounded-3xl border border-gold/20 bg-gradient-to-br from-surface to-surface-elevated relative overflow-hidden">
        <div className="stars-bg absolute inset-0" />
        <div className="relative">
          <div className="text-xs text-muted-foreground mb-2">سورة رقم {toArabic(num)}</div>
          <h1 className="font-arabic text-4xl font-bold text-gradient-gold mb-2">{data.name}</h1>
          <div className="text-sm text-muted-foreground">
            {data.revelationType === "Meccan" ? "مكية" : "مدنية"} • {toArabic(data.numberOfAyahs)} آية
          </div>
        </div>
      </header>

      {num !== 1 && num !== 9 && (
        <p className="ayah-text text-center text-2xl text-gold mb-6">بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
      )}

      <div className="space-y-4">
        {data.ayahs.map((a) => (
          <div key={a.number} id={`ayah-${a.numberInSurah}`} className="rounded-2xl border border-border/40 bg-card p-5 hover:border-gold/30 transition-colors">
            <p className="ayah-text text-xl text-foreground leading-[2.4] mb-3">
              {a.text}
              <span className="inline-block mx-2 text-gold text-base">﴿{toArabic(a.numberInSurah)}﴾</span>
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => playAyah(a.numberInSurah, a.number)} className="text-gold hover:bg-gold/10">
                {playingGlobal === a.numberInSurah ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleFav(a.numberInSurah)} className="hover:bg-gold/10">
                <Heart className={`w-4 h-4 ${favSet.has(a.numberInSurah) ? "fill-gold text-gold" : "text-muted-foreground"}`} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleTafsir(a.numberInSurah)} className="hover:bg-gold/10 mr-auto text-muted-foreground hover:text-gold">
                <BookOpen className="w-4 h-4 ml-1" />
                <span className="text-xs">تفسير</span>
                <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${openTafsir.has(a.numberInSurah) ? "rotate-180" : ""}`} />
              </Button>
            </div>
            {openTafsir.has(a.numberInSurah) && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <div className="text-[11px] text-gold/80 mb-1">
                  {TAFSIR_OPTIONS.find((t) => t.id === tafsirEdition)?.label}
                </div>
                <p className="text-sm text-foreground/85 leading-loose">{a.tafsir || "لا يوجد تفسير لهذه الآية."}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function toArabic(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}