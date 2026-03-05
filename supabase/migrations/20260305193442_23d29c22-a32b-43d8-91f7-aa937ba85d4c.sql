
-- Table to track beta promotions per organization
CREATE TABLE public.org_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  promotion_type text NOT NULL DEFAULT 'beta_tester',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  bonus_choice text, -- 'extra_30_days' or 'annual_50_discount'
  bonus_chosen_at timestamptz,
  bonus_started_at timestamptz,
  bonus_ends_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- pending, trial_active, awaiting_choice, bonus_active, completed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, promotion_type)
);

-- Enable RLS
ALTER TABLE public.org_promotions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all promotions
CREATE POLICY "Super admins can manage all promotions"
  ON public.org_promotions FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Admins can view their own org promotions
CREATE POLICY "Admins can view own org promotions"
  ON public.org_promotions FOR SELECT
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) AND organization_id = get_user_organization_id());

-- Admins can update their own org promotions (for choosing bonus)
CREATE POLICY "Admins can update own org promotions"
  ON public.org_promotions FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) AND organization_id = get_user_organization_id())
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) AND organization_id = get_user_organization_id());
