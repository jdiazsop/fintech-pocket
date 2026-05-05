
-- 1) Add confirmation status & token to loans
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS confirmation_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_responded_at timestamptz;

-- Backfill tokens for any existing rows missing one
UPDATE public.loans SET confirmation_token = gen_random_uuid() WHERE confirmation_token IS NULL;

-- 2) Evidences table
CREATE TABLE IF NOT EXISTS public.loan_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own evidences"
  ON public.loan_evidences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own evidences"
  ON public.loan_evidences FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.loans WHERE loans.id = loan_id AND loans.user_id = auth.uid()
  ));

CREATE POLICY "Users update own evidences"
  ON public.loan_evidences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own evidences"
  ON public.loan_evidences FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_loan_evidences_loan ON public.loan_evidences(loan_id);

-- 3) Public read policy for loans by confirmation_token (for public /confirm page)
CREATE POLICY "Public can view loan by token"
  ON public.loans FOR SELECT
  TO anon, authenticated
  USING (confirmation_token IS NOT NULL);
-- Note: anon needs the token to query; we will filter by token in the client.
-- This still exposes rows when queried without token; we restrict via edge function instead.
-- Drop and replace with stricter approach using a SECURITY DEFINER function.
DROP POLICY "Public can view loan by token" ON public.loans;

-- Function to fetch loan summary by token (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_loan_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  name text,
  concept text,
  amount_lent numeric,
  amount_to_return numeric,
  start_date date,
  payment_type text,
  frequency text,
  confirmation_status text,
  num_installments bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.name, l.concept, l.amount_lent, l.amount_to_return,
         l.start_date, l.payment_type, l.frequency, l.confirmation_status,
         (SELECT COUNT(*) FROM public.installments i WHERE i.loan_id = l.id)
  FROM public.loans l
  WHERE l.confirmation_token = _token
  LIMIT 1;
$$;

-- Function to update confirmation status by token
CREATE OR REPLACE FUNCTION public.respond_loan_confirmation(_token uuid, _status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.loans
    SET confirmation_status = _status,
        confirmation_responded_at = now()
  WHERE confirmation_token = _token
    AND confirmation_status IN ('pending', 'not_sent');
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_loan_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_loan_confirmation(uuid, text) TO anon, authenticated;

-- 4) Storage bucket for evidences (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('operation-evidences', 'operation-evidences', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout = {user_id}/{loan_id}/{filename}
CREATE POLICY "Users read own evidence files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'operation-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own evidence files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'operation-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own evidence files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'operation-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);
