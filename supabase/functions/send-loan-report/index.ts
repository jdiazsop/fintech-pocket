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

    // Count overdue installments
    const overdueCount = pendingInstallments.filter((inst: Installment) => inst.due_date < todayStr).length;

    // Build compact email HTML
    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 24px 16px;">
        <table role="presentation" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">💰 CREDIFY</h1>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 12px;">Resumen al ${formatDate(todayStr)}</p>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                  <td style="background: #ecfdf5; border-radius: 8px; padding: 12px; text-align: center; width: 33%;">
                    <p style="margin: 0; color: #059669; font-size: 10px; font-weight: 600; text-transform: uppercase;">Prestado</p>
                    <p style="margin: 2px 0 0; color: #047857; font-size: 14px; font-weight: 700;">${formatCurrency(totalLent)}</p>
                  </td>
                  <td style="width: 8px;"></td>
                  <td style="background: #dbeafe; border-radius: 8px; padding: 12px; text-align: center; width: 33%;">
                    <p style="margin: 0; color: #2563eb; font-size: 10px; font-weight: 600; text-transform: uppercase;">Cobrado</p>
                    <p style="margin: 2px 0 0; color: #1d4ed8; font-size: 14px; font-weight: 700;">${formatCurrency(totalReturned)}</p>
                  </td>
                  <td style="width: 8px;"></td>
                  <td style="background: #fef3c7; border-radius: 8px; padding: 12px; text-align: center; width: 33%;">
                    <p style="margin: 0; color: #d97706; font-size: 10px; font-weight: 600; text-transform: uppercase;">Pendiente</p>
                    <p style="margin: 2px 0 0; color: #b45309; font-size: 14px; font-weight: 700;">${formatCurrency(totalPending)}</p>
                  </td>
                </tr>
              </table>

              ${overdueCount > 0 ? `
              <div style="background: #fef2f2; border-radius: 8px; padding: 10px; margin-bottom: 16px; text-align: center;">
                <p style="margin: 0; color: #dc2626; font-size: 12px; font-weight: 600;">⚠️ ${overdueCount} cuota${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''}</p>
              </div>
              ` : ''}

              <!-- Loans Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr style="background: #f1f5f9;">
                  <td style="padding: 8px; font-weight: 600; color: #475569; border-radius: 6px 0 0 6px;">Nombre</td>
                  <td style="padding: 8px; font-weight: 600; color: #475569; text-align: right;">Pendiente</td>
                  <td style="padding: 8px; font-weight: 600; color: #475569; text-align: center; border-radius: 0 6px 6px 0;">%</td>
                </tr>
                ${loans && loans.length > 0 ? loans.map((loan: Loan) => {
                  const loanPending = Number(loan.amount_to_return) - Number(loan.amount_returned);
                  const progress = Number(loan.amount_to_return) > 0 
                    ? Math.round((Number(loan.amount_returned) / Number(loan.amount_to_return)) * 100)
                    : 0;
                  return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px; color: #1f2937;">${loan.name}</td>
                  <td style="padding: 8px; color: #f59e0b; font-weight: 600; text-align: right;">${formatCurrency(loanPending)}</td>
                  <td style="padding: 8px; color: #10b981; text-align: center;">${progress}%</td>
                </tr>
                  `;
                }).join('') : `
                <tr>
                  <td colspan="3" style="padding: 16px; text-align: center; color: #6b7280;">Sin préstamos activos</td>
                </tr>
                `}
              </table>

              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 11px; text-align: center;">
                ${loans?.length || 0} préstamo${(loans?.length || 0) !== 1 ? 's' : ''} activo${(loans?.length || 0) !== 1 ? 's' : ''}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 11px;">
                CREDIFY v1.0 · Tu cuaderno digital de préstamos
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
