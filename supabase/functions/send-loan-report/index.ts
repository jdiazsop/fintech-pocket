import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Loan {
  id: string;
  name: string;
  amount_lent: number;
  amount_to_return: number;
  amount_returned: number;
  status: string;
  start_date: string;
  payment_type: string;
  frequency: string | null;
}

interface Installment {
  id: string;
  loan_id: string;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: string;
  number: number;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

const formatDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    partial: "Parcial",
    paid: "Pagado",
    overdue: "Vencido",
    active: "Activo",
    completed: "Completado",
  };
  return labels[status] || status;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: "#f59e0b",
    partial: "#3b82f6",
    paid: "#10b981",
    overdue: "#ef4444",
    active: "#10b981",
    completed: "#6b7280",
  };
  return colors[status] || "#6b7280";
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Send loan report function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client with the user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("User authenticated:", user.email);

    // Get today's date in Lima, Peru timezone (UTC-5)
    const now = new Date();
    const limaOffset = -5 * 60; // UTC-5 in minutes
    const limaTime = new Date(now.getTime() + (limaOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = limaTime.toISOString().split("T")[0];

    // Fetch all active and partial loans for this user (loans with pending payments)
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "partial"]);

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} loans with pending payments`);

    // Fetch all installments for these loans that are pending or partial
    const loanIds = loans?.map((loan: Loan) => loan.id) || [];
    let pendingInstallments: Installment[] = [];

    if (loanIds.length > 0) {
      const { data: installments, error: installmentsError } = await supabase
        .from("installments")
        .select("*")
        .in("loan_id", loanIds)
        .in("status", ["pending", "partial"])
        .order("due_date", { ascending: true });

      if (installmentsError) {
        console.error("Error fetching installments:", installmentsError);
        throw installmentsError;
      }

      pendingInstallments = installments || [];
    }

    console.log(`Found ${pendingInstallments.length} pending installments`);

    // Calculate summary statistics
    const totalLent = loans?.reduce((sum: number, loan: Loan) => sum + Number(loan.amount_lent), 0) || 0;
    const totalToReturn = loans?.reduce((sum: number, loan: Loan) => sum + Number(loan.amount_to_return), 0) || 0;
    const totalReturned = loans?.reduce((sum: number, loan: Loan) => sum + Number(loan.amount_returned), 0) || 0;
    const totalPending = totalToReturn - totalReturned;

    // Group installments by loan
    const installmentsByLoan: Record<string, Installment[]> = {};
    pendingInstallments.forEach((inst: Installment) => {
      if (!installmentsByLoan[inst.loan_id]) {
        installmentsByLoan[inst.loan_id] = [];
      }
      installmentsByLoan[inst.loan_id].push(inst);
    });

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Préstamos - Credify</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                💰 CREDIFY
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                Tu cuaderno digital de préstamos
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 32px 16px;">
              <h2 style="margin: 0 0 8px; color: #1f2937; font-size: 20px; font-weight: 600;">
                Hola 👋
              </h2>
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Aquí está tu resumen de préstamos al <strong>${formatDate(todayStr)}</strong>
              </p>
            </td>
          </tr>

          <!-- Summary Cards -->
          <tr>
            <td style="padding: 16px 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 8px;">
                    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; text-align: center;">
                      <p style="margin: 0 0 4px; color: #059669; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Capital Prestado</p>
                      <p style="margin: 0; color: #047857; font-size: 20px; font-weight: 700;">${formatCurrency(totalLent)}</p>
                    </div>
                  </td>
                  <td style="width: 50%; padding-left: 8px;">
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; text-align: center;">
                      <p style="margin: 0 0 4px; color: #d97706; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Por Cobrar</p>
                      <p style="margin: 0; color: #b45309; font-size: 20px; font-weight: 700;">${formatCurrency(totalPending)}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Loans Detail -->
          <tr>
            <td style="padding: 16px 32px 32px;">
              <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                📋 Préstamos Activos (${loans?.length || 0})
              </h3>
              
              ${loans && loans.length > 0 ? loans.map((loan: Loan) => {
                const loanInstallments = installmentsByLoan[loan.id] || [];
                const loanPending = Number(loan.amount_to_return) - Number(loan.amount_returned);
                const progress = Number(loan.amount_to_return) > 0 
                  ? (Number(loan.amount_returned) / Number(loan.amount_to_return)) * 100 
                  : 0;
                
                return `
                <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 12px; border-left: 4px solid ${getStatusColor(loan.status)};">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="vertical-align: top;">
                        <p style="margin: 0 0 4px; color: #1f2937; font-size: 16px; font-weight: 600;">${loan.name}</p>
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">Inicio: ${formatDate(loan.start_date)}</p>
                      </td>
                      <td style="text-align: right; vertical-align: top;">
                        <span style="display: inline-block; background-color: ${getStatusColor(loan.status)}20; color: ${getStatusColor(loan.status)}; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 6px;">
                          ${getStatusLabel(loan.status)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top: 8px;">
                        <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                          <tr>
                            <td style="color: #6b7280; padding: 2px 0;">Prestado:</td>
                            <td style="color: #1f2937; font-weight: 500; text-align: right;">${formatCurrency(loan.amount_lent)}</td>
                          </tr>
                          <tr>
                            <td style="color: #6b7280; padding: 2px 0;">Cobrado:</td>
                            <td style="color: #10b981; font-weight: 500; text-align: right;">${formatCurrency(loan.amount_returned)}</td>
                          </tr>
                          <tr>
                            <td style="color: #6b7280; padding: 2px 0;">Pendiente:</td>
                            <td style="color: #f59e0b; font-weight: 600; text-align: right;">${formatCurrency(loanPending)}</td>
                          </tr>
                        </table>
                        
                        <!-- Progress bar -->
                        <div style="margin-top: 12px;">
                          <div style="background-color: #e5e7eb; border-radius: 4px; height: 6px; overflow: hidden;">
                            <div style="background-color: #10b981; height: 100%; width: ${Math.min(progress, 100)}%; border-radius: 4px;"></div>
                          </div>
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 11px; text-align: right;">${progress.toFixed(0)}% cobrado</p>
                        </div>
                        
                        ${loanInstallments.length > 0 ? `
                        <!-- Pending installments -->
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e5e7eb;">
                          <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 600;">Cuotas pendientes:</p>
                          ${loanInstallments.slice(0, 3).map((inst: Installment) => {
                            const instPending = Number(inst.amount) - Number(inst.amount_paid);
                            const isOverdue = inst.due_date < todayStr && inst.status !== 'paid';
                            return `
                            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;">
                              <span style="color: ${isOverdue ? '#ef4444' : '#6b7280'};">
                                #${inst.number} - ${formatDate(inst.due_date)} ${isOverdue ? '⚠️' : ''}
                              </span>
                              <span style="color: ${isOverdue ? '#ef4444' : '#1f2937'}; font-weight: 500;">
                                ${formatCurrency(instPending)}
                              </span>
                            </div>
                            `;
                          }).join('')}
                          ${loanInstallments.length > 3 ? `
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 11px; font-style: italic;">
                            +${loanInstallments.length - 3} cuotas más...
                          </p>
                          ` : ''}
                        </div>
                        ` : ''}
                      </td>
                    </tr>
                  </table>
                </div>
                `;
              }).join('') : `
              <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">No tienes préstamos activos en este momento.</p>
              </div>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #1f2937; font-size: 14px; font-weight: 600;">
                💰 CREDIFY
              </p>
              <p style="margin: 0 0 16px; color: #6b7280; font-size: 12px;">
                Tu cuaderno digital de préstamos
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                Este correo fue enviado a ${user.email}<br>
                Generado el ${formatDate(todayStr)} a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email using Resend
    console.log("Sending email to:", user.email);
    const emailResponse = await resend.emails.send({
      from: "Credify <onboarding@resend.dev>",
      to: [user.email!],
      subject: `📊 Tu Reporte de Préstamos - ${formatDate(todayStr)}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reporte enviado exitosamente",
        emailId: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-loan-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error al enviar el reporte" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
