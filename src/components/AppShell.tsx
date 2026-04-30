import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, Sparkles, Heart, Settings, BookMarked } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "آية اليوم", icon: Sparkles },
  { to: "/quran", label: "المصحف", icon: BookOpen },
  { to: "/favorites", label: "المفضلة", icon: Heart },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-screen pb-24 md:pb-8" dir="rtl">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
              <BookMarked className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-arabic text-xl font-bold text-gradient-gold leading-none">تدبر</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">منهج حياة</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "text-gold bg-gold/10" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-background/85 border-t border-border/50">
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  active ? "text-gold" : "text-muted-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_oklch(0.78_0.13_85_/_0.6)]" : ""}`} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}