import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getAyah, type CombinedAyah } from "@/lib/quran-api";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { AuthHero3D } from "@/components/AuthHero3D";
import { toast } from "sonner";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "المفضلة — تدبر" },
      { name: "description", content: "آياتك المحفوظة." },
      { property: "og:title", content: "المفضلة — تدبر" },
      { property: "og:description", content: "آياتك المحفوظة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ id: string; ayah: CombinedAyah }[] | null>(null);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    (async () => {
      const { data: rows } = await supabase.from("favorites")
        .select("id, surah_number, ayah_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!rows) { setItems([]); return; }
      const results = await Promise.all(rows.map(async (r) => ({
        id: r.id,
        ayah: await getAyah(r.surah_number, r.ayah_number).catch(() => null),
      })));
      setItems(results.filter((r): r is { id: string; ayah: CombinedAyah } => !!r.ayah));
    })();
  }, [user]);

  const remove = async (id: string) => {
    await supabase.from("favorites").delete().eq("id", id);
    setItems((it) => (it ?? []).filter((i) => i.id !== id));
    toast.success("أُزيلت من المفضلة");
  };

  if (authLoading) return <AppShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div></AppShell>;

  if (!user) {
    return (
      <AppShell>
        <AuthHero3D
          title="المفضّلة بانتظارك"
          subtitle="سجّل الدخول لحفظ آياتك المفضّلة والرجوع إليها متى شئت."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-3xl font-bold text-gradient-gold mb-2">المفضلة</h1>
        <p className="text-sm text-muted-foreground">آياتك المحفوظة للتدبر.</p>
      </header>

      {items === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          لم تحفظ آيات بعد. <Link to="/quran" className="text-gold hover:underline">تصفح المصحف</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="rounded-2xl border border-border/40 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <Link
                  to="/surah/$surahNumber"
                  params={{ surahNumber: String(it.ayah.surah.number) }}
                  className="text-sm text-gold hover:underline"
                >
                  سورة {it.ayah.surah.name} — آية {it.ayah.numberInSurah}
                </Link>
                <Button size="sm" variant="ghost" onClick={() => remove(it.id)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="ayah-text text-lg leading-[2.4] text-foreground">{it.ayah.arabic}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}