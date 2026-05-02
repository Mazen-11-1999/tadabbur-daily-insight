import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { TAFSIR_OPTIONS, RECITER_OPTIONS } from "@/lib/quran-api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, LogOut, User as UserIcon, Flame, BookOpen, Volume2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { saveSubscription, getMySubscription, removeSubscription, updateHour } from "@/server/push.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "الإعدادات — تدبر" }, { name: "description", content: "إعدادات التطبيق وتفضيلاتك." }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const [tafsir, setTafsir] = useState("ar.muyassar");
  const [reciter, setReciter] = useState("ar.alafasy");
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [hourLocal, setHourLocal] = useState(6); // ساعة محلية يختارها المستخدم
  const [pushBusy, setPushBusy] = useState(false);
  const [supportsPush, setSupportsPush] = useState(true); // افترض الدعم في SSR لتفادي hydration mismatch
  const saveSubFn = useServerFn(saveSubscription);
  const getSubFn = useServerFn(getMySubscription);
  const removeSubFn = useServerFn(removeSubscription);
  const updateHourFn = useServerFn(updateHour);

  useEffect(() => {
    setSupportsPush(pushSupported());
    if (!user) return;
    supabase.from("profiles").select("preferred_tafsir, preferred_reciter").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_tafsir) setTafsir(data.preferred_tafsir);
        if (data?.preferred_reciter) setReciter(data.preferred_reciter);
      });
    supabase.from("streaks").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setStreak({ current: data.current_streak, longest: data.longest_streak }); });
    // حالة الإشعارات
    getSubFn().then((res) => {
      if (res?.subscription) {
        setPushOn(true);
        // حوّل UTC → محلي
        const utcHour = res.subscription.notification_hour;
        const offsetH = -new Date().getTimezoneOffset() / 60;
        let local = (utcHour + offsetH) % 24;
        if (local < 0) local += 24;
        setHourLocal(Math.round(local));
      }
    }).catch(() => { /* noop */ });
  }, [user]);

  const togglePush = async (next: boolean) => {
    if (!user) { toast.error("سجّل الدخول أولاً"); return; }
    if (!supportsPush) { toast.error("متصفحك لا يدعم الإشعارات"); return; }
    setPushBusy(true);
    try {
      if (next) {
        const sub = await subscribeToPush();
        if (!sub) { toast.error("لم يتم منح إذن الإشعارات"); setPushBusy(false); return; }
        const offsetH = -new Date().getTimezoneOffset() / 60;
        let utcH = (hourLocal - offsetH) % 24;
        if (utcH < 0) utcH += 24;
        await saveSubFn({ data: { ...sub, notification_hour: Math.round(utcH), user_agent: navigator.userAgent } });
        setPushOn(true);
        toast.success("تم تفعيل الإشعارات اليومية ✓");
      } else {
        const ep = await unsubscribeFromPush();
        await removeSubFn({ data: { endpoint: ep ?? undefined } });
        setPushOn(false);
        toast.success("تم إيقاف الإشعارات");
      }
    } catch (e) {
      console.error(e);
      toast.error("تعذّر تحديث الإشعارات");
    } finally {
      setPushBusy(false);
    }
  };

  const changeHour = async (newHourLocal: number) => {
    setHourLocal(newHourLocal);
    if (!pushOn) return;
    const offsetH = -new Date().getTimezoneOffset() / 60;
    let utcH = (newHourLocal - offsetH) % 24;
    if (utcH < 0) utcH += 24;
    try {
      await updateHourFn({ data: { notification_hour: Math.round(utcH) } });
      toast.success("تم حفظ الوقت");
    } catch { toast.error("تعذّر حفظ الوقت"); }
  };

  const updatePref = async (field: "preferred_tafsir" | "preferred_reciter", value: string) => {
    if (!user) return;
    if (field === "preferred_tafsir") setTafsir(value); else setReciter(value);
    const update = field === "preferred_tafsir"
      ? { preferred_tafsir: value }
      : { preferred_reciter: value };
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) toast.error("تعذر الحفظ"); else toast.success("تم الحفظ");
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-3xl font-bold text-gradient-gold mb-2">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">خصّص تجربتك في تدبر.</p>
      </header>

      {/* Profile */}
      <section className="rounded-2xl border border-border/40 bg-card p-6 mb-4">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <div className="font-bold">{user.user_metadata?.full_name || user.email}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <Button variant="outline" onClick={signOut} className="border-border/60">
              <LogOut className="w-4 h-4 ml-2" /> خروج
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">سجّل الدخول لحفظ تفضيلاتك ومتابعة سلسلة التدبر.</p>
            <Button
              onClick={() => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })}
              className="bg-gradient-gold text-primary-foreground shadow-gold"
            >
              <LogIn className="w-4 h-4 ml-2" /> الدخول بـ Google
            </Button>
          </div>
        )}
      </section>

      {/* Streak card */}
      {user && streak && (
        <section className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent p-6 mb-4">
          <h2 className="flex items-center gap-2 font-bold mb-3"><Flame className="w-5 h-5 text-gold" /> سلسلة التدبر</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-background/40 p-4 text-center">
              <div className="text-3xl font-bold text-gradient-gold font-arabic">{toArabic(streak.current)}</div>
              <div className="text-xs text-muted-foreground mt-1">السلسلة الحالية</div>
            </div>
            <div className="rounded-xl bg-background/40 p-4 text-center">
              <div className="text-3xl font-bold text-gradient-gold font-arabic">{toArabic(streak.longest)}</div>
              <div className="text-xs text-muted-foreground mt-1">الأطول إطلاقاً</div>
            </div>
          </div>
        </section>
      )}

      {/* Tafsir */}
      <section className="rounded-2xl border border-border/40 bg-card p-6 mb-4">
        <label className="flex items-center gap-2 font-bold mb-3">
          <BookOpen className="w-5 h-5 text-gold" /> التفسير المفضل
        </label>
        <Select value={tafsir} onValueChange={(v) => updatePref("preferred_tafsir", v)} disabled={!user}>
          <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TAFSIR_OPTIONS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {!user && <p className="text-xs text-muted-foreground mt-2">سجّل الدخول لحفظ تفضيلك.</p>}
      </section>

      {/* Reciter */}
      <section className="rounded-2xl border border-border/40 bg-card p-6 mb-4">
        <label className="flex items-center gap-2 font-bold mb-3">
          <Volume2 className="w-5 h-5 text-gold" /> القارئ المفضل
        </label>
        <Select value={reciter} onValueChange={(v) => updatePref("preferred_reciter", v)} disabled={!user}>
          <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RECITER_OPTIONS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border/40 bg-card p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 font-bold">
            {pushOn ? <Bell className="w-5 h-5 text-gold" /> : <BellOff className="w-5 h-5 text-gold" />}
            إشعار آية اليوم
          </label>
          <Switch checked={pushOn} disabled={!user || !supportsPush || pushBusy} onCheckedChange={togglePush} />
        </div>
        {!supportsPush && (
          <p className="text-xs text-amber-400/80 mb-2">متصفحك لا يدعم الإشعارات. على iPhone: ثبّت التطبيق على الشاشة الرئيسية أولاً (يحتاج iOS 16.4+).</p>
        )}
        {!user && <p className="text-xs text-muted-foreground mb-2">سجّل الدخول لتفعيل الإشعارات.</p>}
        <div className="mt-2">
          <label className="block text-xs text-muted-foreground mb-2">وقت الإشعار اليومي</label>
          <Select value={String(hourLocal)} onValueChange={(v) => changeHour(Number(v))} disabled={!user}>
            <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {Array.from({ length: 24 }).map((_, h) => (
                <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">يُرسل إشعار يومي بنص الآية واسم السورة في الوقت الذي تختاره.</p>
        </div>
      </section>

      {/* Install hint */}
      <section className="rounded-2xl border border-border/40 bg-card p-6 text-sm text-muted-foreground">
        <h3 className="font-bold text-foreground mb-2">📱 ثبّت التطبيق على هاتفك</h3>
        <p className="mb-1">• <strong>iPhone:</strong> اضغط زر المشاركة ثم "أضف إلى الشاشة الرئيسية".</p>
        <p>• <strong>Android:</strong> اضغط قائمة المتصفح ثم "تثبيت التطبيق".</p>
      </section>
    </AppShell>
  );
}

function toArabic(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}

function formatHour(h: number): string {
  const period = h < 12 ? "ص" : "م";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${toArabic(h12)}:٠٠ ${period}`;
}