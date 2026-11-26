import { queryOptions } from "@tanstack/react-query";
import { getSurahs, getSurahWithTafsir, getAyah } from "./quran-api";

export const surahsQuery = () => queryOptions({ queryKey: ["quran", "surahs"], queryFn: getSurahs, retry: false });
export const surahQuery = (surah: number, tafsir = "ar.muyassar") => queryOptions({
  queryKey: ["quran", `tafsir:${surah}:${tafsir}`], queryFn: () => getSurahWithTafsir(surah, tafsir), retry: false,
});
export const ayahQuery = (surah: number, ayah: number, tafsir = "ar.muyassar", reciter = "ar.alafasy") => queryOptions({
  queryKey: ["quran", `ayah:${surah}:${ayah}:${tafsir}:${reciter}`], queryFn: () => getAyah(surah, ayah, tafsir, reciter), retry: false,
});