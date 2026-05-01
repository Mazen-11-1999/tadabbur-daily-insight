// Quran data via AlQuran.cloud API (free, no key required)
// Docs: https://alquran.cloud/api

const BASE = "https://api.alquran.cloud/v1";
// Tafseer fallback API (يحتوي ابن كثير، السعدي، الطبري)
// docs: http://api.quran-tafseer.com
const TAFSEER_BASE = "https://api.quran-tafseer.com/tafseer";

// خرائط معرّفات التفاسير → quran-tafseer.com IDs
const TAFSEER_COM_IDS: Record<string, number> = {
  "ibnkathir": 4,
  "saadi": 3,
  "tabari": 8,
};

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
  { id: "ibnkathir", label: "تفسير ابن كثير" },
  { id: "saadi", label: "تفسير السعدي" },
  { id: "ar.jalalayn", label: "تفسير الجلالين" },
  { id: "ar.qurtubi", label: "تفسير القرطبي" },
  { id: "tabari", label: "تفسير الطبري" },
] as const;

// Reciters (AlQuran.cloud edition identifiers)
export const RECITER_OPTIONS = [
  { id: "ar.haithamaldukhain", label: "هيثم الدخين" },
  { id: "ar.alafasy", label: "مشاري العفاسي" },
  { id: "ar.abdulbasitmurattal", label: "عبد الباسط عبد الصمد" },
  { id: "ar.mahermuaiqly", label: "ماهر المعيقلي" },
  { id: "ar.abdurrahmaansudais", label: "السديس" },
  { id: "ar.husary", label: "محمود الحصري" },
] as const;

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
 * Fetch a single ayah with arabic + tafsir + audio in one shot
 * using the multi-edition endpoint.
 */
export async function getAyah(
  surah: number,
  ayah: number,
  tafsirEdition = "ar.muyassar",
  reciterEdition = "ar.haithamaldukhain",
): Promise<CombinedAyah> {
  const ref = `${surah}:${ayah}`;
  const useExternalTafsir = tafsirEdition in TAFSEER_COM_IDS;
  const alquranEditions = useExternalTafsir
    ? `quran-uthmani,${reciterEdition}`
    : `quran-uthmani,${tafsirEdition},${reciterEdition}`;

  const [mainRes, externalTafsir] = await Promise.all([
    fetch(`${BASE}/ayah/${ref}/editions/${alquranEditions}`).then((r) => r.json()),
    useExternalTafsir
      ? fetch(`${TAFSEER_BASE}/${TAFSEER_COM_IDS[tafsirEdition]}/${surah}/${ayah}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!mainRes.data || !Array.isArray(mainRes.data)) {
    throw new Error("لم نتمكن من جلب الآية");
  }
  const arabicData = mainRes.data[0] as AyahData;
  let tafsirText: string;
  let audioData: AyahData & { audio?: string };
  if (useExternalTafsir) {
    audioData = mainRes.data[1] as AyahData & { audio?: string };
    tafsirText = externalTafsir?.text || "تعذّر جلب التفسير حالياً.";
  } else {
    const tafsirData = mainRes.data[1] as AyahData;
    audioData = mainRes.data[2] as AyahData & { audio?: string };
    tafsirText = tafsirData.text;
  }

  return {
    arabic: arabicData.text,
    tafsir: tafsirText,
    audioUrl: (audioData as { audio?: string }).audio || `https://cdn.islamic.network/quran/audio/128/${reciterEdition}/${arabicData.number}.mp3`,
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