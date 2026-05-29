
-- Drop and recreate ampliated metrics
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM public.profiles),
    'active_users', (SELECT COUNT(DISTINCT user_id) FROM public.loans),
    'clients', (SELECT COUNT(*) FROM public.clients),
    'operations', (SELECT COUNT(*) FROM public.loans),
    'loans', (SELECT COUNT(*) FROM public.loans WHERE operation_type = 'loan'),
    'sales', (SELECT COUNT(*) FROM public.loans WHERE operation_type = 'sale'),
    'payments', (SELECT COUNT(*) FROM public.payments_history),
    'total_lent', COALESCE((SELECT SUM(amount_lent) FROM public.loans), 0),
    'total_to_return', COALESCE((SELECT SUM(amount_to_return) FROM public.loans), 0),
    'total_returned', COALESCE((SELECT SUM(amount_returned) FROM public.loans), 0),
    'total_pending', COALESCE((SELECT SUM(amount_to_return - amount_returned) FROM public.loans WHERE status <> 'paid'), 0),
    'pending_confirm', (SELECT COUNT(*) FROM public.loans WHERE confirmation_status IN ('pending','sent')),
    'confirmed', (SELECT COUNT(*) FROM public.loans WHERE confirmation_status = 'confirmed'),
    'rejected', (SELECT COUNT(*) FROM public.loans WHERE confirmation_status = 'rejected'),
    'agreements_sent', (SELECT COUNT(*) FROM public.loans WHERE confirmation_sent_at IS NOT NULL),
    'reminders_sent', 0,
    'overdue_loans', (SELECT COUNT(DISTINCT loan_id) FROM public.installments WHERE due_date < CURRENT_DATE AND status <> 'paid')
  ) INTO v;
  RETURN v;
END;
$$;

-- Users list enriched
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid, email text, accepted_terms boolean, created_at timestamptz,
  role text, clients_count bigint, loans_count bigint,
  total_lent numeric, total_pending numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT p.user_id, p.email, p.accepted_terms, p.created_at,
      COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id ORDER BY ur.role LIMIT 1), 'user'),
      (SELECT COUNT(*) FROM public.clients c WHERE c.user_id = p.user_id),
      (SELECT COUNT(*) FROM public.loans l WHERE l.user_id = p.user_id),
      COALESCE((SELECT SUM(l.amount_lent) FROM public.loans l WHERE l.user_id = p.user_id), 0),
      COALESCE((SELECT SUM(l.amount_to_return - l.amount_returned) FROM public.loans l WHERE l.user_id = p.user_id AND l.status <> 'paid'), 0)
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END; $$;

-- Clients list enriched
DROP FUNCTION IF EXISTS public.admin_list_clients();
CREATE FUNCTION public.admin_list_clients()
RETURNS TABLE(
  id uuid, user_id uuid, owner_email text,
  first_name text, last_name text, dni text, phone text, email text,
  operations_count bigint, total_pending numeric,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT c.id, c.user_id, p.email,
      c.first_name, c.last_name, c.dni,
      COALESCE(c.phone_country_code,'') || COALESCE(c.phone_number,''),
      c.email,
      (SELECT COUNT(*) FROM public.loans l
        WHERE l.user_id = c.user_id
          AND ((l.dni IS NOT NULL AND c.dni IS NOT NULL AND l.dni = c.dni)
            OR (COALESCE(l.first_name,'')||COALESCE(l.last_name,'') = COALESCE(c.first_name,'')||COALESCE(c.last_name,'')))),
      COALESCE((SELECT SUM(l.amount_to_return - l.amount_returned) FROM public.loans l
        WHERE l.user_id = c.user_id
          AND l.status <> 'paid'
          AND ((l.dni IS NOT NULL AND c.dni IS NOT NULL AND l.dni = c.dni)
            OR (COALESCE(l.first_name,'')||COALESCE(l.last_name,'') = COALESCE(c.first_name,'')||COALESCE(c.last_name,'')))), 0),
      c.created_at
    FROM public.clients c
    LEFT JOIN public.profiles p ON p.user_id = c.user_id
    ORDER BY c.created_at DESC;
END; $$;

-- Operations list enriched
DROP FUNCTION IF EXISTS public.admin_list_operations();
CREATE FUNCTION public.admin_list_operations()
RETURNS TABLE(
  id uuid, user_id uuid, owner_email text,
  name text, operation_type text,
  amount_lent numeric, amount_to_return numeric, amount_returned numeric, amount_pending numeric,
  installments_count bigint, status text, confirmation_status text,
  start_date date, next_due_date date, next_due_amount numeric,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT l.id, l.user_id, p.email,
      l.name, l.operation_type,
      l.amount_lent, l.amount_to_return, l.amount_returned,
      (l.amount_to_return - l.amount_returned),
      (SELECT COUNT(*) FROM public.installments i WHERE i.loan_id = l.id),
      l.status, l.confirmation_status,
      l.start_date,
      (SELECT i.due_date FROM public.installments i WHERE i.loan_id = l.id AND i.status <> 'paid' ORDER BY i.due_date ASC LIMIT 1),
      (SELECT (i.amount - i.amount_paid) FROM public.installments i WHERE i.loan_id = l.id AND i.status <> 'paid' ORDER BY i.due_date ASC LIMIT 1),
      l.created_at
    FROM public.loans l
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    ORDER BY l.created_at DESC;
END; $$;

-- Payments list enriched
DROP FUNCTION IF EXISTS public.admin_list_payments();
CREATE FUNCTION public.admin_list_payments()
RETURNS TABLE(
  id uuid, loan_id uuid, loan_name text, operation_type text,
  client_name text, owner_email text,
  amount_paid numeric, balance_after numeric,
  payment_date timestamptz, notes text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT ph.id, ph.loan_id, l.name, l.operation_type,
      l.name AS client_name,
      p.email,
      ph.amount_paid,
      (l.amount_to_return - (
        SELECT COALESCE(SUM(ph2.amount_paid),0) FROM public.payments_history ph2
        WHERE ph2.loan_id = l.id AND ph2.created_at <= ph.created_at
      )),
      ph.payment_date, ph.notes, ph.created_at
    FROM public.payments_history ph
    LEFT JOIN public.loans l ON l.id = ph.loan_id
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    ORDER BY ph.created_at DESC;
END; $$;

-- Consents list
CREATE OR REPLACE FUNCTION public.admin_list_consents()
RETURNS TABLE(
  loan_id uuid, loan_name text, client_name text, operation_type text,
  owner_email text, email_used text,
  confirmation_status text,
  confirmation_sent_at timestamptz,
  confirmation_responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
    SELECT l.id, l.name, l.name, l.operation_type,
      p.email, l.email,
      l.confirmation_status,
      l.confirmation_sent_at,
      l.confirmation_responded_at,
      l.confirmation_token_expires_at,
      l.created_at
    FROM public.loans l
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    ORDER BY l.created_at DESC;
END; $$;

-- User detail
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = _user_id),
    'roles', COALESCE((SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id = _user_id), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'clients', (SELECT COUNT(*) FROM public.clients WHERE user_id = _user_id),
      'operations', (SELECT COUNT(*) FROM public.loans WHERE user_id = _user_id),
      'total_lent', COALESCE((SELECT SUM(amount_lent) FROM public.loans WHERE user_id = _user_id), 0),
      'total_pending', COALESCE((SELECT SUM(amount_to_return - amount_returned) FROM public.loans WHERE user_id = _user_id AND status <> 'paid'), 0),
      'total_returned', COALESCE((SELECT SUM(amount_returned) FROM public.loans WHERE user_id = _user_id), 0),
      'payments', (SELECT COUNT(*) FROM public.payments_history ph JOIN public.loans l ON l.id = ph.loan_id WHERE l.user_id = _user_id)
    ),
    'clients', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM public.clients c WHERE c.user_id = _user_id), '[]'::jsonb),
    'operations', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC) FROM public.loans l WHERE l.user_id = _user_id), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $$;

-- Client detail
CREATE OR REPLACE FUNCTION public.admin_get_client_detail(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v jsonb; v_client RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT * INTO v_client FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'client', to_jsonb(v_client),
    'owner_email', (SELECT email FROM public.profiles WHERE user_id = v_client.user_id),
    'operations', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
      FROM public.loans l
      WHERE l.user_id = v_client.user_id
        AND ((l.dni IS NOT NULL AND v_client.dni IS NOT NULL AND l.dni = v_client.dni)
          OR (COALESCE(l.first_name,'')||COALESCE(l.last_name,'') = COALESCE(v_client.first_name,'')||COALESCE(v_client.last_name,'')))
    ), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $$;

-- Operation detail
CREATE OR REPLACE FUNCTION public.admin_get_operation_detail(_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT jsonb_build_object(
    'loan', (SELECT to_jsonb(l) FROM public.loans l WHERE l.id = _loan_id),
    'owner_email', (SELECT p.email FROM public.profiles p JOIN public.loans l ON l.user_id = p.user_id WHERE l.id = _loan_id),
    'installments', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.number ASC) FROM public.installments i WHERE i.loan_id = _loan_id), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(to_jsonb(ph) ORDER BY ph.created_at DESC) FROM public.payments_history ph WHERE ph.loan_id = _loan_id), '[]'::jsonb),
    'evidences', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'file_name', e.file_name, 'mime_type', e.mime_type, 'size_bytes', e.size_bytes, 'category', e.category, 'created_at', e.created_at)) FROM public.loan_evidences e WHERE e.loan_id = _loan_id), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $$;

-- Global search
CREATE OR REPLACE FUNCTION public.admin_global_search(_q text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v jsonb; q text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  q := '%' || lower(coalesce(_q,'')) || '%';
  SELECT jsonb_build_object(
    'users', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'email', email))
      FROM (SELECT user_id, email FROM public.profiles WHERE lower(email) LIKE q LIMIT 10) s), '[]'::jsonb),
    'clients', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'first_name', first_name, 'last_name', last_name, 'dni', dni,
        'phone', COALESCE(phone_country_code,'')||COALESCE(phone_number,''), 'email', email))
      FROM (SELECT * FROM public.clients
        WHERE lower(coalesce(first_name,'')) LIKE q
           OR lower(coalesce(last_name,'')) LIKE q
           OR lower(coalesce(email,'')) LIKE q
           OR coalesce(dni,'') LIKE q
           OR coalesce(phone_number,'') LIKE q
        LIMIT 10) s), '[]'::jsonb),
    'operations', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'operation_type', operation_type, 'status', status,
        'amount_to_return', amount_to_return))
      FROM (SELECT * FROM public.loans
        WHERE lower(coalesce(name,'')) LIKE q
           OR coalesce(dni,'') LIKE q
           OR id::text LIKE q
           OR coalesce(phone_number,'') LIKE q
           OR lower(coalesce(email,'')) LIKE q
        LIMIT 10) s), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $$;
