// Sends the digital consent email with the operation summary and a secure link.
// The recipient must validate their registered DNI/CE on the confirmation page.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = 'Credify <noreply@credify.pe>';

interface Body {
  to: string;
  clientName: string;
  operationType: 'loan' | 'sale';
  amount: number;
  numInstallments: number;
  installmentAmount: number;
  startDate: string;
  endDate: string;
  paymentType: 'single' | 'installments';
  confirmUrl: string;
  senderName?: string | null;
}

const fmtPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n);

const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
    const body = (await req.json()) as Body;

    if (!body?.to || !isEmail(body.to)) {
      return new Response(JSON.stringify({ error: 'Correo inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!body.confirmUrl?.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Enlace inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tipo = body.operationType === 'sale' ? 'Venta al crédito' : 'Préstamo';
    const sender = (body.senderName || 'Credify').replace(/[<>]/g, '');
    const planLine = body.paymentType === 'installments'
      ? `${body.numInstallments} cuotas de ${fmtPEN(body.installmentAmount)}`
      : `Pago único de ${fmtPEN(body.amount)}`;

    const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0F172A;margin:0;padding:24px;color:#F1F5F9">
<div style="max-width:560px;margin:0 auto;background:#1E293B;border-radius:16px;padding:28px;border:1px solid #334155">
  <h1 style="margin:0 0 4px;font-size:18px;color:#3B82F6">Credify</h1>
  <p style="margin:0 0 20px;color:#94A3B8;font-size:13px">Acuerdo digital pendiente de tu confirmación</p>

  <p style="margin:0 0 12px">Hola <strong>${(body.clientName || '').split(' ')[0] || ''}</strong>,</p>
  <p style="margin:0 0 16px">${sender} te comparte el siguiente acuerdo de <strong>${tipo}</strong> para tu revisión y confirmación:</p>

  <table style="width:100%;border-collapse:collapse;background:#0F172A;border-radius:12px;overflow:hidden;margin:0 0 20px">
    <tbody>
      <tr><td style="padding:10px 14px;color:#94A3B8;font-size:12px">Monto total</td><td style="padding:10px 14px;text-align:right;font-weight:700">${fmtPEN(body.amount)}</td></tr>
      <tr><td style="padding:10px 14px;color:#94A3B8;font-size:12px;border-top:1px solid #1E293B">Modalidad</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #1E293B">${planLine}</td></tr>
      <tr><td style="padding:10px 14px;color:#94A3B8;font-size:12px;border-top:1px solid #1E293B">Inicio</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #1E293B">${fmtDate(body.startDate)}</td></tr>
      <tr><td style="padding:10px 14px;color:#94A3B8;font-size:12px;border-top:1px solid #1E293B">Vencimiento final</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #1E293B">${fmtDate(body.endDate)}</td></tr>
    </tbody>
  </table>

  <a href="${body.confirmUrl}" style="display:block;text-align:center;background:#3B82F6;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:600;margin:0 0 14px">Revisar y confirmar acuerdo</a>

  <div style="background:#0F172A;border:1px solid #334155;border-radius:10px;padding:12px;margin:0 0 16px">
    <p style="margin:0;font-size:12px;color:#CBD5E1"><strong>🔒 Verificación requerida.</strong> Para aceptar o rechazar deberás ingresar tu <strong>DNI o CE</strong> registrado en la operación.</p>
  </div>

  <p style="margin:0;color:#64748B;font-size:11px;line-height:1.5">Si no reconoces este acuerdo, puedes ignorar este correo o rechazar la operación desde el enlace. Tu respuesta queda registrada con fecha, hora y documento validado.</p>
</div>
<p style="text-align:center;color:#475569;font-size:11px;margin:14px 0 0">Enviado por Credify — app.credify.pe</p>
</body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [body.to],
        subject: `${tipo}: confirma tu acuerdo en Credify`,
        html,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.message || 'No se pudo enviar el correo' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
