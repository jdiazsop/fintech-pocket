-- Trigger-only functions: no API caller should invoke these
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_clients_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- Admin-only RPCs: keep callable by authenticated (gated by has_role inside), block anon
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_clients() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_operations() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_payments() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_metrics() FROM anon, PUBLIC;

-- Auth-only RPCs: caller must be the loan owner (auth.uid() check inside)
REVOKE EXECUTE ON FUNCTION public.request_confirmation_otp(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_payment(uuid, numeric, text) FROM anon, PUBLIC;

-- has_role: only needed by RLS evaluation and authenticated callers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;