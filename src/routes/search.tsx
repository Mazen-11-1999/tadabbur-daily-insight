import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchQuran, type SearchResult } from "@/lib/quran-api";
import { Search as SearchIcon, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "البحث في القرآن الكريم" },
      { name: "description", content: "ابحث في القرآن الكريم بالكلمة أو الآية." },
      { property: "og:title", content: "البحث في القرآن الكريم" },
      { property: "og:description", content: "ابحث في القرآن الكريم بالكلمة أو الآية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [buildingIndex, setBuildingIndex] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(false);
    
    // If it's the first time, it might take a moment to build the index
    const indexCheckTimeout = setTimeout(() => {
      setBuildingIndex(true);
    }, 500);

    try {
      const res = await searchQuran(query);
      setResults(res);
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(indexCheckTimeout);
      setBuildingIndex(false);
      setLoading(false);
      setSearched(true);
    }
  };

  // Highlight search term in results
  const highlightText = (text: string, term: string) => {
    if (!term.trim()) return text;
    // Simple regex highlighting for uthmani text is tricky due to tashkeel, 
    // so we'll just display the uthmani text as is for now, or highlight exactly if possible.
    // Since we search normalized, highlighting the exact arabic with tashkeel requires advanced algorithms.
    // For simplicity, we just return the text.
    return text;
  };

  return (
    <AppShell>
      <header className="mb-8">
        <h1 className="font-arabic text-3xl font-bold text-gradient-gold mb-2">البحث في القرآن</h1>
        <p className="text-muted-foreground text-sm">
          ابحث عن أي كلمة أو عبارة، بالتشكيل أو بدونه.
        </p>
      </header>

      <form onSubmit={handleSearch} className="relative mb-8">
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب كلمة للبحث..."
            className="pr-12 h-14 rounded-full border-gold/30 bg-surface focus-visible:ring-gold/50 text-lg shadow-inner"
          />
          <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
        </div>
        <Button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="absolute left-2 top-2 h-10 rounded-full bg-gradient-gold text-primary-foreground hover:opacity-90 px-6"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "بحث"}
        </Button>
      </form>

      {buildingIndex && (
        <div className="p-4 mb-6 rounded-2xl bg-secondary/50 border border-border/50 text-center text-sm text-muted-foreground animate-pulse">
          جاري تجهيز فهرس البحث لأول مرة... قد يستغرق ذلك بضع ثوانٍ.
        </div>
      )}

      {loading && !buildingIndex && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      )}

      {searched && !loading && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            {results.length > 0 ? `وجدنا ${results.length} نتيجة لـ "${query}"` : "لا توجد نتائج مطابقة"}
          </h2>
          
          <div className="grid gap-4">
            {results.slice(0, 50).map((r, i) => (
              <Link 
                key={i} 
                to="/surah/$surahNumber" 
                params={{ surahNumber: String(r.surahNumber) }}
                hash={String(r.ayahNumber)}
                className="block p-5 rounded-2xl border border-border/40 bg-card hover:border-gold/50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                  <span className="px-3 py-1 rounded-full bg-gold/10 text-gold font-medium">سورة {r.surahName}</span>
                  <span>آية {r.ayahNumber}</span>
                </div>
                <p className="font-arabic text-xl leading-[2.2] text-foreground group-hover:text-gold transition-colors text-right">
                  {r.uthmaniText}
                </p>
              </Link>
            ))}
          </div>
          
          {results.length > 50 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              تم إظهار أول 50 نتيجة. يرجى تضييق نطاق البحث لمزيد من الدقة.
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}