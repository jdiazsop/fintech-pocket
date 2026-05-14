-- Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin-wide read RPC for metrics & tables (bypasses per-row RLS securely)
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM public.profiles),
    'clients', (SELECT COUNT(*) FROM public.clients),
    'operations', (SELECT COUNT(*) FROM public.loans),
    'loans', (SELECT COUNT(*) FROM public.loans WHERE operation_type = 'loan'),
    'sales', (SELECT COUNT(*) FROM public.loans WHERE operation_type = 'sale'),
    'payments', (SELECT COUNT(*) FROM public.payments_history),
    'pending_confirm', (SELECT COUNT(*) FROM public.loans WHERE confirmation_status IN ('pending','sent')),
    'confirmed', (SELECT COUNT(*) FROM public.loans WHERE confirmation_status = 'confirmed'),
    'rejected', (SELECT COUNT(*) FROM public.loans WHERE confirmation_status = 'rejected')
  ) INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, accepted_terms boolean, created_at timestamptz, clients_count bigint, loans_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT p.user_id, p.email, p.accepted_terms, p.created_at,
      (SELECT COUNT(*) FROM public.clients c WHERE c.user_id = p.user_id),
      (SELECT COUNT(*) FROM public.loans l WHERE l.user_id = p.user_id)
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_clients()
RETURNS TABLE(id uuid, user_id uuid, owner_email text, first_name text, last_name text, dni text, phone text, email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT c.id, c.user_id, p.email, c.first_name, c.last_name, c.dni,
      COALESCE(c.phone_country_code,'') || COALESCE(c.phone_number,''),
      c.email, c.created_at
    FROM public.clients c
    LEFT JOIN public.profiles p ON p.user_id = c.user_id
    ORDER BY c.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_operations()
RETURNS TABLE(id uuid, user_id uuid, owner_email text, name text, operation_type text, amount_lent numeric, amount_to_return numeric, amount_returned numeric, status text, confirmation_status text, start_date date, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT l.id, l.user_id, p.email, l.name, l.operation_type, l.amount_lent, l.amount_to_return,
      l.amount_returned, l.status, l.confirmation_status, l.start_date, l.created_at
    FROM public.loans l
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    ORDER BY l.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_payments()
RETURNS TABLE(id uuid, loan_id uuid, loan_name text, owner_email text, amount_paid numeric, payment_date timestamptz, notes text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT ph.id, ph.loan_id, l.name, p.email, ph.amount_paid, ph.payment_date, ph.notes, ph.created_at
    FROM public.payments_history ph
    LEFT JOIN public.loans l ON l.id = ph.loan_id
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    ORDER BY ph.created_at DESC;
END; $$;
