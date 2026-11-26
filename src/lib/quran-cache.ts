import { get, set, del } from "idb-keyval";

const pending = new Map<string, Promise<unknown>>();
const listeners = new Set<(key: string, value: unknown) => void>();
export function subscribeQuranCache(listener: (key: string, value: unknown) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** No IndexedDB during SSR; storage failures must never break Quran reading. */
export async function cachedQuran<T>(key: string, load: () => Promise<T>, validate: (value: unknown) => T): Promise<T> {
  const browser = typeof indexedDB !== "undefined";
  let cached: T | undefined;
  if (browser) {
    try {
      const stored: unknown = await get(`tadabbur-v3:${key}`);
      if (stored !== undefined) cached = validate(stored);
    } catch { try { await del(`tadabbur-v3:${key}`); } catch { /* unavailable storage */ } }
  }
  const refresh = () => {
    const existing = pending.get(key);
    if (browser && existing) return existing as Promise<T>;
    const task = load().then(validate).then(async (value) => {
      if (browser) {
        try { await set(`tadabbur-v3:${key}`, value); } catch { /* read-only/private storage */ }
        listeners.forEach((listener) => listener(key, value));
      }
      return value;
    }).finally(() => { if (browser) pending.delete(key); });
    if (browser) pending.set(key, task);
    return task;
  };
  if (cached !== undefined) {
    void refresh().catch(() => { /* retain valid stale content on network failure */ });
    return cached;
  }
  return refresh();
}