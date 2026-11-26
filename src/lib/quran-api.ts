// Quran data via AlQuran.cloud API (free, no key required)
// Docs: https://alquran.cloud/api
import { z } from "zod";
import { fetchJson } from "./reliable-fetch";
import { cachedQuran } from "./quran-cache";
import { localDateKey, normalizeArabic, stripOpeningBasmala } from "./quran-display";
export { fetchJson } from "./reliable-fetch";
export { localDateKey, normalizeArabic, stripOpeningBasmala } from "./quran-display";

const BASE = "https://api.alquran.cloud/v1";

export interface SurahMeta {
  number: number;
  name: string;            // Arabic
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan";
}

export interface AyahData {
  number: number;            // global ayah number 1..6236
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  surah: { number: number; name: string; englishName: string; numberOfAyahs: number };
}

export interface CombinedAyah {
  arabic: string;
  tafsir: string;
  audioUrl: string;
  surah: { number: number; name: string; englishName: string; numberOfAyahs: number };
  numberInSurah: number;
  globalNumber: number;
}

export const TAFSIR_OPTIONS = [
  { id: "ar.muyassar", label: "التفسير الميسّر" },
  { id: "ar.ibnkatheer", label: "تفسير ابن كثير" },
  { id: "ar.saddi", label: "تفسير السعدي" },
  { id: "ar.jalalayn", label: "تفسير الجلالين" },
  { id: "ar.qurtubi", label: "تفسير القرطبي" },
  { id: "ar.baghawi", label: "تفسير البغوي" },
] as const;

// Reciters with audio source metadata.
// - "alquran": per-ayah audio via cdn.islamic.network (highlights each verse)
// - "everyayah": per-ayah audio via everyayah.com (highlights each verse)
// - "fullsurah": single full-surah MP3; highlight is approximated by verse length
export type ReciterAudio =
  | { type: "alquran"; edition: string }
  | { type: "everyayah"; folder: string }
  | { type: "fullsurah"; url: (surah: number) => string };

export interface ReciterOption {
  id: string;
  label: string;
  audio: ReciterAudio;
  /** Quran.com recitation id — when set, enables word-level highlighting. */
  quranComId?: number;
}

const pad3 = (n: number) => String(n).padStart(3, "0");

export const RECITER_OPTIONS: ReciterOption[] = [
  { id: "ar.husarymujawwad", label: "محمود الحصري — مجوّد (خاشع)", audio: { type: "alquran", edition: "ar.husarymujawwad" } },
  { id: "ar.mahermuaiqly", label: "ماهر المعيقلي (خاشع)", audio: { type: "alquran", edition: "ar.mahermuaiqly" } },
  { id: "ar.muhammadayyoub", label: "محمد أيوب (خاشع ومريح)", audio: { type: "alquran", edition: "ar.muhammadayyoub" } },
  { id: "ar.alafasy", label: "مشاري العفاسي ✨ كلمة بكلمة", audio: { type: "alquran", edition: "ar.alafasy" }, quranComId: 7 },
  { id: "ar.minshawi", label: "محمد المنشاوي ✨ كلمة بكلمة", audio: { type: "alquran", edition: "ar.minshawi" }, quranComId: 9 },
  { id: "ar.husary", label: "محمود الحصري — مرتّل ✨ كلمة بكلمة", audio: { type: "alquran", edition: "ar.husary" }, quranComId: 6 },
  { id: "ar.muhammadjibreel", label: "محمد جبريل", audio: { type: "alquran", edition: "ar.muhammadjibreel" } },
  { id: "ar.hudhaify", label: "علي الحذيفي", audio: { type: "alquran", edition: "ar.hudhaify" } },
  { id: "ar.ahmedajamy", label: "أحمد العجمي", audio: { type: "alquran", edition: "ar.ahmedajamy" } },
  { id: "ar.shaatree", label: "أبو بكر الشاطري ✨ كلمة بكلمة", audio: { type: "alquran", edition: "ar.shaatree" }, quranComId: 4 },
  { id: "ar.abdulbasit", label: "عبدالباسط عبدالصمد ✨ كلمة بكلمة", audio: { type: "alquran", edition: "ar.abdulbasitmurattal" }, quranComId: 2 },
  { id: "ar.sudais", label: "عبدالرحمن السديس ✨ كلمة بكلمة", audio: { type: "alquran", edition: "ar.abdurrahmaansudais" }, quranComId: 3 },
  // New calm reciters
  { id: "ea.fares_abbad", label: "فارس عباد (خاشع)", audio: { type: "everyayah", folder: "Fares_Abbad_64kbps" } },
  { id: "mq.islam_sobhi", label: "إسلام صبحي (هادئ ومريح)", audio: { type: "fullsurah", url: (n) => `https://server14.mp3quran.net/islam/Rewayat-Hafs-A-n-Assem/${pad3(n)}.mp3` } },
  { id: "mq.dukhain", label: "هيثم الدخين (سكينة)", audio: { type: "fullsurah", url: (n) => `https://server16.mp3quran.net/h_dukhain/Rewayat-Hafs-A-n-Assem/${pad3(n)}.mp3` } },
  { id: "mq.raad_kurdi", label: "رعد محمد الكردي (دافئ)", audio: { type: "fullsurah", url: (n) => `https://server6.mp3quran.net/kurdi/${pad3(n)}.mp3` } },
];

export function getReciter(id: string): ReciterOption {
  return RECITER_OPTIONS.find((r) => r.id === id) ?? RECITER_OPTIONS[3];
}

export function ayahAudioUrl(reciter: ReciterOption, surah: number, ayah: number, globalNumber: number): string {
  const a = reciter.audio;
  if (a.type === "alquran") return `https://cdn.islamic.network/quran/audio/128/${a.edition}/${globalNumber}.mp3`;
  if (a.type === "everyayah") return `https://everyayah.com/data/${a.folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
  // fullsurah: caller should use surahAudioUrl instead; fallback to alafasy per-ayah
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalNumber}.mp3`;
}

export function surahAudioUrl(reciter: ReciterOption, surah: number): string | null {
  if (reciter.audio.type === "fullsurah") return reciter.audio.url(surah);
  return null;
}

/**
 * Quran.com per-ayah audio + word-level timing segments.
 * segment format: [segment_idx, word_position (1-based), start_ms, end_ms]
 */
export interface AyahWordSync {
  verseKey: string;
  numberInSurah: number;
  audioUrl: string;
  segments: number[][];
}

const metaSchema = z.object({
  number: z.number().int().min(1).max(114), name: z.string().min(1), englishName: z.string().min(1),
  englishNameTranslation: z.string(), numberOfAyahs: z.number().int().positive(), revelationType: z.enum(["Meccan", "Medinan"]),
});
const verseSchema = z.object({ number: z.number().int().positive(), text: z.string().min(1), numberInSurah: z.number().int().positive(), juz: z.number().int().min(1).max(30), page: z.number().int().min(1).max(604) });
export type SurahData = SurahMeta & { ayahs: AyahData[] };
export type TafsirSurah = SurahMeta & { ayahs: (AyahData & { tafsir: string })[] };

export function validateSurah(value: unknown, number: number): SurahData {
  const parsed = metaSchema.extend({ ayahs: z.array(verseSchema) }).parse(value);
  const expected = SURAH_AYAH_COUNTS[number - 1];
  if (!expected || parsed.number !== number || parsed.numberOfAyahs !== expected || parsed.ayahs.length !== expected ||
    parsed.ayahs.some((ayah, index) => ayah.numberInSurah !== index + 1 || ayah.number !== refToGlobalNumber(number, index + 1))) {
    throw new Error("عدد آيات السورة أو ترتيبها غير صحيح. أعد المحاولة.");
  }
  return { ...parsed, ayahs: parsed.ayahs.map((ayah) => ({ ...ayah, surah: parsed })) };
}
function parseSurahs(value: unknown): SurahMeta[] {
  const result = z.array(metaSchema).length(114).parse(value);
  if (result.some((s, index) => s.number !== index + 1 || s.numberOfAyahs !== SURAH_AYAH_COUNTS[index])) throw new Error("قائمة السور غير مكتملة");
  return result;
}
function validateRef(surah: number, ayah = 1) {
  const count = SURAH_AYAH_COUNTS[surah - 1];
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !count || ayah < 1 || ayah > count) throw new Error("رقم السورة أو الآية غير صالح.");
}

export async function getChapterWordSync(quranComId: number, chapter: number): Promise<AyahWordSync[]> {
  const parse = (value: unknown) => z.array(z.object({ verseKey: z.string(), numberInSurah: z.number(), audioUrl: z.string().url(), segments: z.array(z.array(z.number())) })).parse(value);
  return cachedQuran(`sync:${quranComId}:${chapter}`, async () => {
    const json = await fetchJson(`https://api.quran.com/api/v4/recitations/${quranComId}/by_chapter/${chapter}?per_page=300&fields=segments`,
      (value) => z.object({ audio_files: z.array(z.object({ verse_key: z.string(), url: z.string().min(1), segments: z.array(z.array(z.number())).default([]) })) }).parse(value), false);
    const items = json.audio_files.map((file) => ({ verseKey: file.verse_key, numberInSurah: Number(file.verse_key.split(":")[1]), audioUrl: file.url.startsWith("https:") ? file.url : `https://verses.quran.com/${file.url}`, segments: file.segments }));
    if (items.length !== SURAH_AYAH_COUNTS[chapter - 1]) throw new Error("توقيت التلاوة غير مكتمل");
    return items;
  }, parse);
}

export async function getSurahs(): Promise<SurahMeta[]> {
  return cachedQuran("surahs", async () => {
    try { return await fetchJson(`${BASE}/surah`, parseSurahs); }
    catch {
      const json = await fetchJson("https://api.quran.com/api/v4/chapters?language=ar", (value) => z.object({ chapters: z.array(z.object({ id: z.number(), name_arabic: z.string(), name_simple: z.string(), translated_name: z.object({ name: z.string() }), verses_count: z.number(), revelation_place: z.enum(["makkah", "madinah"]) })) }).parse(value), false);
      return parseSurahs(json.chapters.map((c) => ({ number: c.id, name: c.name_arabic, englishName: c.name_simple, englishNameTranslation: c.translated_name.name, numberOfAyahs: c.verses_count, revelationType: c.revelation_place === "makkah" ? "Meccan" : "Medinan" })));
    }
  }, parseSurahs);
}
async function secondarySurah(number: number): Promise<SurahData> {
  const [surahs, json] = await Promise.all([getSurahs(), fetchJson(`https://api.quran.com/api/v4/verses/by_chapter/${number}?language=ar&words=false&fields=text_uthmani&per_page=300`,
    (value) => z.object({ verses: z.array(z.object({ verse_number: z.number(), text_uthmani: z.string().min(1), page_number: z.number(), juz_number: z.number() })) }).parse(value), false)]);
  const meta = surahs.find((s) => s.number === number);
  if (!meta) throw new Error("السورة غير موجودة");
  return validateSurah({ ...meta, ayahs: json.verses.map((a) => ({ number: refToGlobalNumber(number, a.verse_number), numberInSurah: a.verse_number, text: a.text_uthmani, page: a.page_number, juz: a.juz_number })) }, number);
}
export async function getSurahWithAyahs(surahNumber: number, edition = "quran-uthmani"): Promise<SurahData> {
  validateRef(surahNumber);
  return cachedQuran(`surah:${surahNumber}:${edition}`, async () => {
    let result: SurahData;
    try { result = await fetchJson(`${BASE}/surah/${surahNumber}/${edition}`, (value) => validateSurah(value, surahNumber)); }
    catch (error) {
      if (!edition.startsWith("quran-")) throw error;
      result = await secondarySurah(surahNumber);
    }
    return { ...result, ayahs: result.ayahs.map((a) => ({ ...a, text: edition.startsWith("quran-") ? stripOpeningBasmala(a.text, surahNumber, a.numberInSurah) : a.text })) };
  }, (value) => validateSurah(value, surahNumber));
}
export async function getSurahWithTafsir(surahNumber: number, tafsirEdition = "ar.muyassar"): Promise<TafsirSurah> {
  const parse = (value: unknown): TafsirSurah => {
    const arabic = validateSurah(value, surahNumber);
    const tafsirs = z.object({ ayahs: z.array(z.object({ tafsir: z.string().min(1) })) }).parse(value);
    return { ...arabic, ayahs: arabic.ayahs.map((a, index) => ({ ...a, tafsir: tafsirs.ayahs[index].tafsir })) };
  };
  return cachedQuran(`tafsir:${surahNumber}:${tafsirEdition}`, async () => {
    const [arabic, tafsir] = await Promise.all([getSurahWithAyahs(surahNumber), getSurahWithAyahs(surahNumber, tafsirEdition)]);
    return { ...arabic, ayahs: arabic.ayahs.map((a, index) => ({ ...a, tafsir: tafsir.ayahs[index].text })) };
  }, parse);
}
const arabicAyahSchema = verseSchema.extend({ surah: metaSchema });
export async function getArabicAyah(surah: number, ayah: number): Promise<AyahData> {
  validateRef(surah, ayah);
  const parse = (value: unknown) => {
    const data = arabicAyahSchema.parse(value);
    if (data.surah.number !== surah || data.numberInSurah !== ayah || data.number !== refToGlobalNumber(surah, ayah)) throw new Error("الآية المستلمة غير مطابقة");
    return { ...data, text: stripOpeningBasmala(data.text, surah, ayah) };
  };
  return cachedQuran(`ayah-text:${surah}:${ayah}`, async () => {
    try { return await fetchJson(`${BASE}/ayah/${surah}:${ayah}/quran-uthmani`, parse); }
    catch { const chapter = await getSurahWithAyahs(surah); return parse(chapter.ayahs[ayah - 1]); }
  }, parse);
}
export async function getAyah(surah: number, ayah: number, tafsirEdition = "ar.muyassar", reciterEdition = "ar.alafasy"): Promise<CombinedAyah> {
  validateRef(surah, ayah);
  const parse = (value: unknown) => z.object({ arabic: z.string().min(1), tafsir: z.string().min(1), audioUrl: z.string().url(), surah: metaSchema, numberInSurah: z.number(), globalNumber: z.number() }).parse(value);
  return cachedQuran(`ayah:${surah}:${ayah}:${tafsirEdition}:${reciterEdition}`, async () => {
    const [arabic, tafsir] = await Promise.all([getArabicAyah(surah, ayah), fetchJson(`${BASE}/ayah/${surah}:${ayah}/${tafsirEdition}`, (value) => arabicAyahSchema.parse(value))]);
    return { arabic: arabic.text, tafsir: tafsir.text, audioUrl: ayahAudioUrl(getReciter(reciterEdition), surah, ayah, arabic.number), surah: arabic.surah, numberInSurah: ayah, globalNumber: arabic.number };
  }, parse);
}

/** The exact same date seed is shared by device UI and subscriber-local notifications. */
export function getDailyAyahRef(date: Date | string = new Date()): { surah: number; ayah: number; globalNumber: number } {
  const day = typeof date === "string" ? date : localDateKey(date);
  const [year, month, dateOfMonth] = day.split("-").map(Number);
  const seed = `${year}-${month - 1}-${dateOfMonth}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return globalNumberToRef((h % 6236) + 1);
}

// Cumulative ayah counts per surah (1..114). Built once.
export const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export function globalNumberToRef(globalNumber: number): { surah: number; ayah: number; globalNumber: number } {
  let acc = 0;
  for (let i = 0; i < SURAH_AYAH_COUNTS.length; i++) {
    if (globalNumber <= acc + SURAH_AYAH_COUNTS[i]) {
      return { surah: i + 1, ayah: globalNumber - acc, globalNumber };
    }
    acc += SURAH_AYAH_COUNTS[i];
  }
  return { surah: 1, ayah: 1, globalNumber: 1 };
}

export function refToGlobalNumber(surah: number, ayah: number): number {
  let acc = 0;
  for (let i = 0; i < surah - 1; i++) acc += SURAH_AYAH_COUNTS[i];
  return acc + ayah;
}

export interface SearchResult {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  globalNumber: number;
  cleanText: string;
  uthmaniText: string;
}

export async function getQuranSearchIndex(): Promise<SearchResult[]> {
  const parseIndex = (value: unknown) => {
    const items = z.array(z.object({ surahNumber: z.number(), surahName: z.string(), ayahNumber: z.number(), globalNumber: z.number(), cleanText: z.string().min(1), uthmaniText: z.string().min(1) })).length(6236).parse(value);
    if (items.some((a, index) => a.globalNumber !== index + 1 || a.globalNumber !== refToGlobalNumber(a.surahNumber, a.ayahNumber))) throw new Error("فهرس البحث غير مكتمل");
    return items.map((a) => ({ ...a, cleanText: stripOpeningBasmala(a.cleanText, a.surahNumber, a.ayahNumber), uthmaniText: stripOpeningBasmala(a.uthmaniText, a.surahNumber, a.ayahNumber) }));
  };
  return cachedQuran("search-index", async () => {
    const parseFull = (value: unknown) => {
      const full = z.object({ surahs: z.array(z.unknown()).length(114) }).parse(value);
      return full.surahs.map((s, index) => validateSurah(s, index + 1));
    };
    try {
      const [clean, uthmani] = await Promise.all([fetchJson(`${BASE}/quran/quran-simple-clean`, parseFull), fetchJson(`${BASE}/quran/quran-uthmani`, parseFull)]);
      return clean.flatMap((s, index) => s.ayahs.map((a, i) => ({ surahNumber: s.number, surahName: s.name, ayahNumber: a.numberInSurah, globalNumber: a.number, cleanText: a.text, uthmaniText: uthmani[index].ayahs[i].text })));
    } catch {
      const [surahs, json] = await Promise.all([getSurahs(), fetchJson("https://api.quran.com/api/v4/quran/verses/uthmani", (value) => z.object({ verses: z.array(z.object({ verse_key: z.string(), text_uthmani: z.string().min(1) })).length(6236) }).parse(value), false)]);
      return json.verses.map((v) => {
        const [surah, ayah] = v.verse_key.split(":").map(Number);
        const meta = surahs.find((s) => s.number === surah);
        if (!meta) throw new Error("مرجع البحث غير صالح");
        return { surahNumber: surah, surahName: meta.name, ayahNumber: ayah, globalNumber: refToGlobalNumber(surah, ayah), cleanText: normalizeArabic(v.text_uthmani), uthmaniText: v.text_uthmani };
      });
    }
  }, parseIndex);
}
export async function searchQuran(query: string): Promise<SearchResult[]> {
  const q = normalizeArabic(query);
  if (!q) return [];
  const index = await getQuranSearchIndex();
  return index.filter((a) => normalizeArabic(stripOpeningBasmala(a.cleanText, a.surahNumber, a.ayahNumber)).includes(q));
}

const EVERYAYAH_ALTERNATES: Record<string, string> = {
  "ar.alafasy": "Alafasy_128kbps", "ar.minshawi": "Minshawy_Murattal_128kbps", "ar.husary": "Husary_128kbps",
  "ar.husarymujawwad": "Husary_Mujawwad_128kbps", "ar.abdulbasitmurattal": "Abdul_Basit_Murattal_192kbps",
  "ar.hudhaify": "Hudhaify_128kbps", "ar.ahmedajamy": "Ahmed_ibn_Ali_al-Ajamy_128kbps", "ar.shaatree": "Abu_Bakr_Ash-Shaatree_128kbps",
};
export function ayahAudioSources(reciter: ReciterOption, surah: number, ayah: number, global: number, preferred?: string): string[] {
  const sources = [preferred, ayahAudioUrl(reciter, surah, ayah, global)].filter((url): url is string => !!url);
  if (reciter.audio.type === "alquran") {
    sources.push(`https://cdn.islamic.network/quran/audio/64/${reciter.audio.edition}/${global}.mp3`);
    const folder = EVERYAYAH_ALTERNATES[reciter.audio.edition];
    if (folder) sources.push(`https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3`);
  }
  return [...new Set(sources)];
}
