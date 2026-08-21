CREATE TABLE IF NOT EXISTS public.memorization_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surah_number INT NOT NULL,
  ayah_number INT NOT NULL,
  surah_name TEXT NOT NULL DEFAULT '',
  arabic TEXT NOT NULL DEFAULT '',
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INT NOT NULL DEFAULT 0,
  repetitions INT NOT NULL DEFAULT 0,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, surah_number, ayah_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memorization_items TO authenticated;
GRANT ALL ON public.memorization_items TO service_role;
ALTER TABLE public.memorization_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own memorization items" ON public.memorization_items;
CREATE POLICY "Users manage their own memorization items" ON public.memorization_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);