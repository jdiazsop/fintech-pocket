
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS email text;

DROP FUNCTION IF EXISTS public.get_loan_by_token(uuid);
CREATE OR REPLACE FUNCTION public.get_loan_by_token(_token uuid)
RETURNS TABLE(
  id uuid, name text, concept text, amount_lent numeric, amount_to_return numeric,
  start_date date, payment_type text, frequency text, confirmation_status text,
  num_installments bigint, confirmation_sent_at timestamptz, confirmation_responded_at timestamptz,
  operation_type text, expired boolean, phone_masked text, otp_verified boolean, otp_active boolean,
  email_masked text, dni_required boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    l.id, l.name, l.concept, l.amount_lent, l.amount_to_return,
    l.start_date, l.payment_type, l.frequency, l.confirmation_status,
    (SELECT COUNT(*) FROM public.installments i WHERE i.loan_id = l.id),
    l.confirmation_sent_at, l.confirmation_responded_at,
    l.operation_type,
    (l.confirmation_token_expires_at IS NOT NULL AND l.confirmation_token_expires_at < now()) AS expired,
    CASE
      WHEN l.phone_number IS NULL OR length(l.phone_number) < 4 THEN NULL
      ELSE COALESCE(l.phone_country_code, '') || ' *** ' || right(l.phone_number, 3)
    END AS phone_masked,
    (l.otp_verified_at IS NOT NULL AND l.otp_verified_at > now() - interval '60 minutes') AS otp_verified,
    (l.otp_hash IS NOT NULL AND l.otp_expires_at IS NOT NULL AND l.otp_expires_at > now()) AS otp_active,
    CASE
      WHEN l.email IS NULL OR position('@' in l.email) < 2 THEN NULL
      ELSE left(l.email, 1) || '***' || substring(l.email from position('@' in l.email))
    END AS email_masked,
    (l.dni IS NOT NULL AND length(l.dni) >= 6) AS dni_required
  FROM public.loans l
  WHERE l.confirmation_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.verify_confirmation_dni(_token uuid, _dni text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_loan RECORD;
  v_input text;
BEGIN
  IF _dni IS NULL OR length(trim(_dni)) < 6 THEN
    RETURN false;
  END IF;
  v_input := upper(regexp_replace(_dni, '[^A-Za-z0-9]', '', 'g'));

  SELECT * INTO v_loan FROM public.loans
    WHERE confirmation_token = _token
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_loan.confirmation_token_expires_at IS NOT NULL
     AND v_loan.confirmation_token_expires_at < now() THEN
    RETURN false;
  END IF;

  IF v_loan.dni IS NULL OR length(v_loan.dni) < 6 THEN
    RETURN false;
  END IF;

  IF v_loan.otp_attempts >= 8 THEN
    RETURN false;
  END IF;

  IF upper(regexp_replace(v_loan.dni, '[^A-Za-z0-9]', '', 'g')) <> v_input THEN
    UPDATE public.loans
      SET otp_attempts = otp_attempts + 1
      WHERE id = v_loan.id;
    RETURN false;
  END IF;

  UPDATE public.loans
    SET otp_verified_at = now(),
        otp_phone_validated = v_input,
        otp_attempts = 0
    WHERE id = v_loan.id;

  RETURN true;
END;
$$;
