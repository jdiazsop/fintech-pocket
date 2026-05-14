// Supabase "Send Email" Auth Hook → envía TODOS los correos de autenticación
// (recuperación, verificación, magic link, invitación, cambio de email)
// vía Resend desde noreply@credify.pe.
//
// Configuración necesaria en Supabase → Authentication → Hooks → Send Email Hook:
//   • Habilitar el hook
//   • URL: https://vzmpxqnmwqvbxjyqazww.supabase.co/functions/v1/auth-email-hook
//   • Copiar el "Webhook secret" generado y guardarlo como SEND_EMAIL_HOOK_SECRET
//
// La verificación del payload se hace con Standard Webhooks (HMAC SHA-256).

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET'); // formato: v1,whsec_...
const FROM = 'Credify <noreply@credify.pe>';
const SITE_URL = 'https://app.credify.pe';

interface AuthEmailPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | 'signup'
      | 'recovery'
      | 'invite'
      | 'magiclink'
      | 'email_change'
      | 'email_change_current'
      | 'email_change_new'
      | 'reauthentication';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const escape = (s: string) => s.replace(/[<>]/g, '');

function buildActionLink(p: AuthEmailPayload['email_data']): string {
  const base = (p.site_url || SITE_URL).replace(/\/$/, '');
  const redirect = p.redirect_to || `${SITE_URL}/dashboard`;
  // Para recovery, conviene apuntar a /reset-password
  const redirectFinal =
    p.email_action_type === 'recovery'
      ? `${SITE_URL}/reset-password`
      : redirect;
  const params = new URLSearchParams({
    token: p.token_hash,
    type: p.email_action_type,
    redirect_to: redirectFinal,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

function template(opts: {
  title: string;
  intro: string;
  cta: string;
  url: string;
  footer?: string;
  token?: string;
}) {
  const tokenBlock = opts.token
    ? `<p style="margin:0 0 8px;color:#94A3B8;font-size:12px">O usa este código:</p>
       <div style="font-family:monospace;font-size:22px;letter-spacing:6px;background:#0F172A;border:1px solid #334155;border-radius:10px;padding:14px;text-align:center;color:#F1F5F9;margin:0 0 16px">${opts.token}</div>`
    : '';
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0F172A;margin:0;padding:24px;color:#F1F5F9">
<div style="max-width:520px;margin:0 auto;background:#1E293B;border-radius:16px;padding:28px;border:1px solid #334155">
  <h1 style="margin:0 0 4px;font-size:18px;color:#3B82F6">Credify</h1>
  <p style="margin:0 0 18px;color:#94A3B8;font-size:13px">${escape(opts.title)}</p>
  <p style="margin:0 0 16px;line-height:1.5">${opts.intro}</p>
  <a href="${opts.url}" style="display:block;text-align:center;background:#3B82F6;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:600;margin:0 0 18px">${escape(opts.cta)}</a>
  ${tokenBlock}
  <p style="margin:0;color:#64748B;font-size:11px;line-height:1.5">${opts.footer || 'Si no solicitaste este correo, puedes ignorarlo con seguridad.'}</p>
</div>
<p style="text-align:center;color:#475569;font-size:11px;margin:14px 0 0">Credify — app.credify.pe</p>
</body></html>`;
}

function buildEmail(p: AuthEmailPayload): { subject: string; html: string } {
  const url = buildActionLink(p.email_data);
  const t = p.email_data.token;
  switch (p.email_data.email_action_type) {
    case 'signup':
      return {
        subject: 'Confirma tu cuenta de Credify',
        html: template({
          title: 'Verificación de cuenta',
          intro: 'Bienvenido a Credify. Para activar tu cuenta confirma tu correo electrónico:',
          cta: 'Confirmar mi cuenta',
          url,
          token: t,
        }),
      };
    case 'recovery':
      return {
        subject: 'Restablece tu contraseña de Credify',
        html: template({
          title: 'Recuperación de contraseña',
          intro: 'Recibimos una solicitud para restablecer tu contraseña. El enlace expira en 1 hora.',
          cta: 'Crear nueva contraseña',
          url,
          token: t,
          footer: 'Si no solicitaste cambiar tu contraseña, ignora este correo y tu cuenta seguirá segura.',
        }),
      };
    case 'magiclink':
      return {
        subject: 'Tu enlace de acceso a Credify',
        html: template({
          title: 'Inicio de sesión sin contraseña',
          intro: 'Haz clic en el botón para acceder a tu cuenta. El enlace caduca pronto.',
          cta: 'Iniciar sesión',
          url,
          token: t,
        }),
      };
    case 'invite':
      return {
        subject: 'Te invitaron a Credify',
        html: template({
          title: 'Invitación a Credify',
          intro: 'Has sido invitado a unirte a Credify. Acepta la invitación para activar tu cuenta.',
          cta: 'Aceptar invitación',
          url,
          token: t,
        }),
      };
    case 'email_change':
    case 'email_change_current':
    case 'email_change_new':
      return {
        subject: 'Confirma el cambio de correo',
        html: template({
          title: 'Cambio de correo electrónico',
          intro: 'Confirma este correo para finalizar el cambio en tu cuenta de Credify.',
          cta: 'Confirmar cambio',
          url,
          token: t,
        }),
      };
    case 'reauthentication':
      return {
        subject: 'Código de verificación de Credify',
        html: template({
          title: 'Reautenticación',
          intro: 'Usa el siguiente código para confirmar la operación:',
          cta: 'Abrir Credify',
          url: SITE_URL,
          token: t,
        }),
      };
    default:
      return {
        subject: 'Notificación de Credify',
        html: template({ title: 'Credify', intro: 'Tienes una nueva acción pendiente.', cta: 'Abrir Credify', url, token: t }),
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado');
    if (!HOOK_SECRET) throw new Error('SEND_EMAIL_HOOK_SECRET no configurado');

    const raw = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

    const wh = new Webhook(HOOK_SECRET.replace(/^v1,whsec_/, '').startsWith('whsec_') ? HOOK_SECRET : HOOK_SECRET);
    const payload = wh.verify(raw, headers) as AuthEmailPayload;

    if (!payload?.user?.email) {
      return new Response(JSON.stringify({ error: 'payload inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, html } = buildEmail(payload);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to: [payload.user.email], subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error', data);
      return new Response(JSON.stringify({ error: data?.message || 'fallo al enviar' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('auth-email-hook error', e);
    return new Response(JSON.stringify({ error: (e as Error).message || 'error' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
