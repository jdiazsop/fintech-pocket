DROP FUNCTION IF EXISTS public.get_loan_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_loan_by_token(_token uuid)
 RETURNS TABLE(id uuid, name text, concept text, amount_lent numeric, amount_to_return numeric, start_date date, payment_type text, frequency text, confirmation_status text, num_installments bigint, confirmation_sent_at timestamptz, confirmation_responded_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id, l.name, l.concept, l.amount_lent, l.amount_to_return,
         l.start_date, l.payment_type, l.frequency, l.confirmation_status,
         (SELECT COUNT(*) FROM public.installments i WHERE i.loan_id = l.id),
         l.confirmation_sent_at, l.confirmation_responded_at
  FROM public.loans l
  WHERE l.confirmation_token = _token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_installments_by_token(_token uuid)
 RETURNS TABLE(number integer, due_date date, amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.number, i.due_date, i.amount
  FROM public.installments i
  JOIN public.loans l ON l.id = i.loan_id
  WHERE l.confirmation_token = _token
  ORDER BY i.number ASC;
$function$;