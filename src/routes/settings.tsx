import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { TAFSIR_OPTIONS, RECITER_OPTIONS } from "@/lib/quran-api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, LogOut, User as UserIcon, Flame, BookOpen, Volume2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "الإعدادات — تدبر" }, { name: "description", content: "إعدادات التطبيق وتفضيلاتك." }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const [tafsir, setTafsir] = useState("ar.muyassar");
  const [reciter, setReciter] = useState("ar.haithamaldukhain");
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("preferred_tafsir, preferred_reciter").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_tafsir) setTafsir(data.preferred_tafsir);
        if (data?.preferred_reciter) setReciter(data.preferred_reciter);
      });
    supabase.from("streaks").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setStreak({ current: data.current_streak, longest: data.longest_streak }); });
  }, [user]);

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