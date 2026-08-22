import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, Loader2, Mail } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * شاشة دخول إسلامية متحركة 3D
 * - نجمة ثُمانية (خاتم سليماني) تدور بمنظور ثلاثي الأبعاد
 * - اسم "تدبر" يطفو ويتأرجح في الفضاء
 * - حلقات مدارية ذهبية + أنماط عربية + نجوم متلألئة
 * كل التأثيرات CSS/SVG — بلا مكتبات إضافية، خفيفة على الأداء.
 */
export function AuthHero3D({
  title = "ادخل عالم التدبّر",
  subtitle = "سجّل الدخول لحفظ مفضّلتك، ملاحظاتك، وسلسلة تدبّرك اليومية.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSignIn = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (r.error) toast.error("تعذر تسجيل الدخول");
  };

  const emailSignIn = async () => {
    if (!email || !password) return toast.error("أدخل البريد وكلمة المرور");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("بيانات الدخول غير صحيحة");
    else toast.success("مرحباً بك، تمت مزامنة حسابك");
  };

  const emailSignUp = async () => {
    if (!email || password.length < 6) return toast.error("كلمة المرور ٦ أحرف على الأقل");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("registered") ? "هذا البريد مسجّل مسبقاً" : "تعذّر إنشاء الحساب");
    if (!data.session) {
      setSent(true);
      toast.success("أرسلنا رسالة تأكيد إلى بريدك");
    }
  };

  const resetPassword = async () => {
    if (!email) return toast.error("أدخل بريدك أولاً");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error("تعذّر إرسال رابط الاستعادة");
    else toast.success("تحقّق من بريدك لاستعادة كلمة المرور");
  };

  return (
    <section className="auth-hero relative overflow-hidden rounded-3xl border border-gold/30 shadow-deep">
      {/* طبقة الخلفية المتدرّجة */}
      <div className="absolute inset-0 bg-gradient-night" />
      {/* نجوم متلألئة */}
      <div className="absolute inset-0 stars-bg opacity-90" />
      {/* وهج ذهبي مركزي */}
      <div className="absolute inset-0 auth-hero__glow" />

      {/* المسرح ثلاثي الأبعاد */}
      <div className="auth-stage relative h-[420px] sm:h-[480px] flex items-center justify-center">
        {/* حلقات مدارية */}
        <div className="orbit orbit--1" />
        <div className="orbit orbit--2" />
        <div className="orbit orbit--3" />

        {/* النجمة الثُمانية الإسلامية الدوّارة */}
        <div className="islamic-star" aria-hidden="true">
          <svg viewBox="-100 -100 200 200" className="w-64 h-64 sm:w-80 sm:h-80">
            <defs>
              <radialGradient id="goldFill" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.92 0.10 88)" />
                <stop offset="60%" stopColor="oklch(0.78 0.13 85)" />
                <stop offset="100%" stopColor="oklch(0.55 0.12 80)" />
              </radialGradient>
              <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* مربعان متراكبان = نجمة ثُمانية */}
            <g filter="url(#goldGlow)" fill="none" stroke="url(#goldFill)" strokeWidth="2.2" strokeLinejoin="round">
              <rect x="-70" y="-70" width="140" height="140" />
              <rect x="-70" y="-70" width="140" height="140" transform="rotate(45)" />
              <circle r="78" strokeOpacity="0.35" />
              <circle r="55" strokeOpacity="0.5" />
              {/* بتلات داخلية */}
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={i}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-78"
                  transform={`rotate(${i * 45})`}
                  strokeOpacity="0.45"
                />
              ))}
              <circle r="10" fill="url(#goldFill)" />
            </g>
          </svg>
        </div>

        {/* اسم التطبيق "تدبر" بمنظور 3D */}
        <div className="brand-3d">
          <span className="brand-3d__shadow font-arabic">تدبر</span>
          <span className="brand-3d__main font-arabic text-gradient-gold">تدبر</span>
        </div>
      </div>

      {/* المحتوى */}
      <div className="relative px-6 sm:px-10 pb-10 pt-2 text-center">
        <h2 className="font-arabic text-2xl sm:text-3xl font-bold text-gradient-gold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">{subtitle}</p>
        <Button
          onClick={handleSignIn}
          size="lg"
          className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold px-8"
        >
          <LogIn className="w-4 h-4 ml-2" />
          الدخول بـ Google
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ﴿ أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ ﴾
        </p>
      </div>
    </section>
  );
}
