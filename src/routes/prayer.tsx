import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Sunrise, Sunset, MapPin, Loader2, Play, Pause, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prayer")({
  head: () => ({
    meta: [
      { title: "مواقيت الصلاة والأذان — تدبر" },
      { name: "description", content: "مواقيت الصلاة حسب موقعك مع العد التنازلي للصلاة القادمة وتشغيل الأذان." },
      { property: "og:title", content: "مواقيت الصلاة والأذان — تدبر" },
      { property: "og:description", content: "مواقيت دقيقة حسب موقعك مع تنبيه الأذان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrayerPage,
});

const ADHAN_URL = "https://cdn.aladhan.com/audio/adhans/a1.mp3";

const PRAYERS = [
  { key: "Fajr", label: "الفجر", icon: Sunrise },
  { key: "Dhuhr", label: "الظهر", icon: Sun },
  { key: "Asr", label: "العصر", icon: Sun },
  { key: "Maghrib", label: "المغرب", icon: Sunset },
  { key: "Isha", label: "العشاء", icon: Moon },
] as const;

const toArabic = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "ص" : "م";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${toArabic(String(hh))}:${toArabic(String(m).padStart(2, "0"))} ${period}`;
}

function PrayerPage() {
  const [timings, setTimings] = useState<Record<string, string> | null>(null);
  const [place, setPlace] = useState("");
  const [hijri, setHijri] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedRef = useRef<string>("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async (lat: number, lon: number, label: string) => {
    setLoading(true);
    try {
      const d = new Date();
      const date = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
      const res = await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lon}&method=4`);
      const j = await res.json();
      if (!j?.data?.timings) throw new Error("bad response");
      setTimings(j.data.timings as Record<string, string>);
      const h = j.data.date?.hijri;
      if (h) setHijri(`${toArabic(h.day)} ${h.month.ar} ${toArabic(h.year)}هـ`);
      setPlace(label);
      localStorage.setItem("prayer_loc", JSON.stringify({ lat, lon, label }));
    } catch {
      toast.error("تعذّر جلب مواقيت الصلاة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("prayer_loc");
    if (saved) {
      try {
        const { lat, lon, label } = JSON.parse(saved);
        void load(lat, lon, label);
        return;
      } catch { /* noop */ }
    }
    void load(21.4225, 39.8262, "مكة المكرمة (افتراضي)");
  }, []);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("تحديد الموقع غير مدعوم في متصفحك");
      return;
    }
    toast.info("جارٍ تحديد موقعك...");
    navigator.geolocation.getCurrentPosition(
      (pos) => void load(pos.coords.latitude, pos.coords.longitude, "موقعي الحالي"),
      () => toast.error("تعذّر الوصول إلى موقعك، فعّل إذن الموقع"),
      { timeout: 10000 },
    );
  };

  // Next prayer + countdown
  let nextKey = "";
  let nextLabel = "";
  let remaining = "";
  if (timings) {
    const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    for (const p of PRAYERS) {
      const t = timings[p.key];
      if (!t) continue;
      const [h, m] = t.split(":").map(Number);
      const pm = h * 60 + m;
      if (pm > mins) { nextKey = p.key; nextLabel = p.label; 
        const diff = (pm - mins) * 60;
        const hh = Math.floor(diff / 3600), mm = Math.floor((diff % 3600) / 60), ss = Math.floor(diff % 60);
        remaining = `${toArabic(String(hh).padStart(2, "0"))}:${toArabic(String(mm).padStart(2, "0"))}:${toArabic(String(ss).padStart(2, "0"))}`;
        break;
      }
    }
    if (!nextKey) { nextKey = "Fajr"; nextLabel = "الفجر (غداً)"; remaining = "—"; }
  }

  // Local notification when a prayer time hits while the app is open
  useEffect(() => {
    if (!timings || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    for (const p of PRAYERS) {
      if (timings[p.key] === hm && notifiedRef.current !== `${p.key}-${hm}`) {
        notifiedRef.current = `${p.key}-${hm}`;
        new Notification("حان الآن وقت " + p.label, { body: place, icon: "/icons/icon-192.png" });
        void playAdhan();
      }
    }
  }, [now, timings]);

  const playAdhan = async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(ADHAN_URL);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
      audioRef.current.addEventListener("error", () => { setPlaying(false); toast.error("تعذّر تشغيل الأذان"); });
    }
    try {
      if (playing) { audioRef.current.pause(); setPlaying(false); }
      else { await audioRef.current.play(); setPlaying(true); }
    } catch {
      toast.error("تعذّر تشغيل الأذان");
    }
  };

  const enableAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    if (p === "granted") toast.success("سيتم تنبيهك عند دخول وقت الصلاة أثناء فتح التطبيق");
    else toast.error("لم يتم منح إذن الإشعارات");
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-2xl font-bold text-gradient-gold">مواقيت الصلاة</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {place || "..."} {hijri && `· ${hijri}`}
        </p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-border/40 p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/10 to-transparent p-6 text-center mb-6">
            <div className="text-xs text-muted-foreground">الصلاة القادمة</div>
            <div className="font-arabic text-3xl font-bold text-gradient-gold mt-1">{nextLabel}</div>
            <div className="text-2xl font-mono text-gold mt-2 tracking-widest">{remaining}</div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card divide-y divide-border/40 mb-6">
            {PRAYERS.map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className={`flex items-center justify-between px-5 py-4 ${key === nextKey ? "bg-gold/5" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${key === nextKey ? "text-gold" : "text-muted-foreground"}`} />
                  <span className={key === nextKey ? "text-gold font-bold" : "text-foreground"}>{label}</span>
                </div>
                <span className="text-sm text-foreground/90">{timings?.[key] ? fmt12(timings[key]) : "—"}</span>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" onClick={useMyLocation}>
              <MapPin className="w-4 h-4 ml-2" /> استخدم موقعي
            </Button>
            <Button variant="outline" onClick={enableAlerts}>
              <Bell className="w-4 h-4 ml-2" /> تفعيل تنبيه الأذان
            </Button>
            <Button className="bg-gradient-gold text-primary-foreground shadow-gold" onClick={playAdhan}>
              {playing ? <Pause className="w-4 h-4 ml-2" /> : <Play className="w-4 h-4 ml-2" />}
              {playing ? "إيقاف الأذان" : "استمع للأذان"}
            </Button>
          </div>
        </>
      )}
    </AppShell>
  );
}
