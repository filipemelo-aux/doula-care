
-- Security definer functions for Super Admin moderation area
-- These bypass RLS to allow dual-role super admins to view all org data

CREATE OR REPLACE FUNCTION public.get_moderation_messages(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  client_name text,
  title text,
  message text,
  attachment_url text,
  attachment_type text,
  read boolean,
  read_by_client boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cn.id, cn.client_id, c.full_name AS client_name,
    cn.title, cn.message, cn.attachment_url, cn.attachment_type,
    cn.read, cn.read_by_client, cn.created_at
  FROM public.client_notifications cn
  JOIN public.clients c ON c.id = cn.client_id
  WHERE cn.organization_id = p_org_id
    AND (cn.title = 'Mensagem da Doula' OR cn.title LIKE 'Mensagem de %')
  ORDER BY cn.created_at DESC
  LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_contracts(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  client_name text,
  title text,
  status text,
  signed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cc.id, cc.client_id, c.full_name AS client_name,
    cc.title, cc.status, cc.signed_at, cc.created_at
  FROM public.client_contracts cc
  JOIN public.clients c ON c.id = cc.client_id
  WHERE cc.organization_id = p_org_id
  ORDER BY cc.created_at DESC
  LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_transactions(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  client_name text,
  description text,
  amount numeric,
  amount_received numeric,
  type text,
  payment_method text,
  date date,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    t.id, c.full_name AS client_name,
    t.description, t.amount, t.amount_received, 
    t.type::text, t.payment_method::text, t.date, t.created_at
  FROM public.transactions t
  LEFT JOIN public.clients c ON c.id = t.client_id
  WHERE t.organization_id = p_org_id
  ORDER BY t.created_at DESC
  LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_diary(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  client_name text,
  content text,
  emotion text,
  symptoms text[],
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pd.id, pd.client_id, c.full_name AS client_name,
    pd.content, pd.emotion, pd.symptoms, pd.created_at
  FROM public.pregnancy_diary pd
  JOIN public.clients c ON c.id = pd.client_id
  WHERE pd.organization_id = p_org_id
  ORDER BY pd.created_at DESC
  LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_notifications(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  client_name text,
  title text,
  message text,
  read boolean,
  read_by_client boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cn.id, cn.client_id, c.full_name AS client_name,
    cn.title, cn.message, cn.read, cn.read_by_client, cn.created_at
  FROM public.client_notifications cn
  JOIN public.clients c ON c.id = cn.client_id
  WHERE cn.organization_id = p_org_id
    AND cn.title != 'Mensagem da Doula' 
    AND cn.title NOT LIKE 'Mensagem de %'
  ORDER BY cn.created_at DESC
  LIMIT 200
$$;
