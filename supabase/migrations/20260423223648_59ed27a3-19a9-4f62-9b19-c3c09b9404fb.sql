
-- machine_logs table
CREATE TABLE public.machine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL,
  wo_id uuid NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer NULL,
  status text NOT NULL DEFAULT 'uploaded',
  summary text NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  recurring_match jsonb NULL,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_msg text NULL,
  region region_t NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_machine_logs_machine ON public.machine_logs(machine_id, created_at DESC);

ALTER TABLE public.machine_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read machine_logs"
  ON public.machine_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert own machine_logs"
  ON public.machine_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner update machine_logs"
  ON public.machine_logs FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER trg_machine_logs_updated
  BEFORE UPDATE ON public.machine_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('machine-logs', 'machine-logs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — user folder
CREATE POLICY "users read own machine-logs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'machine-logs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users insert own machine-logs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'machine-logs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own machine-logs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'machine-logs' AND auth.uid()::text = (storage.foldername(name))[1]);
