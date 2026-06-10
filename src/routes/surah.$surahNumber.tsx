import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getSurahWithTafsir, type AyahData, type SurahMeta, TAFSIR_OPTIONS, getReciter, ayahAudioUrl, surahAudioUrl, getChapterWordSync, type AyahWordSync } from "@/lib/quran-api";
import { Loader2, Play, Pause, Heart, ArrowRight, BookOpen, SkipForward, SkipBack, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/surah/$surahNumber")({
  head: ({ params }) => ({
    meta: [
      { title: `سورة ${params.surahNumber} — تدبر` },
      { name: "description", content: "اقرأ السورة كاملة مع التلاوة والتفسير." },
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
  const [favSet, setFavSet] = useState<Set<number>>(new Set());

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null); // index in data.ayahs
  const [progress, setProgress] = useState(0); // 0..1 within current ayah
  const [currentWord, setCurrentWord] = useState<number>(0); // 1-based word position in current ayah, 0 = none
  const [wordSync, setWordSync] = useState<AyahWordSync[] | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentIdxRef = useRef<number | null>(null);
  const wordSyncRef = useRef<AyahWordSync[] | null>(null);
  // For full-surah audio: cumulative weighted boundaries (seconds) per ayah
  const boundariesRef = useRef<number[] | null>(null);

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { wordSyncRef.current = wordSync; }, [wordSync]);

  useEffect(() => {
    if (data) {
      localStorage.setItem("quran_last_read", JSON.stringify({ surah: num, name: data.name }));
    }
  }, [data, num]);

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

  // Load word-level timing segments when reciter supports it
  useEffect(() => {
    setWordSync(null);
    const rec = getReciter(reciter);
    if (!rec.quranComId) return;
    let alive = true;
    getChapterWordSync(rec.quranComId, num)
      .then((s) => { if (alive) setWordSync(s); })
      .catch(() => { /* fall back silently */ });
    return () => { alive = false; };
  }, [reciter, num]);

  // stop audio on unmount / surah / reciter change
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    boundariesRef.current = null;
    setPlaying(false);
    setCurrentIdx(null);
    setProgress(0);
    setCurrentWord(0);
  };

  useEffect(() => {
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num, reciter]);

  // ---- Word-sync sequential playback (Quran.com segments) ----
  const playWordSyncFrom = (idx: number) => {
    if (!data || !wordSyncRef.current) return;
    const segs = wordSyncRef.current;
    if (idx < 0 || idx >= segs.length) { stopAudio(); return; }
    const item = segs[idx];
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const a = new Audio(item.audioUrl);
    audioRef.current = a;
    setCurrentIdx(idx);
    setProgress(0);
    setCurrentWord(0);

    a.addEventListener("timeupdate", () => {
      if (a.duration > 0) setProgress(a.currentTime / a.duration);
      const tMs = a.currentTime * 1000;
      const list = wordSyncRef.current?.[idx]?.segments ?? [];
      // find segment whose [start,end] contains tMs
      let w = 0;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        // s = [seg_idx, word_pos, start_ms, end_ms]
        if (tMs >= s[2] && tMs <= s[3]) { w = s[1]; break; }
        if (tMs > s[3]) w = s[1]; // passed it — keep last
      }
      setCurrentWord(w);
    });
    a.addEventListener("ended", () => {
      const next = (currentIdxRef.current ?? idx) + 1;
      if (next < segs.length) playWordSyncFrom(next);
      else { stopAudio(); toast.success("تمّت تلاوة السورة"); }
    });
    a.addEventListener("playing", () => setPlaying(true));
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("error", () => { toast.error("تعذر تشغيل التلاوة"); stopAudio(); });

    requestAnimationFrame(() => {
      const ay = data.ayahs[idx];
      document.getElementById(`ayah-${ay.numberInSurah}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    a.play().catch(() => { toast.error("تعذر تشغيل التلاوة"); stopAudio(); });
  };

  // ---- Per-ayah sequential playback (alquran / everyayah) ----
  const playPerAyahFrom = (idx: number) => {
    if (!data) return;
    if (idx < 0 || idx >= data.ayahs.length) { stopAudio(); return; }
    const rec = getReciter(reciter);
    const ayah = data.ayahs[idx];
    const url = ayahAudioUrl(rec, num, ayah.numberInSurah, ayah.number);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    const a = new Audio(url);
    audioRef.current = a;
    setCurrentIdx(idx);
    setProgress(0);

    a.addEventListener("timeupdate", () => {
      if (a.duration > 0) setProgress(a.currentTime / a.duration);
    });
    a.addEventListener("ended", () => {
      const next = (currentIdxRef.current ?? idx) + 1;
      if (data && next < data.ayahs.length) {
        playPerAyahFrom(next);
      } else {
        stopAudio();
        toast.success("تمّت تلاوة السورة");
      }
    });
    a.addEventListener("playing", () => setPlaying(true));
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("error", () => { toast.error("تعذر تشغيل التلاوة"); stopAudio(); });

    requestAnimationFrame(() => {
      const el = document.getElementById(`ayah-${ayah.numberInSurah}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    a.play().catch(() => { toast.error("تعذر تشغيل التلاوة"); stopAudio(); });
  };

  // ---- Full-surah single-file playback (mp3quran reciters) ----
  // Highlight approximation: ayah boundaries proportional to ayah text length.
  const playFullSurah = (seekAyahIdx = 0) => {
    if (!data) return;
    const rec = getReciter(reciter);
    const url = surahAudioUrl(rec, num);
    if (!url) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const a = new Audio(url);
    audioRef.current = a;
    setCurrentIdx(seekAyahIdx);
    setProgress(0);

    const computeBoundaries = () => {
      if (!data || !a.duration || !isFinite(a.duration)) return;
      const weights = data.ayahs.map((x) => Math.max(1, x.text.length));
      const total = weights.reduce((s, w) => s + w, 0);
      let acc = 0;
      boundariesRef.current = weights.map((w) => {
        acc += w;
        return (acc / total) * a.duration;
      });
      if (seekAyahIdx > 0) {
        const start = seekAyahIdx === 0 ? 0 : boundariesRef.current[seekAyahIdx - 1];
        a.currentTime = start;
      }
    };

    a.addEventListener("loadedmetadata", computeBoundaries);
    a.addEventListener("timeupdate", () => {
      const bs = boundariesRef.current;
      if (!bs || !a.duration) return;
      const t = a.currentTime;
      let idx = bs.findIndex((b) => t < b);
      if (idx === -1) idx = bs.length - 1;
      const start = idx === 0 ? 0 : bs[idx - 1];
      const end = bs[idx];
      const local = end > start ? (t - start) / (end - start) : 0;
      setProgress(Math.min(1, Math.max(0, local)));
      if (idx !== currentIdxRef.current) {
        setCurrentIdx(idx);
        requestAnimationFrame(() => {
          const ay = data!.ayahs[idx];
          document.getElementById(`ayah-${ay.numberInSurah}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    });
    a.addEventListener("ended", () => { stopAudio(); toast.success("تمّت تلاوة السورة"); });
    a.addEventListener("playing", () => setPlaying(true));
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("error", () => { toast.error("تعذر تشغيل التلاوة"); stopAudio(); });

    a.play().catch(() => { toast.error("تعذر تشغيل التلاوة"); stopAudio(); });
  };

  const isFullSurahReciter = () => getReciter(reciter).audio.type === "fullsurah";

  const playFromIndex = (idx: number) => {
    if (wordSyncRef.current) {
      playWordSyncFrom(idx);
    } else if (isFullSurahReciter()) {
      // If audio already loaded, just seek; otherwise start fresh from idx
      if (audioRef.current && boundariesRef.current) {
        const bs = boundariesRef.current;
        const start = idx === 0 ? 0 : bs[idx - 1];
        audioRef.current.currentTime = start;
        setCurrentIdx(idx);
        audioRef.current.play().catch(() => {});
      } else {
        playFullSurah(idx);
      }
    } else {
      playPerAyahFrom(idx);
    }
  };

  const togglePlay = () => {
    if (!data) return;
    if (currentIdx === null) {
      playFromIndex(0);
    } else if (audioRef.current) {
      if (playing) audioRef.current.pause();
      else audioRef.current.play().catch(() => {});
    }
  };

  const next = () => { if (currentIdx !== null) playFromIndex(currentIdx + 1); };
  const prev = () => { if (currentIdx !== null && currentIdx > 0) playFromIndex(currentIdx - 1); };

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

  if (!data) return <AppShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div></AppShell>;

  const totalAyahs = data.ayahs.length;
  const overallProgress = currentIdx === null
    ? 0
    : ((currentIdx + progress) / totalAyahs) * 100;

  return (
    <AppShell>
      <Link to="/quran" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowRight className="w-4 h-4" /> العودة للمصحف
      </Link>

      <header className="text-center mb-6 p-6 rounded-3xl border border-gold/20 bg-gradient-to-br from-surface to-surface-elevated relative overflow-hidden">
        <div className="stars-bg absolute inset-0" />
        <div className="relative">
          <div className="text-xs text-muted-foreground mb-2">سورة رقم {toArabic(num)}</div>
          <h1 className="font-arabic text-4xl font-bold text-gradient-gold mb-2">{data.name}</h1>
          <div className="text-sm text-muted-foreground mb-4">
            {data.revelationType === "Meccan" ? "مكية" : "مدنية"} • {toArabic(totalAyahs)} آية
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={prev} size="icon" variant="outline" disabled={currentIdx === null || currentIdx === 0} className="rounded-full border-gold/30">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              onClick={togglePlay}
              size="lg"
              className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold rounded-full px-8"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              <span className="mr-2">
                {currentIdx === null ? "استمع للسورة كاملة" : playing ? "إيقاف مؤقت" : "متابعة"}
              </span>
            </Button>
            <Button onClick={next} size="icon" variant="outline" disabled={currentIdx === null || currentIdx >= totalAyahs - 1} className="rounded-full border-gold/30">
              <SkipForward className="w-4 h-4" />
            </Button>
            {currentIdx !== null && (
              <Button onClick={stopAudio} size="icon" variant="outline" className="rounded-full border-gold/30">
                <Square className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Sticky progress bar — visible while reading */}
      {currentIdx !== null && (
        <div className="sticky top-16 z-30 mb-4 rounded-full bg-surface/90 backdrop-blur border border-gold/20 px-4 py-2 shadow-deep">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>الآية {toArabic(data.ayahs[currentIdx].numberInSurah)} من {toArabic(totalAyahs)}</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-gradient-gold transition-[width] duration-200"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Full surah text as one continuous block — current ayah highlighted */}
      <section className="rounded-3xl border border-gold/20 bg-gradient-to-br from-surface to-surface-elevated p-6 sm:p-10 mb-8 shadow-deep relative overflow-hidden">
        <div className="stars-bg absolute inset-0 pointer-events-none" />
        <div className="relative">
          {num !== 1 && num !== 9 && (
            <p className="ayah-text text-center text-2xl text-gold mb-6">بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
          )}
          <p className="ayah-text text-2xl sm:text-[26px] text-justify text-foreground leading-[2.6]" dir="rtl">
            {data.ayahs.map((a, idx) => {
              const isCurrent = idx === currentIdx;
              return (
                <span
                  key={a.number}
                  id={`ayah-${a.numberInSurah}`}
                  onClick={() => playFromIndex(idx)}
                  className={`cursor-pointer rounded-md transition-all px-1 ${
                    isCurrent
                      ? "bg-gold/20 text-gold-foreground shadow-[0_0_24px_rgba(201,168,76,0.25)]"
                      : "hover:bg-gold/5"
                  }`}
                >
                  {a.text}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(a.numberInSurah); }}
                    className="inline-flex items-center justify-center mx-1 align-middle hover:scale-110 transition-transform"
                    title={favSet.has(a.numberInSurah) ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                  >
                    <span className="relative inline-flex items-center justify-center text-gold text-xl">
                      ﴿{toArabic(a.numberInSurah)}﴾
                      {favSet.has(a.numberInSurah) && (
                        <Heart className="absolute -top-2 -left-2 w-3 h-3 fill-gold text-gold" />
                      )}
                    </span>
                  </button>
                  {" "}
                </span>
              );
            })}
          </p>
        </div>
      </section>

      {/* Tafsir for the whole surah */}
      <section className="rounded-3xl border border-border/40 bg-card p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5 text-gold" />
          <h2 className="text-lg font-bold text-foreground">
            تفسير السورة — {TAFSIR_OPTIONS.find((t) => t.id === tafsirEdition)?.label}
          </h2>
        </div>
        <div className="space-y-5">
          {data.ayahs.map((a, idx) => {
            const isCurrent = idx === currentIdx;
            return (
              <div
                key={a.number}
                className={`border-b border-border/30 pb-4 last:border-0 rounded-lg px-2 transition-colors ${
                  isCurrent ? "bg-gold/5" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-medium">
                    {toArabic(a.numberInSurah)}
                  </span>
                  <span className="text-xs text-muted-foreground">آية {toArabic(a.numberInSurah)}</span>
                </div>
                <p className="ayah-text text-base text-foreground/90 leading-loose mb-2 text-right" dir="rtl">{a.text}</p>
                <p className="text-sm text-muted-foreground leading-loose text-right" dir="rtl">
                  {a.tafsir || "لا يوجد تفسير لهذه الآية."}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function toArabic(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}
