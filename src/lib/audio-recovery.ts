/** One recovery chain per audio element; late events from replaced sources are ignored. */
export function recoverableAudio(audio: HTMLAudioElement, sources: string[], signal: AbortSignal, failed: (message: string) => void, changed?: () => void) {
  let index = 0;
  let generation = 0;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer) clearTimeout(timer); };
  const fail = (message = "تعذّر تشغيل تلاوة هذا القارئ. تحقق من الاتصال ثم أعد المحاولة.") => {
    if (finished || signal.aborted) return;
    finished = true;
    clear();
    failed(message);
  };
  const advance = () => {
    if (finished || signal.aborted) return;
    clear();
    if (++index >= sources.length) { fail(); return; }
    changed?.();
    audio.src = sources[index];
    void start();
  };
  const start = async () => {
    if (finished || signal.aborted) return;
    const current = ++generation;
    clear();
    timer = setTimeout(advance, 15_000);
    try { await audio.play(); if (current === generation) clear(); }
    catch (error) {
      if (signal.aborted || current !== generation) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        fail("المتصفح منع التشغيل التلقائي. اضغط زر الاستماع لتشغيل الصوت.");
      } else if (!(error instanceof DOMException && error.name === "AbortError")) advance();
    }
  };
  audio.addEventListener("error", advance, { signal });
  audio.addEventListener("playing", clear, { signal });
  signal.addEventListener("abort", () => { finished = true; clear(); }, { once: true });
  if (sources[0] && audio.src !== sources[0]) audio.src = sources[0];
  return start;
}