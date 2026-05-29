
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name_paternal text,
  ADD COLUMN IF NOT EXISTS last_name_maternal text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, email, accepted_terms,
    first_name, last_name_paternal, last_name_maternal,
    phone_country_code, phone_number
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'accepted_terms')::boolean, false),
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name_paternal', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name_maternal', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone_country_code', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone_number', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name_paternal = COALESCE(EXCLUDED.last_name_paternal, public.profiles.last_name_paternal),
    last_name_maternal = COALESCE(EXCLUDED.last_name_maternal, public.profiles.last_name_maternal),
    phone_country_code = COALESCE(EXCLUDED.phone_country_code, public.profiles.phone_country_code),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number);
  RETURN NEW;
END;
$function$;
