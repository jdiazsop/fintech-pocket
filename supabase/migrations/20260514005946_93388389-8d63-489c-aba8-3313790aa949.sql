-- Ensure pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- New columns on loans for OTP traceability
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS otp_hash text,
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_phone_validated text;

-- RPC: owner generates a fresh 6-digit OTP for an operation they own
CREATE OR REPLACE FUNCTION public.request_confirmation_otp(_loan_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_code text;
  v_hash text;
BEGIN
  SELECT * INTO v_loan FROM public.loans
    WHERE id = _loan_id AND user_id = auth.uid()
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found or access denied';
  END IF;

  -- 6-digit numeric code, zero-padded
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_hash := encode(digest(v_code, 'sha256'), 'hex');

  UPDATE public.loans
    SET otp_hash = v_hash,
        otp_expires_at = now() + interval '24 hours',
        otp_attempts = 0,
        otp_verified_at = NULL,
        otp_phone_validated = NULL
    WHERE id = _loan_id;

  RETURN v_code;
END;
$$;

-- RPC: client (public) verifies the OTP using the public token
CREATE OR REPLACE FUNCTION public.verify_confirmation_otp(_token uuid, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_hash text;
  v_phone text;
BEGIN
  IF _code IS NULL OR length(_code) <> 6 THEN
    RETURN false;
  END IF;

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

  IF v_loan.otp_hash IS NULL OR v_loan.otp_expires_at IS NULL
     OR v_loan.otp_expires_at < now() THEN
    RETURN false;
  END IF;

  IF v_loan.otp_attempts >= 5 THEN
    RETURN false;
  END IF;

  v_hash := encode(digest(_code, 'sha256'), 'hex');

  IF v_hash <> v_loan.otp_hash THEN
    UPDATE public.loans
      SET otp_attempts = otp_attempts + 1
      WHERE id = v_loan.id;
    RETURN false;
  END IF;

  v_phone := COALESCE(v_loan.phone_country_code, '') || COALESCE(v_loan.phone_number, '');

  UPDATE public.loans
    SET otp_verified_at = now(),
        otp_phone_validated = v_phone,
        otp_attempts = 0
    WHERE id = v_loan.id;

  RETURN true;
END;
$$;

-- Update respond_loan_confirmation to require a recent OTP validation
CREATE OR REPLACE FUNCTION public.respond_loan_confirmation(_token uuid, _status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
BEGIN
  IF _status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_loan FROM public.loans
    WHERE confirmation_token = _token
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_loan.confirmation_status NOT IN ('pending', 'not_sent') THEN
    RETURN false;
  END IF;

  IF v_loan.confirmation_token_expires_at IS NOT NULL
     AND v_loan.confirmation_token_expires_at < now() THEN
    RETURN false;
  END IF;

  IF v_loan.otp_verified_at IS NULL
     OR v_loan.otp_verified_at < now() - interval '60 minutes' THEN
    RAISE EXCEPTION 'OTP_NOT_VERIFIED';
  END IF;

  UPDATE public.loans
    SET confirmation_status = _status,
        confirmation_responded_at = now()
    WHERE id = v_loan.id;

  RETURN true;
END;
$$;

-- Extend public token RPC: include OTP state and masked phone
DROP FUNCTION IF EXISTS public.get_loan_by_token(uuid);
CREATE OR REPLACE FUNCTION public.get_loan_by_token(_token uuid)
RETURNS TABLE(
  id uuid, name text, concept text, amount_lent numeric, amount_to_return numeric,
  start_date date, payment_type text, frequency text, confirmation_status text,
  num_installments bigint, confirmation_sent_at timestamptz,
  confirmation_responded_at timestamptz, operation_type text, expired boolean,
  phone_masked text, otp_verified boolean, otp_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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
    (l.otp_hash IS NOT NULL AND l.otp_expires_at IS NOT NULL AND l.otp_expires_at > now()) AS otp_active
  FROM public.loans l
  WHERE l.confirmation_token = _token
  LIMIT 1;
$$;