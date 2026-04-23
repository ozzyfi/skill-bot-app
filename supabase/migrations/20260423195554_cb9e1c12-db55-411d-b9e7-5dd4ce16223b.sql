-- Sprint 5: correction_rules table (active learned behaviors)
CREATE TABLE public.correction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_profile_id UUID REFERENCES public.master_profiles(id) ON DELETE SET NULL,
  region region_t NOT NULL,
  scene_pattern TEXT NOT NULL,
  wrong TEXT NOT NULL,
  correct TEXT NOT NULL,
  lesson TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applied_count INTEGER NOT NULL DEFAULT 0,
  source_correction_id UUID REFERENCES public.corrections(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_applied_at TIMESTAMPTZ
);

CREATE INDEX idx_correction_rules_region_active ON public.correction_rules(region, is_active);
CREATE INDEX idx_correction_rules_profile ON public.correction_rules(master_profile_id);

ALTER TABLE public.correction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read correction_rules"
  ON public.correction_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert own correction_rules"
  ON public.correction_rules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner update correction_rules"
  ON public.correction_rules FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- service role updates applied_count via edge function (bypasses RLS)

-- Sprint 6: repair_videos table
CREATE TABLE public.repair_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wo_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  learning_case_id UUID REFERENCES public.learning_cases(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  duration_sec INTEGER,
  sop_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error_msg TEXT,
  region region_t,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repair_videos_wo ON public.repair_videos(wo_id);
CREATE INDEX idx_repair_videos_machine ON public.repair_videos(machine_id);
CREATE INDEX idx_repair_videos_status ON public.repair_videos(status);

ALTER TABLE public.repair_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read repair_videos"
  ON public.repair_videos FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert own repair_videos"
  ON public.repair_videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner update repair_videos"
  ON public.repair_videos FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER trg_repair_videos_touch
  BEFORE UPDATE ON public.repair_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for repair videos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-videos', 'repair-videos', false);

-- Storage RLS: users can only read/write their own folder (auth.uid()/...)
CREATE POLICY "users read own repair-videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'repair-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users upload own repair-videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'repair-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own repair-videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'repair-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own repair-videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'repair-videos' AND auth.uid()::text = (storage.foldername(name))[1]);