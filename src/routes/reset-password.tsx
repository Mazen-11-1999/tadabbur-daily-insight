import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | تدبر" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في تطبيق تدبر لاستعادة الوصول ومزامنة بياناتك." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة | تدبر" },
      { property: "og:description", content: "استعد الوصول إلى حسابك في تدبر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async () => {
    if (password.length < 6) return toast.error("كلمة المرور ٦ أحرف على الأقل");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error("تعذّر تحديث كلمة المرور، اطلب رابطاً جديداً");
    toast.success("تم تحديث كلمة المرور");
    void navigate({ to: "/memorize", replace: true });
  };

  return (
    <AppShell>
      <div className="max-w-sm mx-auto mt-8 rounded-3xl border border-gold/30 bg-card p-6 text-right">
        <KeyRound className="w-6 h-6 text-gold mb-3" />
        <h1 className="font-arabic text-xl font-bold text-gradient-gold mb-2">كلمة مرور جديدة</h1>
        <p className="text-xs text-muted-foreground mb-4">اكتب كلمة المرور الجديدة لحسابك.</p>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="كلمة المرور الجديدة"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={submit} disabled={busy} className="w-full mt-3">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
        </Button>
      </div>
    </AppShell>
  );
}
