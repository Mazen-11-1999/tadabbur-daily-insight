import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount } from "@/lib/account.functions";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/delete-account")({
  head: () => ({ meta: [
    { title: "حذف حسابي — تدبر" },
    { name: "description", content: "حذف حساب تدبر وبيانات الحفظ والمراجعات والمفضلة والملاحظات نهائياً." },
    { property: "og:title", content: "حذف حسابي — تدبر" },
    { property: "og:description", content: "إدارة حذف حساب تدبر وبياناته الشخصية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { user, loading, signOut } = useAuth();
  const deleteFn = useServerFn(deleteMyAccount);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!user || !confirming || busy) return;
    setBusy(true);
    try {
      const result = await deleteFn({ data: { confirmed: true } });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("تم حذف حسابك وبياناتك نهائياً");
      await signOut();
    } catch { toast.error("تعذّر حذف الحساب. حاول لاحقاً."); }
    finally { setBusy(false); }
  };
  return <AppShell>
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="font-arabic text-2xl font-bold text-foreground flex items-center gap-2"><Trash2 className="text-destructive w-6 h-6" /> حذف حسابي</h1>
      <p className="text-muted-foreground leading-loose">سيُحذف حسابك نهائياً، مع مفضّلتك وملاحظاتك وسلسلة التدبر وحفظك ومراجعاتك واشتراكات إشعاراتك وسجل الاستخدام. لا يمكن التراجع عن الحذف. المحتوى العام للقرآن والتطبيقات اليومية لا يتأثر.</p>
      {loading ? <Loader2 className="animate-spin w-5 h-5" /> : !user ? <div className="space-y-3">
        <p>سجّل الدخول بالحساب الذي ترغب في حذفه ثم عُد إلى هذه الصفحة.</p>
        <Button asChild><Link to="/auth">تسجيل الدخول</Link></Button>
      </div> : confirming ? <div className="space-y-3" role="alert">
        <p className="font-bold text-destructive">التأكيد الأخير: هل تريد حذف الحساب وجميع بياناته نهائياً؟</p>
        <div className="flex gap-3 flex-wrap">
          <Button variant="destructive" disabled={busy} onClick={submit}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} تأكيد الحذف النهائي</Button>
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>إلغاء</Button>
        </div>
      </div> : <Button variant="destructive" onClick={() => setConfirming(true)}><Trash2 className="w-4 h-4" /> أريد حذف حسابي</Button>}
    </div>
  </AppShell>;
}