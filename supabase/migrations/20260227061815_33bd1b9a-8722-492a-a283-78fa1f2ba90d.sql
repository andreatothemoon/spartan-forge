
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1) athlete_profiles
CREATE TABLE public.athlete_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  dob DATE,
  weight_kg NUMERIC,
  max_hr INT,
  threshold_hr INT,
  threshold_pace_sec_per_km INT,
  pace_zones_json JSONB DEFAULT '[]'::jsonb,
  hr_zones_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own athlete profiles" ON public.athlete_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_athlete_profiles_updated_at BEFORE UPDATE ON public.athlete_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) training_goals
CREATE TABLE public.training_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_type TEXT NOT NULL DEFAULT 'SPARTAN_ULTRA',
  race_date DATE NOT NULL DEFAULT '2026-09-26',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own training goals" ON public.training_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_training_goals_updated_at BEFORE UPDATE ON public.training_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) availability_profiles
CREATE TABLE public.availability_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  days_available_json JSONB NOT NULL DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}'::jsonb,
  max_minutes_by_day_json JSONB NOT NULL DEFAULT '{"mon":45,"tue":45,"wed":45,"thu":45,"fri":90,"sat":0,"sun":0}'::jsonb,
  preferred_long_run_day TEXT NOT NULL DEFAULT 'fri',
  weekend_long_run_avoid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.availability_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own availability" ON public.availability_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_availability_profiles_updated_at BEFORE UPDATE ON public.availability_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) plans
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  athlete_profile_id UUID REFERENCES public.athlete_profiles(id) ON DELETE SET NULL,
  training_goal_id UUID REFERENCES public.training_goals(id) ON DELETE SET NULL,
  availability_profile_id UUID REFERENCES public.availability_profiles(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL DEFAULT 'Spartan Ultra Plan',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT '2026-09-26',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON public.plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) sessions
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  session_type TEXT NOT NULL DEFAULT 'easy',
  primary_target TEXT NOT NULL DEFAULT 'pace',
  notes TEXT DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON public.sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.plans WHERE plans.id = sessions.plan_id AND plans.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.plans WHERE plans.id = sessions.plan_id AND plans.user_id = auth.uid()));
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) session_steps
CREATE TABLE public.session_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  step_order INT NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL DEFAULT 'work',
  duration_type TEXT NOT NULL DEFAULT 'time',
  duration_value INT NOT NULL DEFAULT 300,
  target_pace_low_sec_per_km INT,
  target_pace_high_sec_per_km INT,
  target_hr_low_bpm INT,
  target_hr_high_bpm INT,
  step_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own session steps" ON public.session_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.sessions JOIN public.plans ON plans.id = sessions.plan_id WHERE sessions.id = session_steps.session_id AND plans.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions JOIN public.plans ON plans.id = sessions.plan_id WHERE sessions.id = session_steps.session_id AND plans.user_id = auth.uid()));
CREATE TRIGGER update_session_steps_updated_at BEFORE UPDATE ON public.session_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) export_jobs
CREATE TABLE public.export_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'JSON',
  status TEXT NOT NULL DEFAULT 'queued',
  download_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own export jobs" ON public.export_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON public.export_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
