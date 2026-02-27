ALTER TABLE public.platform_plan_limits
  ADD COLUMN IF NOT EXISTS agenda boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS financial boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expenses boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS messages boolean NOT NULL DEFAULT true;