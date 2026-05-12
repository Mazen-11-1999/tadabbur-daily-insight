import { useEffect, useRef, useState } from "react";
import { Play, Pause, Heart, Loader2, BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { CombinedAyah } from "@/lib/quran-api";

interface Props {
  ayah: CombinedAyah;
  showFavorite?: boolean;
  initialFavorite?: boolean;
}

export function AyahCard({ ayah, showFavorite = true, initialFavorite = false }: Props) {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFav, setIsFav] = useState(initialFavorite);
  const [showTafsir, setShowTafsir] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setIsFav(initialFavorite), [initialFavorite, ayah.globalNumber]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(ayah.audioUrl);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
      audioRef.current.addEventListener("playing", () => { setPlaying(true); setLoading(false); });
      audioRef.current.addEventListener("pause", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
    } else {
      setLoading(true);
      try { await audioRef.current.play(); }
      catch { toast.error("تعذر تشغيل التلاوة"); setLoading(false); }
    }
  };

  const toggleFav = async () => {
    if (!user) {
      toast.info("سجّل الدخول لحفظ المفضلة");
      return;
    }
    if (isFav) {
      const { error } = await supabase.from("favorites").delete()
        .eq("user_id", user.id)
        .eq("surah_number", ayah.surah.number)
        .eq("ayah_number", ayah.numberInSurah);
      if (!error) { setIsFav(false); toast.success("أُزيلت من المفضلة"); }
    } else {
      const { error } = await supabase.from("favorites").insert({
        user_id: user.id,
        surah_number: ayah.surah.number,
        ayah_number: ayah.numberInSurah,
      });
      if (!error) { setIsFav(true); toast.success("أُضيفت للمفضلة"); }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-surface to-surface-elevated p-6 sm:p-8 shadow-deep">
      <div className="stars-bg absolute inset-0 pointer-events-none" />
      <div className="relative">
        {/* Header chip */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-medium">
              سورة {ayah.surah.name}
            </div>
            <div className="px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs">
              آية {ayah.numberInSurah}
            </div>
          </div>
        </div>

        {/* Ayah text */}
        <p className="ayah-text text-2xl sm:text-[28px] text-center text-foreground leading-[2.4] mb-8">
          {ayah.arabic}
          <span className="inline-block mx-2 text-gold text-xl">﴿{toArabicNumeral(ayah.numberInSurah)}﴾</span>
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <Button
            onClick={togglePlay}
            size="lg"
            className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold rounded-full px-6"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
              playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            <span className="mr-2">{playing ? "إيقاف" : "استمع"}</span>
          </Button>
          {showFavorite && (
            <Button onClick={toggleFav} size="lg" variant="outline" className="rounded-full border-gold/30 hover:bg-gold/10">
              <Heart className={`w-5 h-5 ${isFav ? "fill-gold text-gold" : ""}`} />
            </Button>
          )}
          <Button onClick={() => setShowTafsir(!showTafsir)} size="lg" variant="outline" className="rounded-full border-gold/30 hover:bg-gold/10">
            <BookOpen className="w-5 h-5" />
            <span className="mr-2 hidden sm:inline">تفسير</span>
          </Button>
        </div>
        
        {showTafsir && (
          <div className="mt-6 pt-6 border-t border-gold/20 text-right animate-in fade-in slide-in-from-top-4">
            <div className="text-xs text-gold/80 mb-2 font-medium">التفسير</div>
            <p className="text-sm sm:text-base text-foreground/90 leading-loose">{ayah.tafsir || "لا يوجد تفسير متاح."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function toArabicNumeral(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}