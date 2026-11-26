import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AyahCard } from "@/components/AyahCard";
import { Button } from "@/components/ui/button";
import { getAyah, getDailyAyahRef, type CombinedAyah, TAFSIR_OPTIONS } from "@/lib/quran-api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getOrGenerateReflection } from "@/lib/reflections.functions";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Flame, Loader2, Lightbulb, LogIn, Bookmark } from "lucide-react";
import { AuthHero3D } from "@/components/AuthHero3D";
import { toast } from "sonner";
import heroImg from "@/assets/hero-night.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تدبر — آية اليوم" },
      { name: "description", content: "آية اليوم مع تفسيرها وتلاوتها وتطبيقاتها العملية في حياتك." },
      { property: "og:title", content: "تدبر — آية اليوم" },
      { property: "og:description", content: "حوّل قراءة القرآن إلى منهج حياة بآية كل يوم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const [ayah, setAyah] = useState<CombinedAyah | null>(null);
  const [applications, setApplications] = useState<string[]>([]);
  const [loadingAyah, setLoadingAyah] = useState(true);
  const [loadingApps, setLoadingApps] = useState(false);
  const [tafsirEdition, setTafsirEdition] = useState("ar.muyassar");
  const [reciterEdition, setReciterEdition] = useState("ar.alafasy");
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  const [isFav, setIsFav] = useState(false);

  const reflectionFn = useServerFn(getOrGenerateReflection);
  const [lastRead, setLastRead] = useState<{surah: number, ayah?: number, name: string} | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("quran_last_read");
    if (saved) {
      try { setLastRead(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const dailyRef = getDailyAyahRef();

  // Load preferences (only if logged in)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_tafsir, preferred_reciter").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_tafsir) setTafsirEdition(data.preferred_tafsir);
        if (data?.preferred_reciter) setReciterEdition(data.preferred_reciter);
      });
  }, [user]);

  // Fetch ayah
  useEffect(() => {
    let cancel = false;
    setLoadingAyah(true);
    getAyah(dailyRef.surah, dailyRef.ayah, tafsirEdition, reciterEdition)
      .then((a) => { if (!cancel) setAyah(a); })
      .catch(() => toast.error("تعذر جلب الآية"))
      .finally(() => { if (!cancel) setLoadingAyah(false); });
    return () => { cancel = true; };
  }, [dailyRef.surah, dailyRef.ayah, tafsirEdition, reciterEdition]);

  // Generate reflections + check fav + update streak
  useEffect(() => {
    if (!ayah) return;
    if (!user) { setApplications([]); setLoadingApps(false); return; }
    setLoadingApps(true);
    reflectionFn({ data: { surah_number: ayah.surah.number, ayah_number: ayah.numberInSurah } })
      .then((r) => { setApplications(r.applications || []); if (r.error) toast.error(r.error); })
      .catch(() => {/* silent */})
      .finally(() => setLoadingApps(false));

    if (user) {
      supabase.from("favorites").select("id")
        .eq("user_id", user.id)
        .eq("surah_number", ayah.surah.number)
        .eq("ayah_number", ayah.numberInSurah)
        .maybeSingle()
        .then(({ data }) => setIsFav(!!data));

      void updateStreak(user.id).then(setStreak);
    }
  }, [ayah?.globalNumber, user]);

  const handleSignIn = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("تعذر تسجيل الدخول");
  };

  const today = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <AppShell>
      {/* Hero greeting */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-border/40">
        <img src={heroImg} alt="ليل المدينة" className="absolute inset-0 w-full h-full object-cover opacity-40" width={1536} height={1024} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="relative p-6 sm:p-8">
          <div className="text-xs text-muted-foreground mb-1">{today}</div>
          <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-gradient-gold mb-2">آية اليوم</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            تأمّل، استمع، طبّق. حوّل القراءة إلى منهج حياة.
          </p>
          {user && streak && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30">
              <Flame className="w-4 h-4 text-gold" />
              <span className="text-sm text-gold font-medium">سلسلة التدبر: {streak.current} يوم</span>
            </div>
          )}
        </div>
      </section>

      {/* Last Read Tracking */}
      {lastRead && (
        <section className="mb-6 rounded-2xl border border-gold/20 bg-gradient-to-br from-surface to-surface-elevated p-5 flex items-center justify-between animate-float-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5 text-gold" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">متابعة التلاوة</div>
              <div className="font-bold text-foreground">سورة {lastRead.name} {lastRead.ayah ? `(آية ${toArabic(lastRead.ayah)})` : ""}</div>
            </div>
          </div>
          <Button asChild className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold rounded-full px-5 text-sm h-9">
            <Link to="/surah/$surahNumber" params={{ surahNumber: String(lastRead.surah) }} hash={lastRead.ayah ? String(lastRead.ayah) : undefined}>
              متابعة
            </Link>
          </Button>
        </section>
      )}

      {/* Ayah */}
      {loadingAyah || !ayah ? (
        <div className="rounded-3xl border border-border/40 p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="animate-float-up">
          <AyahCard ayah={ayah} initialFavorite={isFav} />
        </div>
      )}

      {/* Tafsir */}
      {ayah && (
        <section className="mt-6 rounded-2xl border border-border/40 bg-card p-6 animate-float-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 font-bold text-foreground">
              <BookOpen className="w-5 h-5 text-gold" />
              التفسير
            </h2>
            <span className="text-xs text-muted-foreground">
              {TAFSIR_OPTIONS.find((t) => t.id === tafsirEdition)?.label}
            </span>
          </div>
          <p className="text-foreground/90 leading-loose text-[15px]">{ayah.tafsir}</p>
        </section>
      )}

      {/* Applications */}
      {ayah && (
        <section className="mt-6 rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-6 animate-float-up">
          <h2 className="flex items-center gap-2 font-bold text-foreground mb-4">
            <Lightbulb className="w-5 h-5 text-gold animate-shimmer" />
            تطبيقات عملية في حياتك اليوم
          </h2>
          {loadingApps ? (
            <div className="space-y-2">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : !user ? (
            <p className="text-sm text-muted-foreground">سجّل الدخول لعرض تطبيقات آية اليوم.</p>
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم تتوفر تطبيقات حالياً.</p>
          ) : (
            <ol className="space-y-3">
              {applications.map((app, i) => (
                <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background/40 border border-border/40">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-gold flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {toArabic(i + 1)}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed pt-1">{app}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* CTA / Sign in */}
      {!user ? (
        <div className="mt-6">
          <AuthHero3D />
        </div>
      ) : (
        <section className="mt-6 text-center">
          <Link to="/quran" className="text-sm text-gold hover:underline">
            تصفح المصحف الكامل ←
          </Link>
        </section>
      )}
    </AppShell>
  );
}

function toArabic(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}

async function updateStreak(userId: string): Promise<{ current: number; longest: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle();

  if (!data) {
    await supabase.from("streaks").insert({
      user_id: userId, current_streak: 1, longest_streak: 1, last_activity_date: today,
    });
    return { current: 1, longest: 1 };
  }

  if (data.last_activity_date === today) {
    return { current: data.current_streak, longest: data.longest_streak };
  }

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const newCurrent = data.last_activity_date === yStr ? data.current_streak + 1 : 1;
  const newLongest = Math.max(newCurrent, data.longest_streak);

  await supabase.from("streaks").update({
    current_streak: newCurrent, longest_streak: newLongest, last_activity_date: today,
  }).eq("user_id", userId);

  return { current: newCurrent, longest: newLongest };
}
