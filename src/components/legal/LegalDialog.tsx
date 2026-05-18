import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LegalDialogProps {
  trigger: ReactNode;
  type: "terms" | "privacy";
}

const LAST_UPDATED = "Mayo 2026";
const CONTACT_EMAIL = "hola@credify.pe";

interface Section {
  title: string;
  body: ReactNode;
}

const TERMS_SECTIONS: Section[] = [
  {
    title: "1. Aceptación de los términos",
    body: (
      <p>
        Al crear una cuenta o utilizar Credify, declaras haber leído, entendido y aceptado
        estos Términos y Condiciones, así como nuestra Política de Privacidad. Si no estás
        de acuerdo con alguno de los puntos descritos, te pedimos no continuar con el uso de
        la plataforma.
      </p>
    ),
  },
  {
    title: "2. Descripción del servicio",
    body: (
      <p>
        Credify es una herramienta digital personal de gestión que permite registrar
        préstamos, ventas al crédito, pagos, cronogramas y acuerdos entre el usuario y sus
        propios contactos. <strong className="text-foreground">Credify no es una entidad
        financiera</strong>, no otorga créditos, no intermedia operaciones entre terceros y
        no realiza cobranzas en nombre del usuario.
      </p>
    ),
  },
  {
    title: "3. Uso permitido de la plataforma",
    body: (
      <>
        <p>El usuario se compromete a utilizar Credify únicamente para fines lícitos, personales y de gestión propia. Está prohibido:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Usar la plataforma para actividades fraudulentas o ilegales.</li>
          <li>Registrar información falsa o suplantar la identidad de terceros.</li>
          <li>Realizar prácticas de cobranza abusivas o que vulneren derechos.</li>
          <li>Intentar vulnerar la seguridad, integridad o disponibilidad del servicio.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Responsabilidades del usuario",
    body: (
      <p>
        Eres responsable de la veracidad, exactitud y actualización de la información que
        registres, del adecuado tratamiento de los datos de tus contactos, del cumplimiento
        de la normativa aplicable en tu jurisdicción y de mantener la confidencialidad de
        tus credenciales de acceso.
      </p>
    ),
  },
  {
    title: "5. Consentimiento digital",
    body: (
      <p>
        Aceptas que los registros, acuerdos, validaciones por código (OTP) y comunicaciones
        electrónicas generados dentro de Credify tienen validez como manifestación de
        voluntad digital, conforme a la normativa vigente sobre firmas y consentimiento
        electrónico.
      </p>
    ),
  },
  {
    title: "6. Comunicaciones electrónicas",
    body: (
      <p>
        Al usar Credify autorizas el envío de notificaciones operativas, de seguridad,
        recordatorios y reportes relacionados con tus operaciones, a través de correo
        electrónico, WhatsApp u otros canales disponibles dentro del producto.
      </p>
    ),
  },
  {
    title: "7. Seguridad y validaciones",
    body: (
      <p>
        Aplicamos medidas razonables de seguridad, incluyendo cifrado, aislamiento de datos
        por usuario y validaciones de identidad mediante códigos de un solo uso. Aun así,
        ningún sistema es infalible: el usuario debe proteger su dispositivo, contraseña y
        códigos de acceso.
      </p>
    ),
  },
  {
    title: "8. Limitación de responsabilidad",
    body: (
      <p>
        Credify se ofrece <em>"tal como está"</em>. No garantizamos disponibilidad
        ininterrumpida del servicio y no nos hacemos responsables por pérdidas, daños o
        decisiones financieras derivadas del uso de la plataforma, de la información
        registrada por el usuario o de acuerdos entre el usuario y sus contactos.
      </p>
    ),
  },
  {
    title: "9. Modificaciones",
    body: (
      <p>
        Podemos actualizar estos términos para reflejar mejoras del producto o cambios
        normativos. Te notificaremos sobre cambios relevantes dentro de la aplicación o por
        correo electrónico. El uso continuado del servicio implica la aceptación de la
        versión vigente.
      </p>
    ),
  },
  {
    title: "10. Terminación de cuenta",
    body: (
      <p>
        Puedes cerrar tu cuenta en cualquier momento desde tu perfil o escribiéndonos.
        Credify podrá suspender o cancelar cuentas que incumplan estos términos o que
        afecten la integridad del servicio.
      </p>
    ),
  },
  {
    title: "11. Contacto y soporte",
    body: (
      <p>
        Para consultas, soporte o reclamos relacionados con estos términos, escríbenos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ),
  },
];

const PRIVACY_SECTIONS: Section[] = [
  {
    title: "1. Información que recopilamos",
    body: (
      <>
        <p>Para brindarte el servicio recopilamos:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Datos de cuenta: correo, contraseña cifrada y nombre.</li>
          <li>Datos operativos: contactos, operaciones, pagos y cronogramas que tú registras.</li>
          <li>Datos técnicos: dispositivo, navegador, sesión y registros de seguridad.</li>
        </ul>
      </>
    ),
  },
  {
    title: "2. Uso de la información",
    body: (
      <p>
        Usamos tus datos exclusivamente para operar la plataforma, mejorar la experiencia,
        emitir notificaciones, generar reportes, validar identidad y mantener la seguridad
        de tu cuenta. <strong className="text-foreground">No vendemos ni cedemos tu
        información con fines publicitarios</strong>.
      </p>
    ),
  },
  {
    title: "3. Tratamiento de datos de contactos",
    body: (
      <p>
        Los datos de contactos que registres (nombre, teléfono, correo) se utilizan
        únicamente para que tú puedas gestionar tus operaciones, enviar acuerdos y
        recordatorios. Eres responsable de contar con el consentimiento de tus contactos
        para almacenar y utilizar dicha información.
      </p>
    ),
  },
  {
    title: "4. Almacenamiento y seguridad",
    body: (
      <p>
        Tu información se almacena cifrada en infraestructura segura en la nube. Aplicamos
        políticas estrictas de aislamiento por usuario (Row Level Security) para que solo
        tú puedas acceder a tus datos. Mantenemos respaldos periódicos y monitoreo de
        seguridad continuo.
      </p>
    ),
  },
  {
    title: "5. Consentimiento digital",
    body: (
      <p>
        Al registrarte aceptas el tratamiento de tus datos conforme a esta política. Tu
        consentimiento puede ser revocado en cualquier momento solicitando la eliminación
        de tu cuenta.
      </p>
    ),
  },
  {
    title: "6. Comunicaciones electrónicas",
    body: (
      <p>
        Podremos enviarte correos transaccionales (validaciones, recordatorios, reportes,
        cambios de seguridad). Las comunicaciones promocionales, en caso de existir, podrán
        ser desactivadas desde tu perfil.
      </p>
    ),
  },
  {
    title: "7. Tus derechos",
    body: (
      <>
        <p>En todo momento puedes:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Acceder a tu información.</li>
          <li>Rectificar datos incorrectos o desactualizados.</li>
          <li>Solicitar la eliminación de tu cuenta y datos asociados.</li>
          <li>Oponerte a tratamientos no esenciales.</li>
        </ul>
        <p className="mt-2">
          Para ejercer estos derechos escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "8. Conservación de datos",
    body: (
      <p>
        Conservamos tu información mientras tu cuenta esté activa. Al solicitar la
        eliminación, removemos tus datos personales del sistema, salvo aquellos que
        debamos conservar por obligaciones legales o de seguridad.
      </p>
    ),
  },
  {
    title: "9. Cookies y datos técnicos",
    body: (
      <p>
        Usamos almacenamiento local únicamente para mantener tu sesión y preferencias.
        No utilizamos cookies de seguimiento publicitario ni compartimos datos con
        terceros con fines de perfilamiento.
      </p>
    ),
  },
  {
    title: "10. Cambios en esta política",
    body: (
      <p>
        Podemos actualizar esta política para reflejar mejoras o cambios normativos.
        Las versiones futuras estarán siempre disponibles dentro de la aplicación.
      </p>
    ),
  },
  {
    title: "11. Contacto",
    body: (
      <p>
        Para cualquier consulta sobre privacidad o tratamiento de datos, escríbenos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ),
  },
];

export function LegalDialog({ trigger, type }: LegalDialogProps) {
  const isTerms = type === "terms";
  const title = isTerms ? "Términos y Condiciones" : "Política de Privacidad";
  const subtitle = isTerms
    ? "Condiciones de uso de Credify"
    : "Cómo tratamos y protegemos tu información";
  const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Sticky header */}
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-4 border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-10 space-y-1 text-left">
          <DialogTitle className="font-display text-lg sm:text-xl tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <p className="text-[11px] text-muted-foreground/70 pt-0.5">
            Última actualización: {LAST_UPDATED}
          </p>
        </DialogHeader>

        {/* Scrollable content — native scroll for reliability inside Dialog */}
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-dark px-5 sm:px-6 py-5">
          <div className="space-y-5 text-[13.5px] leading-relaxed text-muted-foreground">
            {sections.map((s) => (
              <section key={s.title} className="space-y-1.5">
                <h3 className="text-foreground font-semibold text-sm">{s.title}</h3>
                <div className="space-y-2">{s.body}</div>
              </section>
            ))}

            {/* Closure block */}
            <div className="mt-6 pt-5 border-t border-border/70">
              <div className="rounded-xl bg-primary-soft/60 border border-primary/15 px-4 py-3.5">
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Gracias por confiar en <strong className="text-primary">Credify</strong>.
                  Trabajamos para ofrecerte una experiencia clara, segura y profesional.
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  ¿Dudas? Escríbenos a{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </p>
              </div>
              <p className="text-center text-[10px] text-muted-foreground/60 mt-4 uppercase tracking-wider">
                Fin del documento
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
