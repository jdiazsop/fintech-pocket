import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LegalDialogProps {
  trigger: ReactNode;
  type: "terms" | "privacy";
}

const TERMS_CONTENT = (
  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
    <p className="text-xs text-muted-foreground/70">Última actualización: Mayo 2026</p>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">1. Aceptación</h3>
      <p>Al registrarte y usar Credify, aceptas estos Términos y Condiciones. Si no estás de acuerdo, por favor no utilices la aplicación.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">2. Descripción del servicio</h3>
      <p>Credify es una herramienta digital personal para registrar préstamos, ventas al crédito, pagos y cronogramas. No somos una entidad financiera ni intermediamos préstamos entre terceros.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">3. Responsabilidad del usuario</h3>
      <p>Eres responsable de la veracidad de la información que registres, del cumplimiento de las leyes locales aplicables y de mantener la confidencialidad de tu cuenta.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">4. Uso permitido</h3>
      <p>Credify es para uso personal y de gestión propia. Está prohibido utilizar la plataforma para actividades ilegales, fraudulentas o que vulneren derechos de terceros.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">5. Limitación de responsabilidad</h3>
      <p>Credify se ofrece "tal como está". No garantizamos disponibilidad ininterrumpida ni nos responsabilizamos por pérdidas derivadas del uso o de decisiones financieras tomadas con base en la información registrada.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">6. Modificaciones</h3>
      <p>Podemos actualizar estos términos en cualquier momento. Te notificaremos sobre cambios relevantes a través de la aplicación.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">7. Contacto</h3>
      <p>Para consultas sobre estos términos, escríbenos a soporte@credify.app.</p>
    </section>
  </div>
);

const PRIVACY_CONTENT = (
  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
    <p className="text-xs text-muted-foreground/70">Última actualización: Mayo 2026</p>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">1. Información que recopilamos</h3>
      <p>Recopilamos los datos que tú ingresas (correo, contraseña cifrada, información de contactos, operaciones, pagos) y datos técnicos básicos para el correcto funcionamiento del servicio.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">2. Uso de la información</h3>
      <p>Usamos tus datos exclusivamente para prestarte el servicio, mejorar la experiencia y mantener la seguridad de tu cuenta. No vendemos ni compartimos tu información con terceros con fines comerciales.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">3. Almacenamiento y seguridad</h3>
      <p>Tu información se almacena cifrada en infraestructura segura. Aplicamos políticas de aislamiento por usuario para que solo tú puedas acceder a tus datos.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">4. Tus derechos</h3>
      <p>Puedes acceder, modificar o solicitar la eliminación de tus datos en cualquier momento desde tu perfil o escribiéndonos a soporte@credify.app.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">5. Cookies y datos técnicos</h3>
      <p>Utilizamos almacenamiento local para mantener tu sesión y preferencias. No usamos cookies de seguimiento publicitario.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">6. Cambios a esta política</h3>
      <p>Podemos actualizar esta política. Las versiones futuras estarán siempre disponibles dentro de la app.</p>
    </section>

    <section>
      <h3 className="text-foreground font-semibold mb-1.5">7. Contacto</h3>
      <p>Para consultas sobre privacidad, escríbenos a soporte@credify.app.</p>
    </section>
  </div>
);

export function LegalDialog({ trigger, type }: LegalDialogProps) {
  const title = type === "terms" ? "Términos y Condiciones" : "Política de Privacidad";
  const content = type === "terms" ? TERMS_CONTENT : PRIVACY_CONTENT;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="font-display text-lg tracking-tight">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">{content}</ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
