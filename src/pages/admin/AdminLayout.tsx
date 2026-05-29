import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ShieldCheck, LayoutDashboard, Users, UserSquare, Briefcase, Wallet,
  FileSignature, Search, ArrowLeft, Menu, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/loanUtils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Usuarios", icon: Users },
  { to: "/admin/clients", label: "Clientes", icon: UserSquare },
  { to: "/admin/operations", label: "Operaciones", icon: Briefcase },
  { to: "/admin/payments", label: "Pagos", icon: Wallet },
  { to: "/admin/consents", label: "Consentimiento", icon: FileSignature },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await (supabase.rpc as any)("admin_global_search", { _q: q.trim() });
      setSearching(false);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setResults(data);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse w-12 h-12 rounded-2xl bg-primary/20" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const goto = (path: string) => { setQ(""); setResults(null); navigate(path); };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-card/40 flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/20"><ShieldCheck className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="font-bold leading-tight">Credify Admin</p>
            <p className="text-[10px] text-muted-foreground">Panel interno</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a la app
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/90 backdrop-blur" onClick={() => setNavOpen(false)}>
          <aside className="absolute top-0 left-0 bottom-0 w-64 bg-card border-r border-border p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold">Admin</p>
              <button onClick={() => setNavOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <nav className="space-y-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    onClick={() => setNavOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                        isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/70 backdrop-blur">
          <div className="px-4 py-3 flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2" onClick={() => setNavOpen(true)} aria-label="Abrir menú">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar email, nombre, DNI, celular o ID de operación..."
                className="pl-10 bg-background border-border"
              />
              {results && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl p-2 max-h-[60vh] overflow-y-auto z-40">
                  <SearchSection title="Usuarios" items={results.users} renderItem={(u: any) => (
                    <button key={u.user_id} onClick={() => goto(`/admin/users/${u.user_id}`)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 text-sm">
                      {u.email}
                    </button>
                  )} />
                  <SearchSection title="Clientes" items={results.clients} renderItem={(c: any) => (
                    <button key={c.id} onClick={() => goto(`/admin/clients/${c.id}`)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 text-sm">
                      <div>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.dni || c.phone || c.email || "—"}</div>
                    </button>
                  )} />
                  <SearchSection title="Operaciones" items={results.operations} renderItem={(o: any) => (
                    <button key={o.id} onClick={() => goto(`/admin/operations/${o.id}`)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 text-sm">
                      <div>{o.name}</div>
                      <div className="text-xs text-muted-foreground">{o.operation_type === "sale" ? "Venta" : "Préstamo"} · {formatCurrency(Number(o.amount_to_return))}</div>
                    </button>
                  )} />
                  {!results.users?.length && !results.clients?.length && !results.operations?.length && (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">Sin resultados</div>
                  )}
                </div>
              )}
            </div>
            {searching && <span className="text-xs text-muted-foreground">Buscando...</span>}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SearchSection({ title, items, renderItem }: { title: string; items: any[]; renderItem: (item: any) => any }) {
  if (!items?.length) return null;
  return (
    <div className="mb-2">
      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      {items.map(renderItem)}
    </div>
  );
}
