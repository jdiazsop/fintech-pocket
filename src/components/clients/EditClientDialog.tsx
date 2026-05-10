import { useEffect, useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientFields {
  name: string;
  first_name: string | null;
  last_name: string | null;
  dni: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  address: string | null;
  reference: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loanIds: string[];
  /** Optional client row id (clients table). If provided, that row is also updated. */
  clientId?: string | null;
  initial: ClientFields;
  onSaved?: () => void;
}

export function EditClientDialog({ open, onOpenChange, loanIds, clientId, initial, onSaved }: Props) {
  const [form, setForm] = useState<ClientFields>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const update = (k: keyof ClientFields, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (loanIds.length === 0 && !clientId) {
      toast.error("No se encontró el cliente para actualizar");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        dni: form.dni?.trim() || null,
        phone_country_code: form.phone_country_code?.trim() || null,
        phone_number: form.phone_number?.trim() || null,
        address: form.address?.trim() || null,
        reference: form.reference?.trim() || null,
      };

      // Update all linked loans (preserves existing behavior)
      if (loanIds.length > 0) {
        const { error } = await supabase.from("loans").update(payload).in("id", loanIds);
        if (error) throw error;
      }

      // Sync the address-book entry. Match by clientId, else by DNI/phone for this user.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const clientPayload = {
            first_name: payload.first_name || payload.name,
            last_name: payload.last_name,
            dni: payload.dni,
            phone_country_code: payload.phone_country_code,
            phone_number: payload.phone_number,
            address: payload.address,
            reference: payload.reference,
          };
          if (clientId) {
            await supabase.from("clients").update(clientPayload).eq("id", clientId);
          } else {
            const { data: existing } = await supabase
              .from("clients")
              .select("id, dni, phone_number")
              .eq("user_id", user.id);
            const dniT = payload.dni;
            const phoneT = payload.phone_number;
            const match = (existing as any[] || []).find((c) =>
              (dniT && c.dni && c.dni.trim() === dniT) ||
              (phoneT && c.phone_number && c.phone_number.trim() === phoneT),
            );
            if (match) {
              await supabase.from("clients").update(clientPayload).eq("id", match.id);
            } else {
              await supabase.from("clients").insert({ user_id: user.id, ...clientPayload } as any);
            }
          }
        }
      } catch (e) {
        console.error("Client sync failed (non-blocking):", e);
      }

      toast.success("Datos del cliente actualizados", {
        description: loanIds.length > 0
          ? `Se actualizaron ${loanIds.length} operación(es) asociadas.`
          : "Contacto actualizado.",
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo actualizar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            Editar cliente
          </DialogTitle>
          <DialogDescription>
            Actualiza datos administrativos. Los cambios se aplican a todas sus operaciones y no requieren confirmación del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nombre mostrado *</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="bg-muted/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-first">Nombres</Label>
              <Input
                id="c-first"
                value={form.first_name || ""}
                onChange={(e) => update("first_name", e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-last">Apellidos</Label>
              <Input
                id="c-last"
                value={form.last_name || ""}
                onChange={(e) => update("last_name", e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-dni">DNI / Documento</Label>
            <Input
              id="c-dni"
              value={form.dni || ""}
              onChange={(e) => update("dni", e.target.value)}
              className="bg-muted/50"
            />
          </div>

          <div className="grid grid-cols-[90px_1fr] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-cc">Código</Label>
              <Input
                id="c-cc"
                placeholder="51"
                value={form.phone_country_code || ""}
                onChange={(e) => update("phone_country_code", e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Teléfono / WhatsApp</Label>
              <Input
                id="c-phone"
                inputMode="tel"
                value={form.phone_number || ""}
                onChange={(e) => update("phone_number", e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-address">Dirección</Label>
            <Input
              id="c-address"
              value={form.address || ""}
              onChange={(e) => update("address", e.target.value)}
              className="bg-muted/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-ref">Referencia</Label>
            <Textarea
              id="c-ref"
              rows={2}
              value={form.reference || ""}
              onChange={(e) => update("reference", e.target.value)}
              className="bg-muted/50 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
