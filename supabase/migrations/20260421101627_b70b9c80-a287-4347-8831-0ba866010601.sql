
-- ENUM for region
CREATE TYPE public.region_t AS ENUM ('Marmara', 'Ege', 'İç Anadolu');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  region region_t NOT NULL DEFAULT 'Marmara',
  client TEXT NOT NULL DEFAULT 'Putzmeister',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, region)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE((NEW.raw_user_meta_data->>'region')::region_t, 'Marmara')
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- technicians (master ustas: Kemal/Ahmet/Murat)
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  experience_years INT NOT NULL,
  region region_t NOT NULL,
  city TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read technicians" ON public.technicians FOR SELECT TO authenticated USING (true);

-- machines
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_no TEXT,
  year INT,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  region region_t NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok', -- ok | busy | fault | service
  operating_hours INT NOT NULL DEFAULT 0,
  last_service DATE,
  next_maintenance DATE,
  alert_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read machines" ON public.machines FOR SELECT TO authenticated USING (true);

-- work_orders
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  alarm_code TEXT,
  complaint TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- urgent|active|scheduled|closed
  badge TEXT NOT NULL DEFAULT 'scheduled',
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read work_orders" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert work_orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "assignee update work_orders" ON public.work_orders FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR assignee_id IS NULL);

-- corrections (learning loop)
CREATE TABLE public.corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene TEXT NOT NULL,
  wrong TEXT NOT NULL,
  correct TEXT NOT NULL,
  lesson TEXT NOT NULL,
  usta TEXT NOT NULL,
  bolge region_t NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read corrections" ON public.corrections FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert corrections" ON public.corrections FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- learning_cases (every closed WO)
CREATE TABLE public.learning_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  usta TEXT NOT NULL,
  bolge region_t NOT NULL,
  month TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read learning_cases" ON public.learning_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert learning_cases" ON public.learning_cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE INDEX ON public.machines(region);
CREATE INDEX ON public.machines(city);
CREATE INDEX ON public.work_orders(machine_id);
CREATE INDEX ON public.work_orders(assignee_id);
