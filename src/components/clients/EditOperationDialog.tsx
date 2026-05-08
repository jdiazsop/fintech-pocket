import { useEffect, useState } from "react";
import { Loader2, FileEdit, MessageCircle } from "lucide-react";
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

interface OperationFields {
  concept: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loanId: string;
  clientName: string;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  initial: OperationFields;
  onSaved?: () => void;
}

export function EditOperationDialog({
  open,
  onOpenChange,
  loanId,
  clientName,
  phoneCountryCode,
  phoneNumber,
  initial,
  onSaved,
}: Props) {
  const [concept, setConcept] = useState(initial.concept || "");
  const [saving, setSaving] = useState(false);
  const [showNotify, setShowNotify] = useState(false);

  useEffect(() => {
    if (open) {
      setConcept(initial.concept || "");
      setShowNotify(false);
    }
  }, [open, initial]);

  const fullPhone = `${(phoneCountryCode || "").replace(/\D/g, "")}${(phoneNumber || "").replace(/\D/g, "")}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("loans")
        .update({ concept: concept.trim() || null })
        .eq("id", loanId);
      if (error) throw error;
      toast.success("Operación actualizada");
      onSaved?.();
      setShowNotify(true);
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo actualizar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleNotify = () => {
    if (!fullPhone) {
      toast.error("Este cliente no tiene teléfono registrado");
      return;
    }
    const msg = `Hola ${clientName}, te informo que actualicé los detalles de nuestra operación. Por favor revisa los nuevos datos cuando puedas. Gracias.`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-primary" />
            {showNotify ? "¿Notificar al cliente?" : "Modificar operación"}
          </DialogTitle>
          <DialogDescription>
            {showNotify
              ? "Los detalles de esta operación fueron actualizados. ¿Deseas avisarle al cliente vía WhatsApp?"
              : "Edita la descripción de esta operación. Los montos, cuotas y cronograma no se modifican aquí."}
          </DialogDescription>
        </DialogHeader>

        {!showNotify ? (
          <>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="op-concept">Concepto / Descripción</Label>
                <Textarea
                  id="op-concept"
                  rows={3}
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="bg-muted/50 resize-none"
                  placeholder="Ej: Préstamo para emergencia"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Para cambiar montos, cuotas o frecuencia, deberás eliminar la operación y crear una nueva. Esto preserva la integridad del cronograma e historial.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cambios"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Ahora no
            </Button>
            <Button
              onClick={handleNotify}
              disabled={!fullPhone}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Notificar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
