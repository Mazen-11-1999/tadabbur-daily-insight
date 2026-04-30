CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  notification_hour integer NOT NULL DEFAULT 6,
  enabled boolean NOT NULL DEFAULT true,
  last_sent_date date,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subs" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subs" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subs" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own subs" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_push_subs_hour_enabled ON public.push_subscriptions(notification_hour, enabled) WHERE enabled = true;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;