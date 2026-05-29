import { useEffect, useState } from "react";
import {
  Users, UserCheck, UserSquare, Briefcase, HandCoins, ShoppingCart, Wallet,
  MailQuestion, CheckCircle2, XCircle, Send, AlertTriangle, Banknote, Hourglass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/loanUtils";
import { MetricCard } from "./components/MetricCard";

export default function AdminDashboard() {
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    supabase.rpc("admin_get_metrics" as any).then(({ data }) => setM(data));
  }, []);

  const groups: { title: string; items: { label: string; value: any; icon: any }[] }[] = [
    {
      title: "Usuarios",
      items: [
        { label: "Usuarios registrados", value: m?.users ?? "—", icon: Users },
        { label: "Usuarios activos", value: m?.active_users ?? "—", icon: UserCheck },
        { label: "Clientes creados", value: m?.clients ?? "—", icon: UserSquare },
      ],
    },
    {
      title: "Operaciones",
      items: [
        { label: "Operaciones", value: m?.operations ?? "—", icon: Briefcase },
        { label: "Préstamos", value: m?.loans ?? "—", icon: HandCoins },
        { label: "Ventas al crédito", value: m?.sales ?? "—", icon: ShoppingCart },
        { label: "Operaciones vencidas", value: m?.overdue_loans ?? "—", icon: AlertTriangle },
      ],
    },
    {
      title: "Dinero",
      items: [
        { label: "Monto total prestado", value: m ? formatCurrency(Number(m.total_lent)) : "—", icon: Banknote },
        { label: "Monto a devolver", value: m ? formatCurrency(Number(m.total_to_return)) : "—", icon: Banknote },
        { label: "Monto devuelto", value: m ? formatCurrency(Number(m.total_returned)) : "—", icon: Wallet },
        { label: "Monto pendiente", value: m ? formatCurrency(Number(m.total_pending)) : "—", icon: Hourglass },
        { label: "Pagos registrados", value: m?.payments ?? "—", icon: Wallet },
      ],
    },
    {
      title: "Consentimiento",
      items: [
        { label: "Acuerdos enviados", value: m?.agreements_sent ?? "—", icon: Send },
        { label: "Pend. confirmación", value: m?.pending_confirm ?? "—", icon: MailQuestion },
        { label: "Aceptadas", value: m?.confirmed ?? "—", icon: CheckCircle2 },
        { label: "Rechazadas", value: m?.rejected ?? "—", icon: XCircle },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visión general del sistema</p>
      </div>
      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{g.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {g.items.map((it, i) => (
              <MetricCard key={it.label} label={it.label} value={it.value} icon={it.icon} delay={i * 0.02} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
