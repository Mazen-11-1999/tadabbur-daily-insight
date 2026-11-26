import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar, CheckCircle, Plus, Edit2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/khatmah")({
  head: () => ({
    meta: [
      { title: "خطة الختمة" },
      { name: "description", content: "تابع خطة ختمتك للقرآن الكريم." },
      { property: "og:title", content: "خطة الختمة" },
      { property: "og:description", content: "تابع خطة ختمتك للقرآن الكريم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KhatmahPage,
});

function KhatmahPage() {
  const [khatmah, setKhatmah] = useState<{ startDate: string; duration: number; currentPage: number } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [durationInput, setDurationInput] = useState(30);

  useEffect(() => {
    const saved = localStorage.getItem("quran_khatmah");
    if (saved) {
      try { setKhatmah(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  const createKhatmah = () => {
    const newKhatmah = {
      startDate: new Date().toISOString(),
      duration: durationInput,
      currentPage: 0,
    };
    setKhatmah(newKhatmah);
    localStorage.setItem("quran_khatmah", JSON.stringify(newKhatmah));
    setIsCreating(false);
    toast.success("تم إنشاء خطة الختمة بنجاح");
  };

  const updateProgress = (newPage: number) => {
    if (!khatmah) return;
    const updated = { ...khatmah, currentPage: Math.min(604, Math.max(0, newPage)) };
    setKhatmah(updated);
    localStorage.setItem("quran_khatmah", JSON.stringify(updated));
  };

  const deleteKhatmah = () => {
    if (confirm("هل أنت متأكد من إلغاء خطة الختمة الحالية؟")) {
      setKhatmah(null);
      localStorage.removeItem("quran_khatmah");
    }
  };

  if (isCreating || !khatmah) {
    return (
      <AppShell>
        <header className="mb-8 text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gold" />
          </div>
          <h1 className="font-arabic text-3xl font-bold text-gradient-gold mb-2">خطة الختمة</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            ضع هدفك لختم القرآن الكريم وسنقوم بحساب الورد اليومي لك ومتابعة إنجازك.
          </p>
        </header>

        <div className="max-w-sm mx-auto bg-surface p-6 rounded-3xl border border-border/40 shadow-sm">
          <h2 className="text-lg font-bold mb-4">إنشاء ختمة جديدة</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">المدة (بالأيام)</label>
              <Input 
                type="number" 
                min={1} 
                max={1000}
                value={durationInput} 
                onChange={(e) => setDurationInput(Number(e.target.value))}
                className="text-center font-bold text-lg"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setDurationInput(30)} className={durationInput === 30 ? "border-gold text-gold" : ""}>شهر</Button>
              <Button type="button" variant="outline" onClick={() => setDurationInput(60)} className={durationInput === 60 ? "border-gold text-gold" : ""}>شهران</Button>
              <Button type="button" variant="outline" onClick={() => setDurationInput(7)} className={durationInput === 7 ? "border-gold text-gold" : ""}>أسبوع</Button>
            </div>

            <div className="bg-gold/5 border border-gold/20 p-4 rounded-xl text-center">
              <div className="text-xs text-muted-foreground mb-1">الورد اليومي المطلوب</div>
              <div className="font-bold text-gold text-xl">
                {Math.ceil(604 / (durationInput || 30))} صفحات
              </div>
            </div>

            <Button onClick={createKhatmah} className="w-full bg-gradient-gold text-primary-foreground font-bold h-12 rounded-xl">
              البدء الآن
            </Button>
            {khatmah && (
              <Button variant="ghost" onClick={() => setIsCreating(false)} className="w-full">
                إلغاء
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const daysPassed = Math.floor((new Date().getTime() - new Date(khatmah.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const expectedPage = Math.min(604, Math.ceil((daysPassed + 1) * (604 / khatmah.duration)));
  const dailyTarget = Math.ceil(604 / khatmah.duration);
  const progressPercent = (khatmah.currentPage / 604) * 100;
  const isAhead = khatmah.currentPage >= expectedPage;

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-arabic text-3xl font-bold text-gradient-gold mb-2">خطة الختمة</h1>
        <p className="text-muted-foreground text-sm">
          تابع تقدمك في قراءة القرآن الكريم.
        </p>
      </header>

      <div className="grid gap-4 mb-6">
        {/* Progress Card */}
        <div className="bg-gradient-to-br from-surface to-surface-elevated p-6 rounded-3xl border border-gold/20 shadow-deep relative overflow-hidden">
          <div className="stars-bg absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-sm text-gold mb-1">نسبة الإنجاز</div>
                <div className="text-4xl font-bold text-foreground">{progressPercent.toFixed(1)}%</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">الصفحات المقروءة</div>
                <div className="text-xl font-bold">{khatmah.currentPage} <span className="text-sm font-normal text-muted-foreground">/ 604</span></div>
              </div>
            </div>
            
            <Progress value={progressPercent} className="h-3 bg-gold/10" />
            
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-background/40 p-3 rounded-xl border border-border/40">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> اليوم الحالي</div>
                <div className="font-bold">{daysPassed + 1} <span className="text-xs font-normal text-muted-foreground">من {khatmah.duration}</span></div>
              </div>
              <div className="bg-background/40 p-3 rounded-xl border border-border/40">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> الهدف اليومي</div>
                <div className="font-bold">{dailyTarget} <span className="text-xs font-normal text-muted-foreground">صفحات</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Status */}
        <div className={`p-5 rounded-2xl border flex items-start gap-4 ${isAhead ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAhead ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {isAhead ? <CheckCircle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold mb-1">{isAhead ? 'أنت متقدم في خطتك!' : 'أنت متأخر قليلاً'}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isAhead 
                ? 'استمر على هذا النحو الجميل، لقد تجاوزت الهدف المطلوب لليوم.' 
                : `الهدف المطلوب الوصول إليه اليوم هو الصفحة ${expectedPage}. تحتاج لقراءة ${expectedPage - khatmah.currentPage} صفحة إضافية.`}
            </p>
          </div>
        </div>

        {/* Update Progress */}
        <div className="bg-surface p-6 rounded-3xl border border-border/40">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-gold" /> تحديث الإنجاز
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">الصفحة الحالية التي وصلت إليها</label>
              <Input 
                type="number" 
                min={0} 
                max={604} 
                value={khatmah.currentPage} 
                onChange={(e) => updateProgress(Number(e.target.value))} 
                className="font-bold"
              />
            </div>
            <div className="flex items-center gap-2 self-end">
              <Button variant="outline" onClick={() => updateProgress(khatmah.currentPage + 1)}>+1</Button>
              <Button variant="outline" onClick={() => updateProgress(khatmah.currentPage + 5)}>+5</Button>
            </div>
          </div>
        </div>
        
        {khatmah.currentPage === 604 && (
          <div className="bg-gold/20 border border-gold text-center p-6 rounded-3xl">
            <h3 className="text-xl font-bold text-gold mb-2">مبارك ختم القرآن!</h3>
            <p className="text-sm text-foreground mb-4">تقبل الله منك وجعله شفيعاً لك يوم القيامة.</p>
            <Button onClick={deleteKhatmah} className="bg-gold text-primary-foreground">بدء ختمة جديدة</Button>
          </div>
        )}

        {khatmah.currentPage < 604 && (
          <div className="text-center pt-4">
            <Button variant="ghost" onClick={deleteKhatmah} className="text-muted-foreground text-xs hover:text-destructive">
              إلغاء الخطة الحالية
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}