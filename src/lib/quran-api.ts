// Quran data via AlQuran.cloud API (free, no key required)
// Docs: https://alquran.cloud/api
import { get, set } from 'idb-keyval';

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

const _wordSyncCache = new Map<string, AyahWordSync[]>();
export async function getChapterWordSync(quranComId: number, chapter: number): Promise<AyahWordSync[]> {
  const key = `${quranComId}:${chapter}`;
  const cached = _wordSyncCache.get(key);
  if (cached) return cached;
  const res = await fetch(
    `https://api.quran.com/api/v4/recitations/${quranComId}/by_chapter/${chapter}?per_page=300&fields=segments`,
  );
  const j = await res.json();
  const out: AyahWordSync[] = (j.audio_files ?? []).map((f: { verse_key: string; url: string; segments: number[][] }) => ({
    verseKey: f.verse_key,
    numberInSurah: Number(f.verse_key.split(":")[1]),
    audioUrl: f.url.startsWith("http") ? f.url : `https://verses.quran.com/${f.url}`,
    segments: f.segments ?? [],
  }));
  _wordSyncCache.set(key, out);
  return out;
}

let _surahsCache: SurahMeta[] | null = null;
export async function getSurahs(): Promise<SurahMeta[]> {
  if (_surahsCache) return _surahsCache;
  const res = await fetch(`${BASE}/surah`);
  const j = await res.json();
  _surahsCache = j.data as SurahMeta[];
  return _surahsCache;
}

export async function getSurahWithAyahs(surahNumber: number, edition = "quran-uthmani") {
  const res = await fetch(`${BASE}/surah/${surahNumber}/${edition}`);
  const j = await res.json();
  return j.data as SurahMeta & { ayahs: AyahData[] };
}

/**
 * Fetch a full surah with arabic text + tafsir for every ayah in one request.
 */
export async function getSurahWithTafsir(surahNumber: number, tafsirEdition = "ar.muyassar") {
  const res = await fetch(`${BASE}/surah/${surahNumber}/editions/quran-uthmani,${tafsirEdition}`);
  const j = await res.json();
  if (!j.data || !Array.isArray(j.data)) throw new Error("تعذر تحميل السورة");
  const arabic = j.data[0] as SurahMeta & { ayahs: AyahData[] };
  const tafsir = j.data[1] as SurahMeta & { ayahs: AyahData[] };
  const tafsirMap = new Map<number, string>();
  tafsir.ayahs.forEach((a) => tafsirMap.set(a.numberInSurah, a.text));
  return {
    ...arabic,
    ayahs: arabic.ayahs.map((a) => ({ ...a, tafsir: tafsirMap.get(a.numberInSurah) ?? "" })),
  };
}

/**
 * Fetch a single ayah with arabic + tafsir + audio in one shot
 * using the multi-edition endpoint.
 */
export async function getAyah(
  surah: number,
  ayah: number,
  tafsirEdition = "ar.muyassar",
  reciterEdition = "ar.alafasy",
): Promise<CombinedAyah> {
  const ref = `${surah}:${ayah}`;
  // Daily ayah needs per-ayah audio. If the selected reciter is a full-surah-only one,
  // fall back to Alafasy for the single-ayah preview.
  const safeReciter = reciterEdition.startsWith("ar.") ? reciterEdition : "ar.alafasy";
  const editions = `quran-uthmani,${tafsirEdition},${safeReciter}`;
  const mainRes = await fetch(`${BASE}/ayah/${ref}/editions/${editions}`).then((r) => r.json());

  if (!mainRes.data || !Array.isArray(mainRes.data)) {
    throw new Error("لم نتمكن من جلب الآية");
  }
  const arabicData = mainRes.data[0] as AyahData;
  const tafsirData = mainRes.data[1] as AyahData;
  const audioData = mainRes.data[2] as AyahData & { audio?: string };
  const tafsirText = tafsirData.text;

  return {
    arabic: arabicData.text,
    tafsir: tafsirText,
    audioUrl: (audioData as { audio?: string }).audio || `https://cdn.islamic.network/quran/audio/128/${safeReciter}/${arabicData.number}.mp3`,
    surah: arabicData.surah,
    numberInSurah: arabicData.numberInSurah,
    globalNumber: arabicData.number,
  };
}

/**
 * Pick a deterministic "ayah of the day" based on date.
 * Uses YYYY-MM-DD seed -> stable ayah within 1..6236.
 */
export function getDailyAyahRef(date = new Date()): { surah: number; ayah: number; globalNumber: number } {
  const seed = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const TOTAL = 6236;
  const globalNumber = (h % TOTAL) + 1;
  return globalNumberToRef(globalNumber);
}

// Cumulative ayah counts per surah (1..114). Built once.
const SURAH_AYAH_COUNTS = [
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
  const CACHE_KEY = "quran_search_index";
  let index = await get(CACHE_KEY);
  if (index) return index;

  const [cleanRes, uthmaniRes] = await Promise.all([
    fetch(`${BASE}/quran/quran-simple-clean`),
    fetch(`${BASE}/quran/quran-uthmani`)
  ]);
  const cleanJson = await cleanRes.json();
  const uthmaniJson = await uthmaniRes.json();

  const ayahs: SearchResult[] = [];
  for (let s = 0; s < cleanJson.data.surahs.length; s++) {
    const cleanSurah = cleanJson.data.surahs[s];
    const uthmaniSurah = uthmaniJson.data.surahs[s];
    for (let a = 0; a < cleanSurah.ayahs.length; a++) {
      ayahs.push({
        surahNumber: cleanSurah.number,
        surahName: cleanSurah.name,
        ayahNumber: cleanSurah.ayahs[a].numberInSurah,
        globalNumber: cleanSurah.ayahs[a].number,
        cleanText: cleanSurah.ayahs[a].text,
        uthmaniText: uthmaniSurah.ayahs[a].text,
      });
    }
  }
  await set(CACHE_KEY, ayahs);
  return ayahs;
}

export async function searchQuran(query: string): Promise<SearchResult[]> {
  const index = await getQuranSearchIndex();
  const normalize = (text: string) => text.replace(/[\u0617-\u061A\u064B-\u0652\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "").replace(/[أإآا]/g, "ا").replace(/[ةه]/g, "ه").replace(/[ىي]/g, "ي");
  const q = normalize(query);
  return index.filter(a => normalize(a.cleanText).includes(q));
}