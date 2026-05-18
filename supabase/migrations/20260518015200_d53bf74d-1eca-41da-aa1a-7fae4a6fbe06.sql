CREATE OR REPLACE FUNCTION public.verify_confirmation_otp(_token uuid, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loan RECORD;
  v_code text;
  v_hash text;
  v_phone text;
BEGIN
  v_code := regexp_replace(coalesce(_code, ''), '\D', '', 'g');

  IF length(v_code) <> 6 THEN
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

  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

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
$function$;