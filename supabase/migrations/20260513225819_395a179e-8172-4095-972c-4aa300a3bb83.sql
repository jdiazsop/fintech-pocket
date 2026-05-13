
-- Drop and recreate token-related functions to change return type
DROP FUNCTION IF EXISTS public.get_loan_by_token(uuid);

-- 1. ON DELETE CASCADE foreign keys
ALTER TABLE public.installments
  DROP CONSTRAINT IF EXISTS installments_loan_id_fkey,
  ADD CONSTRAINT installments_loan_id_fkey
    FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

ALTER TABLE public.payments_history
  DROP CONSTRAINT IF EXISTS payments_history_loan_id_fkey,
  ADD CONSTRAINT payments_history_loan_id_fkey
    FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

ALTER TABLE public.payments_history
  DROP CONSTRAINT IF EXISTS payments_history_installment_id_fkey,
  ADD CONSTRAINT payments_history_installment_id_fkey
    FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE SET NULL;

ALTER TABLE public.loan_evidences
  DROP CONSTRAINT IF EXISTS loan_evidences_loan_id_fkey,
  ADD CONSTRAINT loan_evidences_loan_id_fkey
    FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;

-- 2. operation_type column
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS operation_type text NOT NULL DEFAULT 'loan';

UPDATE public.loans
  SET operation_type = CASE
    WHEN amount_lent = amount_to_return THEN 'sale'
    ELSE 'loan'
  END;

ALTER TABLE public.loans
  DROP CONSTRAINT IF EXISTS loans_operation_type_check;
ALTER TABLE public.loans
  ADD CONSTRAINT loans_operation_type_check
    CHECK (operation_type IN ('loan','sale'));

-- 3. Token expiration
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS confirmation_token_expires_at timestamptz;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON public.installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments_history(loan_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- 5. Recreate get_loan_by_token with operation_type and expired flag
CREATE FUNCTION public.get_loan_by_token(_token uuid)
 RETURNS TABLE(id uuid, name text, concept text, amount_lent numeric, amount_to_return numeric, start_date date, payment_type text, frequency text, confirmation_status text, num_installments bigint, confirmation_sent_at timestamptz, confirmation_responded_at timestamptz, operation_type text, expired boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id, l.name, l.concept, l.amount_lent, l.amount_to_return,
         l.start_date, l.payment_type, l.frequency, l.confirmation_status,
         (SELECT COUNT(*) FROM public.installments i WHERE i.loan_id = l.id),
         l.confirmation_sent_at, l.confirmation_responded_at,
         l.operation_type,
         (l.confirmation_token_expires_at IS NOT NULL AND l.confirmation_token_expires_at < now()) AS expired
  FROM public.loans l
  WHERE l.confirmation_token = _token
  LIMIT 1;
$function$;

-- Update respond_loan_confirmation to reject expired tokens
CREATE OR REPLACE FUNCTION public.respond_loan_confirmation(_token uuid, _status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.loans
    SET confirmation_status = _status,
        confirmation_responded_at = now()
  WHERE confirmation_token = _token
    AND confirmation_status IN ('pending', 'not_sent')
    AND (confirmation_token_expires_at IS NULL OR confirmation_token_expires_at > now());
  RETURN FOUND;
END;
$function$;

-- 6. Atomic register_payment RPC
CREATE OR REPLACE FUNCTION public.register_payment(
  _loan_id uuid,
  _amount numeric,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loan RECORD;
  v_inst RECORD;
  v_remaining numeric;
  v_pay_for_inst numeric;
  v_new_paid numeric;
  v_new_status text;
  v_new_returned numeric;
  v_payment_id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT * INTO v_loan FROM public.loans
    WHERE id = _loan_id AND user_id = auth.uid()
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found or access denied';
  END IF;

  IF v_loan.amount_returned + _amount > v_loan.amount_to_return + 0.001 THEN
    RAISE EXCEPTION 'Amount exceeds pending balance';
  END IF;

  INSERT INTO public.payments_history (loan_id, amount_paid, notes)
  VALUES (_loan_id, _amount, _notes)
  RETURNING id INTO v_payment_id;

  v_new_returned := v_loan.amount_returned + _amount;
  v_new_status := CASE WHEN v_new_returned >= v_loan.amount_to_return THEN 'paid' ELSE 'partial' END;

  UPDATE public.loans
    SET amount_returned = v_new_returned, status = v_new_status
    WHERE id = _loan_id;

  v_remaining := _amount;
  FOR v_inst IN
    SELECT * FROM public.installments
      WHERE loan_id = _loan_id AND status <> 'paid'
      ORDER BY number ASC
      FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_pay_for_inst := LEAST(v_remaining, v_inst.amount - v_inst.amount_paid);
    v_new_paid := v_inst.amount_paid + v_pay_for_inst;
    v_new_status := CASE WHEN v_new_paid >= v_inst.amount THEN 'paid' ELSE 'partial' END;
    UPDATE public.installments
      SET amount_paid = v_new_paid, status = v_new_status
      WHERE id = v_inst.id;
    v_remaining := v_remaining - v_pay_for_inst;
  END LOOP;

  RETURN v_payment_id;
END;
$$;
