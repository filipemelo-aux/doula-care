DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'birth_type') THEN
    CREATE TYPE public.birth_type AS ENUM ('natural', 'normal_induzido', 'cesarea_intraparto', 'cesarea_eletiva');
  END IF;
END $$;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birth_type public.birth_type;