
-- Fix 1: Drop legacy blanket policies
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all access to plan_settings" ON public.plan_settings;

-- Fix 2: Add proper policies for transactions (admin/moderator only)
CREATE POLICY "Admins can manage all transactions"
ON public.transactions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- Fix 3: Add proper policies for plan_settings
CREATE POLICY "Admins can manage plan settings"
ON public.plan_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active plans"
ON public.plan_settings FOR SELECT
TO authenticated
USING (is_active = true);

-- Fix 4: Add admin policy for clients (the existing "Clients can view own data" and "Clients can update own contact info" remain)
CREATE POLICY "Admins can manage all clients"
ON public.clients FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));
