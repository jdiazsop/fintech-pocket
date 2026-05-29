-- Prevent any modification or deletion of payment records.
-- Payments are immutable financial records. Owners cannot edit or delete them via the API.
CREATE POLICY "No one can update payments"
ON public.payments_history
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No one can delete payments"
ON public.payments_history
FOR DELETE
USING (false);