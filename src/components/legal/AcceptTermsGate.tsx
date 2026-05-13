import { useState } from "react";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LegalDialog } from "@/components/legal/LegalDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  userId: string;
  email: string | null;
  onAccepted: () => void;
  onDecline: () => Promise<void> | void;
}

/**
 * Inline gate to capture Terms & Privacy acceptance for users that signed up
 * via OAuth (e.g. Google) where the checkbox was never shown.
 * Avoids the previous lockout/auto-signOut behavior.
 */
export function AcceptTermsGate({ open, userId, email, onAccepted, onDecline }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { toast } = useToast();

  const handleAccept = async () => {
    if (!accepted) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ accepted_terms: true })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({
        title: "No se pudo guardar",
        description: "Inténtalo nuevamente en unos segundos.",
        variant: "destructive",
      });
      return;
    }
    onAccepted();
  };

  const handleDecline = async () => {
    setSigningOut(true);
    try {
      await onDecline();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* required gate */ }}>
      <DialogContent
        className="bg-card border-border max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Un último paso</DialogTitle>
          <DialogDescription className="text-center">
            Para continuar usando Credify{email ? ` con ${email}` : ""}, necesitamos que aceptes nuestros términos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 py-2">
          <Checkbox
            id="gate-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="gate-terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
            Acepto los{" "}
            <LegalDialog
              type="terms"
              trigger={<button type="button" className="text-primary hover:underline font-medium">Términos y Condiciones</button>}
            />{" "}
            y la{" "}
            <LegalDialog
              type="privacy"
              trigger={<button type="button" className="text-primary hover:underline font-medium">Política de Privacidad</button>}
            />
            .
          </Label>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleAccept}
            disabled={!accepted || saving}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceptar y continuar"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDecline}
            disabled={signingOut}
            className="w-full text-muted-foreground"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><LogOut className="w-4 h-4 mr-2" />Salir</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
