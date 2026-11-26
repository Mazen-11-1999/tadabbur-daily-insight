import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DataState({ loading, error, empty = "لا توجد بيانات متاحة حالياً.", retry }: {
  loading?: boolean; error?: string | null; empty?: string; retry?: () => void;
}) {
  return <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground" role={error ? "alert" : "status"}>
    {loading ? <><Loader2 className="size-6 animate-spin text-gold" /><span>جارٍ التحميل…</span></> : <>
      <p>{error || empty}</p>
      {error && retry && <Button variant="outline" onClick={retry}><RotateCcw className="size-4" />إعادة المحاولة</Button>}
    </>}
  </div>;
}