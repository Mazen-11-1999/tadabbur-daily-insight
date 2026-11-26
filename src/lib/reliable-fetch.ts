export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_ATTEMPTS = 3;

/** Each attempt, including body parsing, is bounded. Parsers reject incomplete data. */
export async function fetchJson<T>(url: string, parse: (data: unknown) => T, envelope = true): Promise<T> {
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json: unknown = await response.json();
      if (envelope) {
        if (!json || typeof json !== "object" || !("code" in json) || json.code !== 200 || !("data" in json)) {
          throw new Error("Invalid response envelope");
        }
        return parse(json.data);
      }
      return parse(json);
    } catch {
      if (attempt === FETCH_ATTEMPTS - 1) throw new Error("تعذّر تحميل البيانات بعد عدة محاولات. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error("تعذّر تحميل البيانات.");
}