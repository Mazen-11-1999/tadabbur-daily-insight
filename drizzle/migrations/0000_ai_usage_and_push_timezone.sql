CREATE TABLE public.ai_usage (
 user_id uuid NOT NULL,
 day date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
 count integer NOT NULL DEFAULT 0 CHECK (count BETWEEN 0 AND 30),
 PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own AI usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE FUNCTION public.consume_ai_usage() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 INSERT INTO public.ai_usage(user_id, day, count) VALUES (auth.uid(), (now() AT TIME ZONE 'UTC')::date, 1)
 ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < 30
 RETURNING count INTO used;
 RETURN used IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_usage() TO authenticated;
ALTER TABLE public.push_subscriptions ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE public.profiles ALTER COLUMN preferred_reciter SET DEFAULT 'ar.alafasy';
CREATE FUNCTION public.delete_account_data(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 DELETE FROM public.favorites WHERE user_id = target_user;
 DELETE FROM public.notes WHERE user_id = target_user;
 DELETE FROM public.streaks WHERE user_id = target_user;
 DELETE FROM public.memorization_items WHERE user_id = target_user;
 DELETE FROM public.push_subscriptions WHERE user_id = target_user;
 DELETE FROM public.ai_usage WHERE user_id = target_user;
 DELETE FROM public.profiles WHERE id = target_user;
END; $$;
REVOKE ALL ON FUNCTION public.delete_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_data(uuid) TO service_role;