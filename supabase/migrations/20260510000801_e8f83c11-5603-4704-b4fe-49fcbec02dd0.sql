-- Unique partial indexes per user for DNI and phone (ignoring nulls/blanks)
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_dni_unique
  ON public.clients (user_id, btrim(dni))
  WHERE dni IS NOT NULL AND btrim(dni) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_phone_unique
  ON public.clients (user_id, btrim(phone_number))
  WHERE phone_number IS NOT NULL AND btrim(phone_number) <> '';