export function normalizeArabic(text: string): string {
  return text.normalize("NFKD").replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}

/** Strip only an actual opening basmala, never An-Naml 27:30 or Al-Fatiha 1:1. */
export function stripOpeningBasmala(text: string, surah: number, ayah: number): string {
  if (ayah !== 1 || surah === 1 || surah === 9) return text;
  const words = text.trim().split(/\s+/);
  if (normalizeArabic(words.slice(0, 4).join(" ")) !== "بسم الله الرحمن الرحيم") return text;
  // Keep a standalone basmala instead of producing an empty verse.
  return words.length > 4 ? words.slice(4).join(" ") : text;
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}