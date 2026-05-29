
REVOKE EXECUTE ON FUNCTION public.admin_get_metrics() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_clients() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_operations() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_payments() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_consents() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_get_client_detail(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_get_operation_detail(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_global_search(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_get_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_operations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_consents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_client_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_operation_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_global_search(text) TO authenticated;
