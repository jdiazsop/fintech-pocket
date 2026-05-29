// Sends a 6-digit OTP to the client's registered email so they can
// validate identity before accepting/rejecting an agreement.
// Public endpoint — token-protected (no auth header required).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM = 'Credify <noreply@credify.pe>';

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const maskEmail = (email: string) => {
  const at = email.indexOf('@');
  if (at < 2) return email;
  return email[0] + '***' + email.slice(at);
};

const escHtml = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    if (!token || !isUuid(token)) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: loan, error: loanErr } = await admin
      .from('loans')
      .select('id, name, email, confirmation_status, confirmation_token_expires_at')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (loanErr || !loan) {
      return new Response(JSON.stringify({ error: 'Operación no encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (loan.confirmation_token_expires_at && new Date(loan.confirmation_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'El enlace ha expirado' }), {
        status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (loan.confirmation_status === 'confirmed' || loan.confirmation_status === 'rejected') {
      return new Response(JSON.stringify({ error: 'Esta operación ya fue respondida' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!loan.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(loan.email)) {
      return new Response(JSON.stringify({ error: 'Esta operación no tiene un correo registrado para validación' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate 6-digit OTP
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    const hash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    const { error: updErr } = await admin
      .from('loans')
      .update({
        otp_hash: hash,
        otp_expires_at: expiresAt,
        otp_attempts: 0,
        otp_verified_at: null,
        otp_phone_validated: null,
      })
      .eq('id', loan.id);

    if (updErr) {
      console.error('OTP update error:', updErr);
      return new Response(JSON.stringify({ error: 'No se pudo generar el código' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (loan.name || '').split(' ')[0] || '';
    const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0F172A;margin:0;padding:24px;color:#F1F5F9">
<div style="max-width:520px;margin:0 auto;background:#1E293B;border-radius:16px;padding:28px;border:1px solid #334155">
  <h1 style="margin:0 0 4px;font-size:18px;color:#3B82F6">Credify</h1>
  <p style="margin:0 0 18px;color:#94A3B8;font-size:13px">Código de validación de identidad</p>
  <p style="margin:0 0 12px">Hola <strong>${firstName}</strong>,</p>
  <p style="margin:0 0 16px">Usa el siguiente código para validar tu identidad y poder aceptar o rechazar el acuerdo:</p>
  <div style="text-align:center;background:#0F172A;border:1px solid #334155;border-radius:12px;padding:18px;margin:0 0 16px">
    <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:10px;color:#3B82F6;font-family:'Courier New',monospace">${code}</p>
  </div>
  <p style="margin:0 0 12px;font-size:12px;color:#CBD5E1">Este código vence en <strong>15 minutos</strong> y solo puede usarse en esta operación.</p>
  <p style="margin:0;color:#64748B;font-size:11px;line-height:1.5">Si no solicitaste este código, ignora este correo. Nadie de Credify te pedirá nunca este código por WhatsApp, llamada o mensaje.</p>
</div>
<p style="text-align:center;color:#475569;font-size:11px;margin:14px 0 0">Enviado por Credify — app.credify.pe</p>
</body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [loan.email],
        subject: `Tu código de validación Credify: ${code}`,
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: (data as any)?.message || 'No se pudo enviar el correo' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, email_masked: maskEmail(loan.email) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-confirmation-otp error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
