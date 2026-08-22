import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthHero3D } from "@/components/AuthHero3D";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | تدبر — مزامنة الحفظ والمراجعات" },
      { name: "description", content: "سجّل الدخول في تطبيق تدبر لمزامنة حفظك ومراجعاتك ومفضلتك وملاحظاتك عبر جميع أجهزتك." },
      { property: "og:title", content: "تسجيل الدخول | تدبر" },
      { property: "og:description", content: "حساب واحد يزامن الحفظ والمراجعات والمفضلة عبر كل أجهزتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/memorize", replace: true });
  }, [user, loading, navigate]);

  return (
    <AppShell>
      <h1 className="font-arabic text-2xl font-bold text-gradient-gold mb-4 text-center">
        حسابي ومزامنة الأجهزة
      </h1>
      <AuthHero3D
        title="اربط حسابك"
        subtitle="سجّل الدخول ليُحفظ حفظك ومراجعاتك ومفضلتك في السحابة وتتابعها من أي جهاز."
      />
    </AppShell>
  );
}
