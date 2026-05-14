import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Users, UserSquare, Briefcase, HandCoins, ShoppingCart, Wallet, MailQuestion, CheckCircle2, XCircle, Search, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/loanUtils";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type Tab = "users" | "clients" | "operations" | "payments";

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "Usuarios" },
  { key: "clients", label: "Clientes" },
  { key: "operations", label: "Operaciones" },
  { key: "payments", label: "Pagos" },
];

export default function Admin() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [rows, setRows] = useState<any[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc("admin_get_metrics").then(({ data, error }) => {
      if (!error) setMetrics(data);
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingRows(true);
    setSearch("");
    const fn =
      tab === "users" ? "admin_list_users" :
      tab === "clients" ? "admin_list_clients" :
      tab === "operations" ? "admin_list_operations" :
      "admin_list_payments";
    supabase.rpc(fn as any).then(({ data, error }) => {
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      setRows((data as any[]) || []);
      setLoadingRows(false);
    });
  }, [tab, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, search]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse w-12 h-12 rounded-2xl bg-primary/20" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="fintech-card max-w-md w-full p-6 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acceso restringido</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta no tiene permisos de administrador. Comparte tu ID con un administrador para solicitar acceso.
          </p>
          <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-2 justify-between">
            <code className="text-xs truncate">{user.id}</code>
            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(user.id); toast({ title: "ID copiado" }); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: "Usuarios", value: metrics?.users ?? "—", icon: Users },
    { label: "Clientes", value: metrics?.clients ?? "—", icon: UserSquare },
    { label: "Operaciones", value: metrics?.operations ?? "—", icon: Briefcase },
    { label: "Préstamos", value: metrics?.loans ?? "—", icon: HandCoins },
    { label: "Ventas crédito", value: metrics?.sales ?? "—", icon: ShoppingCart },
    { label: "Pagos", value: metrics?.payments ?? "—", icon: Wallet },
    { label: "Pend. confirmación", value: metrics?.pending_confirm ?? "—", icon: MailQuestion },
    { label: "Aceptadas", value: metrics?.confirmed ?? "—", icon: CheckCircle2 },
    { label: "Rechazadas", value: metrics?.rejected ?? "—", icon: XCircle },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Panel admin</h1>
            <p className="text-xs text-muted-foreground">Credify · monitoreo interno</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Metrics */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {metricCards.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="fintech-card p-4"
              >
                <Icon className="w-4 h-4 text-primary mb-2" />
                <div className="text-2xl font-bold tabular-nums">{m.value}</div>
                <div className="text-[11px] text-muted-foreground">{m.label}</div>
              </motion.div>
            );
          })}
        </section>

        {/* Tabs */}
        <section className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>

          <div className="fintech-card overflow-x-auto">
            {loadingRows ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Sin registros</div>
            ) : (
              <DataTable tab={tab} rows={filtered} />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} de {rows.length} registros
          </p>
        </section>
      </main>
    </div>
  );
}

function DataTable({ tab, rows }: { tab: Tab; rows: any[] }) {
  const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd/MM/yy HH:mm") : "—");

  if (tab === "users") {
    return (
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border">
          <tr><Th>Email</Th><Th>Términos</Th><Th>Clientes</Th><Th>Operaciones</Th><Th>Registrado</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className="border-b border-border/50">
              <Td>{r.email}</Td>
              <Td>{r.accepted_terms ? "Sí" : "No"}</Td>
              <Td>{r.clients_count}</Td>
              <Td>{r.loans_count}</Td>
              <Td>{fmtDate(r.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (tab === "clients") {
    return (
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border">
          <tr><Th>Nombre</Th><Th>DNI</Th><Th>Teléfono</Th><Th>Email</Th><Th>Owner</Th><Th>Creado</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <Td>{[r.first_name, r.last_name].filter(Boolean).join(" ")}</Td>
              <Td>{r.dni || "—"}</Td>
              <Td>{r.phone || "—"}</Td>
              <Td>{r.email || "—"}</Td>
              <Td>{r.owner_email || "—"}</Td>
              <Td>{fmtDate(r.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (tab === "operations") {
    return (
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border">
          <tr><Th>Cliente</Th><Th>Tipo</Th><Th>Prestado</Th><Th>A devolver</Th><Th>Devuelto</Th><Th>Estado</Th><Th>Confirm.</Th><Th>Owner</Th><Th>Creada</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <Td>{r.name}</Td>
              <Td>{r.operation_type === "sale" ? "Venta" : "Préstamo"}</Td>
              <Td>{formatCurrency(Number(r.amount_lent))}</Td>
              <Td>{formatCurrency(Number(r.amount_to_return))}</Td>
              <Td>{formatCurrency(Number(r.amount_returned))}</Td>
              <Td>{r.status}</Td>
              <Td>{r.confirmation_status}</Td>
              <Td>{r.owner_email || "—"}</Td>
              <Td>{fmtDate(r.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground border-b border-border">
        <tr><Th>Operación</Th><Th>Owner</Th><Th>Monto</Th><Th>Fecha pago</Th><Th>Notas</Th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-border/50">
            <Td>{r.loan_name || r.loan_id}</Td>
            <Td>{r.owner_email || "—"}</Td>
            <Td>{formatCurrency(Number(r.amount_paid))}</Td>
            <Td>{fmtDate(r.payment_date)}</Td>
            <Td className="max-w-[240px] truncate">{r.notes || "—"}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{children}</th>
);
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 whitespace-nowrap ${className}`}>{children}</td>
);
