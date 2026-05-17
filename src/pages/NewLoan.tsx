import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, User, FileText, Calendar, Calculator, Check, Loader2, UserPlus, Users, Search, Phone, IdCard, MapPin, HandCoins, ShoppingCart, Paperclip, MessageCircle, ShieldCheck, SkipForward, Camera, X, Building2, Globe2, ChevronDown, ChevronsUpDown, Plus } from "lucide-react";
import { PERU_DEPARTMENTS, DISTRICT_SUGGESTIONS } from "@/lib/peruLocations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { buildPublicUrl } from "@/lib/publicUrl";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addWeeks, addMonths, format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/countryCodes";
import { EvidenceUploader, PendingEvidence } from "@/components/loans/EvidenceUploader";
import { buildAgreementMessage, buildWhatsAppUrl } from "@/lib/agreementMessage";
import { upsertClient } from "@/lib/clientSync";
import {
  sanitizeName, sanitizeDigits, sanitizeDni, sanitizeEmail,
  isValidName, isValidPhone, isValidDni, isValidEmail,
  NAME_ERROR, PHONE_ERROR, DNI_ERROR, EMAIL_ERROR,
} from "@/lib/validators";

type PaymentType = "single" | "installments";
type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
type OperationType = "loan" | "sale";

interface LoanFormData {
  firstName: string;
  lastName: string;
  phoneCountryCode: string;
  phoneNumber: string;
  dni: string;
  email: string;
  address: string;
  reference: string;
  concept: string;
  startDate: string;
  amountLent: string;
  amountToReturn: string;
  paymentType: PaymentType;
  frequency: Frequency;
  daysOrInstallments: number;
}

interface ExistingDebtor {
  name: string;
  firstName: string;
  lastName: string;
  phoneCountryCode: string;
  phoneNumber: string;
  dni: string;
  email: string;
  address: string;
  reference: string;
}

const SINGLE_PAYMENT_OPTIONS = [7, 15, 30];
const INSTALLMENT_OPTIONS = [2, 3, 4, 6];

const formatCurrency = (value: string) => {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(num);
};

export default function NewLoan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewClientFlow = searchParams.get("newClient") === "1";
  const presetType = searchParams.get("type"); // "loan" | "sale"
  const hasPresetType = presetType === "loan" || presetType === "sale";
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(isNewClientFlow ? 2 : hasPresetType ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>(hasPresetType ? (presetType as OperationType) : "loan");
  const [evidences, setEvidences] = useState<PendingEvidence[]>([]);
  const [createdLoan, setCreatedLoan] = useState<{ id: string; token: string; phoneCountryCode: string; phoneNumber: string; fullName: string; email: string | null } | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Step 0 state
  const [contactType, setContactType] = useState<"new" | "existing" | null>(isNewClientFlow ? "new" : null);
  const [existingDebtors, setExistingDebtors] = useState<ExistingDebtor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isContactLocked, setIsContactLocked] = useState(false);

  // Get today's date in Lima timezone
  const getTodayInLima = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  };

  const [formData, setFormData] = useState<LoanFormData>({
    firstName: "",
    lastName: "",
    phoneCountryCode: DEFAULT_COUNTRY_CODE,
    phoneNumber: "",
    dni: "",
    email: "",
    address: "",
    reference: "",
    concept: "",
    startDate: getTodayInLima(),
    amountLent: "",
    amountToReturn: "",
    paymentType: "single",
    frequency: "weekly",
    daysOrInstallments: 30,
  });

  // Structured location capture (UX only, persisted into `address` field)
  const [department, setDepartment] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [exactAddress, setExactAddress] = useState<string>("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [showAddressDetails, setShowAddressDetails] = useState(false);

  const provincesForDept = useMemo(
    () => PERU_DEPARTMENTS.find((d) => d.name === department)?.provinces || [],
    [department]
  );
  const districtSuggestions = useMemo(() => {
    if (!department || !province) return [];
    return DISTRICT_SUGGESTIONS[`${department}|${province}`] || [];
  }, [department, province]);

  const composedAddress = useMemo(() => {
    const loc = [district.trim(), province, department].filter(Boolean).join(", ");
    const exact = exactAddress.trim();
    if (exact && loc) return `${exact} — ${loc}`;
    return exact || loc;
  }, [exactAddress, district, province, department]);

  // Keep formData.address in sync so existing submit logic works untouched
  useEffect(() => {
    setFormData((prev) => ({ ...prev, address: composedAddress }));
  }, [composedAddress]);


  // Fetch existing debtors (latest record per name)
  useEffect(() => {
    const fetchDebtors = async () => {
      if (!user) return;
      const [{ data: loansData }, { data: clientsData }] = await Promise.all([
        supabase
          .from("loans")
          .select("name, first_name, last_name, phone_country_code, phone_number, dni, email, address, reference, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("clients")
          .select("first_name, last_name, phone_country_code, phone_number, dni, email, address, reference, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const map = new Map<string, ExistingDebtor>();
      // Loans first (preserve existing precedence for clients with operations)
      for (const l of (loansData as any[]) || []) {
        if (!map.has(l.name)) {
          map.set(l.name, {
            name: l.name,
            firstName: l.first_name || "",
            lastName: l.last_name || "",
            phoneCountryCode: l.phone_country_code || DEFAULT_COUNTRY_CODE,
            phoneNumber: l.phone_number || "",
            dni: l.dni || "",
            email: l.email || "",
            address: l.address || "",
            reference: l.reference || "",
          });
        }
      }
      // Then contacts-only clients (no operations yet)
      for (const c of (clientsData as any[]) || []) {
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
        if (!fullName) continue;
        if (!map.has(fullName)) {
          map.set(fullName, {
            name: fullName,
            firstName: c.first_name || "",
            lastName: c.last_name || "",
            phoneCountryCode: c.phone_country_code || DEFAULT_COUNTRY_CODE,
            phoneNumber: c.phone_number || "",
            dni: c.dni || "",
            email: c.email || "",
            address: c.address || "",
            reference: c.reference || "",
          });
        }
      }
      setExistingDebtors(Array.from(map.values()));
    };
    fetchDebtors();
  }, [user]);

  // Filtered debtors for search (name, DNI o teléfono)
  const filteredDebtors = useMemo(() => {
    if (!searchQuery.trim()) return existingDebtors;
    const q = searchQuery.toLowerCase().replace(/\s+/g, "");
    return existingDebtors.filter((d) => {
      const name = d.name.toLowerCase();
      const dni = (d.dni || "").toLowerCase();
      const phone = `${d.phoneCountryCode || ""}${d.phoneNumber || ""}`.toLowerCase();
      return (
        name.includes(searchQuery.toLowerCase()) ||
        dni.includes(q) ||
        phone.includes(q)
      );
    });
  }, [searchQuery, existingDebtors]);

  const handleSelectDebtor = (d: ExistingDebtor) => {
    setFormData((prev) => ({
      ...prev,
      firstName: d.firstName || d.name,
      lastName: d.lastName,
      phoneCountryCode: d.phoneCountryCode || DEFAULT_COUNTRY_CODE,
      phoneNumber: d.phoneNumber,
      dni: d.dni,
      email: d.email || "",
      address: d.address,
      reference: d.reference,
    }));
    setIsContactLocked(true);
    setContactType("existing");
    // Skip "Datos del cliente" step — go directly to calculator
    setStep(3);
  };

  const updateForm = (field: keyof LoanFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!formData.firstName.trim() || !isValidName(formData.firstName)) {
      toast({ title: "Nombre inválido", description: NAME_ERROR, variant: "destructive" });
      return false;
    }
    if (!formData.lastName.trim() || !isValidName(formData.lastName)) {
      toast({ title: "Apellido inválido", description: NAME_ERROR, variant: "destructive" });
      return false;
    }
    if (!isValidPhone(formData.phoneNumber)) {
      toast({ title: "Celular inválido", description: PHONE_ERROR, variant: "destructive" });
      return false;
    }
    if (!formData.dni.trim() || !isValidDni(formData.dni)) {
      toast({ title: "Documento inválido", description: DNI_ERROR, variant: "destructive" });
      return false;
    }
    if (formData.email.trim() && !isValidEmail(formData.email)) {
      toast({ title: "Correo inválido", description: EMAIL_ERROR, variant: "destructive" });
      return false;
    }
    // Compare as YYYY-MM-DD in Lima time to avoid UTC drift near midnight.
    const todayLima = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if ((formData.startDate || "") > todayLima) {
      toast({ title: "Error", description: "La fecha no puede ser futura", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const lent = parseFloat(formData.amountLent);
    const toReturn = parseFloat(formData.amountToReturn);

    if (operationType === "sale") {
      if (isNaN(toReturn) || toReturn <= 0) {
        toast({ title: "Error", description: "Ingresa un monto de venta válido", variant: "destructive" });
        return false;
      }
    } else {
      if (isNaN(lent) || lent <= 0) {
        toast({ title: "Error", description: "Ingresa un monto válido a prestar", variant: "destructive" });
        return false;
      }
      if (isNaN(toReturn) || toReturn <= 0) {
        toast({ title: "Error", description: "Ingresa un monto válido a devolver", variant: "destructive" });
        return false;
      }
      if (toReturn < lent) {
        toast({ title: "Revisa los montos", description: "El monto a devolver debe ser mayor o igual al monto prestado.", variant: "destructive" });
        return false;
      }
    }
    if (formData.daysOrInstallments <= 0) {
      toast({ title: "Error", description: "Selecciona un plazo válido", variant: "destructive" });
      return false;
    }
    return true;
  };

  const generateInstallments = () => {
    // Parse date correctly to avoid timezone issues
    const [year, month, day] = formData.startDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    startDate.setHours(12, 0, 0, 0); // Set to noon to avoid DST issues
    const installments = [];
    const totalAmount = parseFloat(formData.amountToReturn);

    // Helper to format date without timezone issues
    const formatDateLocal = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    if (formData.paymentType === "single") {
      const dueDate = addDays(startDate, formData.daysOrInstallments);
      installments.push({
        number: 1,
        due_date: formatDateLocal(dueDate),
        amount: totalAmount,
      });
    } else {
      const numInstallments = formData.daysOrInstallments;
      const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;
      let remainingAmount = totalAmount;

      for (let i = 1; i <= numInstallments; i++) {
        let dueDate: Date;
        
        if (formData.frequency === "daily") {
          dueDate = addDays(startDate, i);
        } else if (formData.frequency === "weekly") {
          dueDate = addWeeks(startDate, i);
        } else if (formData.frequency === "monthly") {
          dueDate = addMonths(startDate, i);
        } else {
          dueDate = addDays(startDate, i * 15);
        }

        const amount = i === numInstallments 
          ? remainingAmount 
          : installmentAmount;
        
        remainingAmount -= amount;

        installments.push({
          number: i,
          due_date: formatDateLocal(dueDate),
          amount: Math.round(amount * 100) / 100,
        });
      }
    }

    return installments;
  };

  const handleSubmit = async () => {
    if (!validateStep2() || !user) return;

    setLoading(true);

    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      // Create loan
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: user.id,
          name: fullName,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone_country_code: formData.phoneCountryCode,
          phone_number: formData.phoneNumber.trim(),
          dni: formData.dni.trim(),
          email: formData.email.trim() ? sanitizeEmail(formData.email) : null,
          address: formData.address.trim() || null,
          reference: formData.reference.trim() || null,
          concept: formData.concept.trim() || null,
          amount_lent: operationType === "sale" ? parseFloat(formData.amountToReturn) : parseFloat(formData.amountLent),
          amount_to_return: parseFloat(formData.amountToReturn),
          start_date: formData.startDate,
          payment_type: formData.paymentType,
          frequency: formData.paymentType === "installments" ? formData.frequency : null,
          operation_type: operationType,
        } as any)
        .select()
        .single();

      if (loanError) throw loanError;

      // Generate and insert installments
      const installments = generateInstallments().map(inst => ({
        ...inst,
        loan_id: loan.id,
      }));

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      // Sync contact into `clients` (deduplicated by DNI/teléfono via upsertClient).
      try {
        await upsertClient(user.id, {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim() || null,
          phone_country_code: formData.phoneCountryCode,
          phone_number: formData.phoneNumber.trim() || null,
          dni: formData.dni.trim() || null,
          email: formData.email.trim() ? sanitizeEmail(formData.email) : null,
          address: formData.address.trim() || null,
          reference: formData.reference.trim() || null,
        });
      } catch (e) {
        console.error("Client sync failed (non-blocking):", e);
      }

      // Upload evidences (best-effort: report failures via toast)
      if (evidences.length > 0) {
        const failed: string[] = [];
        for (const ev of evidences) {
          try {
            const safeName = ev.file.name.replace(/[^\w.\-]/g, "_");
            const path = `${user.id}/${loan.id}/${Date.now()}-${safeName}`;
            const { error: upErr } = await supabase.storage
              .from("operation-evidences")
              .upload(path, ev.file, { contentType: ev.file.type, upsert: false });
            if (upErr) throw upErr;
            await supabase.from("loan_evidences" as any).insert({
              loan_id: loan.id,
              user_id: user.id,
              file_path: path,
              file_name: ev.file.name,
              mime_type: ev.file.type,
              size_bytes: ev.file.size,
              category: ev.category || null,
            });
          } catch (e) {
            console.error("Evidence upload failed:", ev.file.name, e);
            failed.push(ev.file.name);
          }
        }
        if (failed.length) {
          toast({
            title: "Algunas evidencias no se subieron",
            description: failed.join(", "),
            variant: "destructive",
          });
        }
      }

      setCreatedLoan({
        id: loan.id,
        token: (loan as any).confirmation_token,
        phoneCountryCode: formData.phoneCountryCode,
        phoneNumber: formData.phoneNumber.trim(),
        fullName,
        email: formData.email.trim() ? sanitizeEmail(formData.email) : null,
      });

      toast({
        title: operationType === "sale" ? "¡Venta registrada!" : "¡Préstamo registrado!",
        description: `Operación de ${fullName} creada exitosamente`,
      });

      setStep(4);
    } catch (error) {
      console.error("Error creating loan:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la operación. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentSummary = () => {
    const installments = generateInstallments();
    if (installments.length === 0) return null;

    const lastInstallment = installments[installments.length - 1];
    // Parse date correctly to avoid timezone issues
    const [year, month, day] = lastInstallment.due_date.split('-').map(Number);
    const endDate = new Date(year, month - 1, day);

    return {
      numInstallments: installments.length,
      endDate: format(endDate, "dd 'de' MMMM, yyyy", { locale: es }),
      installmentAmount: formatCurrency(String(installments[0].amount)),
    };
  };

  const summary = step === 3 && formData.daysOrInstallments > 0 ? getPaymentSummary() : null;

  const handleBackNavigation = () => {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (step === 0) {
      navigate(-1);
    } else if (step === 1) {
      if (hasPresetType) {
        navigate(-1);
        return;
      }
      setStep(0);
      setContactType(null);
      setSearchQuery("");
      setIsContactLocked(false);
    } else if (step === 2) {
      if (isNewClientFlow) {
        navigate(-1);
        return;
      }
      setStep(1);
      setContactType(null);
      setIsContactLocked(false);
      setFormData((prev) => ({
        ...prev,
        firstName: "",
        lastName: "",
        phoneCountryCode: DEFAULT_COUNTRY_CODE,
        phoneNumber: "",
        dni: "",
        email: "",
        address: "",
        reference: "",
      }));
    } else if (step === 3) {
      // Back from calculator: existing client → search; new client → datos del cliente
      if (contactType === "existing") {
        setStep(1);
        setIsContactLocked(false);
      } else {
        setStep(2);
      }
    } else if (step === 4) {
      navigate("/portfolio");
    } else {
      setStep(step - 1);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!createdLoan) return;
    if (!createdLoan.phoneCountryCode || !createdLoan.phoneNumber) {
      toast({ title: "Falta WhatsApp", description: "Este cliente no tiene número de WhatsApp registrado.", variant: "destructive" });
      return;
    }
    const installments = generateInstallments();
    const lastDue = installments[installments.length - 1].due_date;
    const amountToReturn = parseFloat(formData.amountToReturn);
    const amountLent = parseFloat(formData.amountLent);
    const installmentAmount = installments[0].amount;
    const confirmUrl = buildPublicUrl(`/confirm/${createdLoan.token}`);

    const message = buildAgreementMessage({
      name: createdLoan.fullName,
      operationType,
      amount: amountToReturn,
      amountLent: operationType === "loan" ? amountLent : undefined,
      numInstallments: installments.length,
      installmentAmount,
      startDate: formData.startDate,
      endDate: lastDue,
      paymentType: formData.paymentType,
      confirmUrl,
    });

    // Mark as pending confirmation
    await supabase
      .from("loans")
      .update({ confirmation_status: "pending", confirmation_sent_at: new Date().toISOString() } as any)
      .eq("id", createdLoan.id);

    setConfirmSent(true);

    const waUrl = buildWhatsAppUrl(createdLoan.phoneCountryCode, createdLoan.phoneNumber, message);
    const popup = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      // Fallback for browsers that block window.open
      window.location.href = waUrl;
    }
  };

  const currentStepDisplay = step + 1;

  return (
    <AppLayout>
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBackNavigation}
            className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">
              Nueva operación
            </h1>
            <p className="text-sm text-muted-foreground">Paso {currentStepDisplay} de 5</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1 flex-1 rounded-full ${step >= 0 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 4 ? "bg-primary" : "bg-muted"}`} />
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Operation Type */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="fintech-card p-5 space-y-5">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold leading-tight">¿Qué deseas registrar?</h2>
                    <p className="text-[11px] text-muted-foreground leading-tight">Elige el tipo de acuerdo</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => {
                      setOperationType("loan");
                      setStep(1);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left active:scale-[0.99] ${
                      operationType === "loan"
                        ? "border-primary bg-primary/10"
                        : "border-muted bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="p-3 rounded-xl bg-primary/15">
                      <HandCoins className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight">Préstamo</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Dinero prestado a devolver</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  <button
                    onClick={() => {
                      setOperationType("sale");
                      setStep(1);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left active:scale-[0.99] ${
                      operationType === "sale"
                        ? "border-primary bg-primary/10"
                        : "border-muted bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="p-3 rounded-xl bg-primary/15">
                      <ShoppingCart className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight">Venta al crédito</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Producto o servicio a pagar en cuotas</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 1: Search or create client */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="fintech-card p-5 space-y-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold leading-tight">Buscar o crear cliente</h2>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {operationType === "sale" ? "¿A quién vas a vender al crédito?" : "¿A quién vas a prestar?"}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-muted/50 pl-9"
                    autoFocus
                  />
                </div>

                <button
                  onClick={() => {
                    setContactType("new");
                    setIsContactLocked(false);
                    setFormData((prev) => ({
                      ...prev,
                      firstName: "",
                      lastName: "",
                      phoneCountryCode: DEFAULT_COUNTRY_CODE,
                      phoneNumber: "",
                      dni: "",
                      email: "",
                      address: "",
                      reference: "",
                    }));
                    setStep(2);
                  }}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-3 text-left active:scale-[0.99]"
                >
                  <div className="p-2 rounded-lg bg-primary/15">
                    <UserPlus className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">Crear nuevo cliente</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Registrar datos por primera vez</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-semibold px-1">
                    {searchQuery.trim() ? "Resultados" : "Clientes recientes"}
                  </p>
                  <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg bg-muted/30 p-2">
                    {filteredDebtors.length > 0 ? (
                      filteredDebtors.map((d) => (
                        <button
                          key={d.name}
                          onClick={() => handleSelectDebtor(d)}
                          className="w-full text-left p-3 rounded-lg hover:bg-primary/15 transition-colors flex items-center gap-3 active:scale-[0.99]"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{d.name}</p>
                            {d.phoneNumber && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {d.phoneCountryCode} {d.phoneNumber}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {existingDebtors.length === 0
                          ? "Aún no tienes clientes registrados"
                          : "No se encontraron coincidencias"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Header onboarding-style */}
              <div className="flex items-center gap-3 px-1">
                <label className="relative cursor-pointer group">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center overflow-hidden border border-primary/30">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setAvatarPreview(null); }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      aria-label="Quitar foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAvatarPreview(URL.createObjectURL(f));
                    }}
                  />
                </label>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-tight">
                    {operationType === "sale"
                      ? "¿A quién le venderás al crédito?"
                      : "¿Con quién realizarás esta operación?"}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    Empecemos por identificar a la persona.
                  </p>
                </div>
              </div>

              {/* Section: Datos personales */}
              <div className="fintech-card p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/15">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight">Datos personales</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs text-muted-foreground">Nombres</Label>
                    <Input
                      id="firstName"
                      placeholder="Juan Carlos"
                      value={formData.firstName}
                      onChange={(e) => updateForm("firstName", sanitizeName(e.target.value))}
                      className={`bg-muted/40 h-11 ${isContactLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                      disabled={isContactLocked}
                      autoComplete="given-name"
                      aria-invalid={!!formData.firstName && !isValidName(formData.firstName)}
                    />
                    {!!formData.firstName && !isValidName(formData.firstName) && !isContactLocked && (
                      <p className="text-[11px] text-destructive">{NAME_ERROR}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs text-muted-foreground">Apellidos</Label>
                    <Input
                      id="lastName"
                      placeholder="Pérez Gómez"
                      value={formData.lastName}
                      onChange={(e) => updateForm("lastName", sanitizeName(e.target.value))}
                      className={`bg-muted/40 h-11 ${isContactLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                      disabled={isContactLocked}
                      autoComplete="family-name"
                      aria-invalid={!!formData.lastName && !isValidName(formData.lastName)}
                    />
                    {!!formData.lastName && !isValidName(formData.lastName) && !isContactLocked && (
                      <p className="text-[11px] text-destructive">{NAME_ERROR}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dni" className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5" />
                    DNI o CE
                  </Label>
                  <Input
                    id="dni"
                    placeholder="12345678"
                    value={formData.dni}
                    onChange={(e) => updateForm("dni", sanitizeDni(e.target.value))}
                    className={`bg-muted/40 h-11 ${isContactLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                    disabled={isContactLocked}
                    maxLength={12}
                    aria-invalid={!!formData.dni && !isValidDni(formData.dni)}
                  />
                  {!!formData.dni && !isValidDni(formData.dni) && !isContactLocked && (
                    <p className="text-[11px] text-destructive">{DNI_ERROR}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber" className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Celular
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.phoneCountryCode}
                      onValueChange={(v) => updateForm("phoneCountryCode", v)}
                      disabled={isContactLocked}
                    >
                      <SelectTrigger className="bg-muted/40 w-[110px] shrink-0 h-11">
                        <SelectValue>
                          {(() => {
                            const c = COUNTRY_CODES.find((x) => x.code === formData.phoneCountryCode);
                            return c ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-base leading-none">{c.flag}</span>
                                <span className="text-sm">{c.code}</span>
                              </span>
                            ) : null;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.iso} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span className="text-base leading-none">{c.flag}</span>
                              <span className="text-sm">{c.name}</span>
                              <span className="text-xs text-muted-foreground">{c.code}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      inputMode="numeric"
                      placeholder="987 654 321"
                      value={formData.phoneNumber}
                      onChange={(e) => updateForm("phoneNumber", sanitizeDigits(e.target.value))}
                      className={`bg-muted/40 flex-1 h-11 ${isContactLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                      disabled={isContactLocked}
                      maxLength={15}
                      aria-invalid={!!formData.phoneNumber && !isValidPhone(formData.phoneNumber)}
                    />
                  </div>
                  {!!formData.phoneNumber && !isValidPhone(formData.phoneNumber) && !isContactLocked && (
                    <p className="text-[11px] text-destructive">{PHONE_ERROR}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Correo electrónico (opcional)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="cliente@correo.com"
                    value={formData.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    className={`bg-muted/40 h-11 ${isContactLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                    disabled={isContactLocked}
                    autoComplete="email"
                    maxLength={120}
                    aria-invalid={!!formData.email && !isValidEmail(formData.email)}
                  />
                  {!!formData.email && !isValidEmail(formData.email) && !isContactLocked && (
                    <p className="text-[11px] text-destructive">{EMAIL_ERROR}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">Necesario para enviar el acuerdo digital por correo.</p>
                </div>
              </div>

              {/* Section: Ubicación (progressive disclosure) */}
              <div className="fintech-card p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/15">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold leading-tight">Ubicación</h3>
                    <p className="text-[11px] text-muted-foreground leading-tight">Opcional · ayuda a tu trazabilidad</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5" />
                      Departamento
                    </Label>
                    <Select
                      value={department}
                      onValueChange={(v) => { setDepartment(v); setProvince(""); setDistrict(""); }}
                    >
                      <SelectTrigger className="bg-muted/40 h-11">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {PERU_DEPARTMENTS.map((d) => (
                          <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Distrito</Label>
                    <Popover open={districtOpen} onOpenChange={setDistrictOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!department}
                          className="w-full h-11 px-3 rounded-md bg-muted/40 border border-input flex items-center justify-between text-left text-sm disabled:opacity-50"
                        >
                          <span className={district ? "" : "text-muted-foreground"}>
                            {district || (department ? "Buscar distrito..." : "Elige depto.")}
                          </span>
                          <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar distrito..." />
                          <CommandList>
                            <CommandEmpty>Sin resultados</CommandEmpty>
                            {(() => {
                              const all = new Set<string>();
                              if (province) {
                                (DISTRICT_SUGGESTIONS[`${department}|${province}`] || []).forEach((s) => all.add(s));
                              }
                              if (department) {
                                (PERU_DEPARTMENTS.find((d) => d.name === department)?.provinces || []).forEach((p) => {
                                  (DISTRICT_SUGGESTIONS[`${department}|${p}`] || []).forEach((s) => all.add(s));
                                });
                              }
                              const items = Array.from(all).sort((a, b) => a.localeCompare(b));
                              return (
                                <CommandGroup>
                                  {items.map((s) => (
                                    <CommandItem
                                      key={s}
                                      value={s}
                                      onSelect={(v) => {
                                        setDistrict(v);
                                        setDistrictOpen(false);
                                      }}
                                    >
                                      {s}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              );
                            })()}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Collapsible open={showAddressDetails} onOpenChange={setShowAddressDetails}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-xs text-primary hover:text-primary/80 py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        {showAddressDetails ? "Ocultar dirección exacta" : "Agregar dirección exacta"}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAddressDetails ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Provincia
                      </Label>
                      <Select
                        value={province}
                        onValueChange={(v) => { setProvince(v); setDistrict(""); }}
                        disabled={!department}
                      >
                        <SelectTrigger className="bg-muted/40 h-11">
                          <SelectValue placeholder={department ? "Selecciona" : "Elige depto."} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {provincesForDept.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exactAddress" className="text-xs text-muted-foreground">
                        Dirección exacta
                      </Label>
                      <Input
                        id="exactAddress"
                        placeholder="Av. Principal 123, Dpto. 4B"
                        value={exactAddress}
                        onChange={(e) => setExactAddress(e.target.value)}
                        className="bg-muted/40 h-11"
                        maxLength={200}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <Button
                onClick={() => {
                  if (validateStep1()) setStep(3);
                }}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 3 && !reviewing && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Section: Detalles de la operación (motivo/producto + fecha) */}
              <div className="fintech-card p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/15">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight">Detalles de la operación</h3>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="concept" className="text-xs text-muted-foreground">
                    {operationType === "sale" ? "Producto o detalle de venta" : "Motivo del préstamo"}{" "}
                    <span className="text-muted-foreground/60">(opcional)</span>
                  </Label>
                  <Input
                    id="concept"
                    placeholder={
                      operationType === "sale"
                        ? "Ej: iPhone 15, Laptop Lenovo, Mercadería..."
                        : "Ej: Capital de trabajo, Emergencia, Salud..."
                    }
                    value={formData.concept}
                    onChange={(e) => updateForm("concept", e.target.value)}
                    className="bg-muted/40 h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Fecha de la operación
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="startDate"
                        type="button"
                        variant="outline"
                        className={cn(
                          "bg-muted/40 h-11 w-full justify-start text-left font-normal",
                          !formData.startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.startDate
                          ? format(parse(formData.startDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy", { locale: es })
                          : "Selecciona una fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        locale={es}
                        selected={formData.startDate ? parse(formData.startDate, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(d) => d && updateForm("startDate", format(d, "yyyy-MM-dd"))}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Step 2: Calculator */}
              <div className="fintech-card p-5 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-semibold">Calculadora</h2>
                </div>

                {operationType === "sale" ? (
                  <div className="space-y-2">
                    <Label htmlFor="amountToReturn">Monto de venta *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                      <Input
                        id="amountToReturn"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amountToReturn}
                        onChange={(e) => updateForm("amountToReturn", e.target.value)}
                        className="bg-muted/50 pl-9"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Monto total que el cliente pagará en cuotas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amountLent">Monto a prestar *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                          <Input
                            id="amountLent"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.amountLent}
                            onChange={(e) => updateForm("amountLent", e.target.value)}
                            className="bg-muted/50 pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amountToReturn">Monto a devolver *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">S/</span>
                          <Input
                            id="amountToReturn"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.amountToReturn}
                            onChange={(e) => updateForm("amountToReturn", e.target.value)}
                            className="bg-muted/50 pl-9"
                          />
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const l = parseFloat(formData.amountLent);
                      const r = parseFloat(formData.amountToReturn);
                      if (!isNaN(l) && !isNaN(r) && r > 0 && r < l) {
                        return (
                          <p className="text-xs text-destructive leading-snug pt-0.5">
                            El monto a devolver debe ser mayor o igual al monto prestado.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Payment Type Toggle */}
                <div className="space-y-3">
                  <Label>Tipo de Pago</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        updateForm("paymentType", "single");
                        updateForm("daysOrInstallments", 7);
                        setShowCustomInput(false);
                      }}
                      className={`chip-button ${formData.paymentType === "single" ? "active" : ""}`}
                    >
                      Pago Único
                    </button>
                    <button
                      onClick={() => {
                        updateForm("paymentType", "installments");
                        updateForm("daysOrInstallments", 2);
                        setShowCustomInput(false);
                      }}
                      className={`chip-button ${formData.paymentType === "installments" ? "active" : ""}`}
                    >
                      En Cuotas
                    </button>
                  </div>
                </div>

                {/* Single Payment Options */}
                {formData.paymentType === "single" && (
                  <div className="space-y-3">
                    <Label>Plazo (días)</Label>
                    <div className="flex flex-wrap gap-2">
                      {SINGLE_PAYMENT_OPTIONS.map((days) => (
                        <button
                          key={days}
                          onClick={() => {
                            updateForm("daysOrInstallments", days);
                            setShowCustomInput(false);
                          }}
                          className={`chip-button ${
                            !showCustomInput && formData.daysOrInstallments === days ? "active" : ""
                          }`}
                        >
                          {days}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowCustomInput(true);
                          updateForm("daysOrInstallments", 1);
                        }}
                        className={`chip-button ${showCustomInput ? "active" : ""}`}
                      >
                        Otro
                      </button>
                    </div>
                    {showCustomInput && (
                      <Input
                        type="number"
                        min="1"
                        max="200"
                        placeholder="Días"
                        value={formData.daysOrInstallments === 0 ? "" : formData.daysOrInstallments}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          updateForm("daysOrInstallments", Math.min(200, Math.max(0, val)));
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          updateForm("daysOrInstallments", Math.min(200, Math.max(1, val)));
                        }}
                        className="bg-muted/50 w-24"
                      />
                    )}
                  </div>
                )}

                {/* Installments Options */}
                {formData.paymentType === "installments" && (
                  <>
                    <div className="space-y-3">
                      <Label>Frecuencia de pago</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["daily", "weekly", "biweekly", "monthly"] as Frequency[]).map((freq) => (
                          <button
                            key={freq}
                            onClick={() => {
                              updateForm("frequency", freq);
                              updateForm("daysOrInstallments", freq === "daily" ? 1 : 2);
                              setShowCustomInput(false);
                            }}
                            className={`chip-button flex-1 ${formData.frequency === freq ? "active" : ""}`}
                          >
                            {freq === "daily" && "Diario"}
                            {freq === "weekly" && "Semanal"}
                            {freq === "biweekly" && "Quincenal"}
                            {freq === "monthly" && "Mensual"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Número de Cuotas</Label>
                      {formData.frequency === "daily" ? (
                        <Input
                          type="number"
                          min="1"
                          max="200"
                          placeholder="Cuotas"
                          value={formData.daysOrInstallments === 0 ? "" : formData.daysOrInstallments}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateForm("daysOrInstallments", Math.min(200, Math.max(0, val)));
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            updateForm("daysOrInstallments", Math.min(200, Math.max(1, val)));
                          }}
                          className="bg-muted/50 w-full"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {INSTALLMENT_OPTIONS.map((num) => (
                            <button
                              key={num}
                              onClick={() => {
                                updateForm("daysOrInstallments", num);
                                setShowCustomInput(false);
                              }}
                              className={`chip-button ${
                                !showCustomInput && formData.daysOrInstallments === num ? "active" : ""
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setShowCustomInput(true);
                              updateForm("daysOrInstallments", 1);
                            }}
                            className={`chip-button ${showCustomInput ? "active" : ""}`}
                          >
                            Otro
                          </button>
                        </div>
                      )}
                      {showCustomInput && formData.frequency !== "daily" && (
                        <Input
                          type="number"
                          min="1"
                          max="200"
                          placeholder="Cuotas"
                          value={formData.daysOrInstallments === 0 ? "" : formData.daysOrInstallments}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateForm("daysOrInstallments", Math.min(200, Math.max(0, val)));
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            updateForm("daysOrInstallments", Math.min(200, Math.max(1, val)));
                          }}
                          className="bg-muted/50 w-24"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Summary */}
              {summary && (() => {
                const allInst = generateInstallments();
                const next = allInst[0];
                const upcoming = allInst.slice(1, 3);
                const remaining = Math.max(allInst.length - 1 - upcoming.length, 0);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fintech-card p-4 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30"
                  >
                    <h3 className="font-semibold mb-3">Resumen</h3>

                    {/* Datos económicos */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cuotas:</span>
                        <span className="font-medium">{summary.numInstallments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto por cuota:</span>
                        <span className="font-medium">{summary.installmentAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última cuota:</span>
                        <span className="font-medium">{summary.endDate}</span>
                      </div>
                      {operationType === "loan" && (
                        <div className="flex justify-between pt-2 border-t border-border">
                          <span className="text-muted-foreground">Ganancia:</span>
                          <span className="font-semibold text-emerald-400">
                            {formatCurrency(String(parseFloat(formData.amountToReturn) - parseFloat(formData.amountLent)))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Próximo pago + cuotas siguientes */}
                    {next && (() => {
                      const [ny, nm, nd] = next.due_date.split('-').map(Number);
                      const nextDate = new Date(ny, nm - 1, nd);
                      return (
                        <div className="mt-4 pt-3 border-t border-primary/20">
                          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                            <p className="text-[10px] text-primary/80 font-semibold">
                              Próxima cuota
                            </p>
                            <div className="flex items-end justify-between gap-3 mt-1">
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  Cuota {next.number}
                                </p>
                                <p className="text-base font-semibold capitalize leading-tight mt-0.5">
                                  {format(nextDate, "EEE dd MMM yyyy", { locale: es })}
                                </p>
                              </div>
                              <span className="text-lg font-bold tabular-nums text-primary">
                                {formatCurrency(String(next.amount))}
                              </span>
                            </div>
                          </div>

                          {(upcoming.length > 0 || remaining > 0) && (
                            <div className="mt-3 space-y-1.5">
                              {upcoming.map((inst) => {
                                const [y, m, d] = inst.due_date.split('-').map(Number);
                                const date = new Date(y, m - 1, d);
                                return (
                                  <div
                                    key={inst.number}
                                    className="flex items-center justify-between text-xs text-muted-foreground"
                                  >
                                    <span className="capitalize">
                                      Cuota {inst.number} · {format(date, "dd MMM yyyy", { locale: es })}
                                    </span>
                                    <span className="tabular-nums">
                                      {formatCurrency(String(inst.amount))}
                                    </span>
                                  </div>
                                );
                              })}
                              {remaining > 0 && (
                                <p className="text-[11px] text-muted-foreground/80 pt-0.5">
                                  +{remaining} {remaining === 1 ? "cuota más" : "cuotas más"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })()}

              {/* Evidences (optional) */}
              <div className="fintech-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <Paperclip className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold leading-tight">Evidencias y respaldo</h2>
                    <p className="text-[11px] text-muted-foreground leading-tight">Opcional · recomendado</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Agrega fotos o documentos para respaldar esta operación (recomendado).
                </p>
                <EvidenceUploader evidences={evidences} onChange={setEvidences} />
              </div>

              <Button
                onClick={() => {
                  if (validateStep2()) {
                    setReviewing(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Step 3.5: Review before registering */}
          {step === 3 && reviewing && (() => {
            const allInst = generateInstallments();
            const next = allInst[0];
            const last = allInst[allInst.length - 1];
            const upcoming = allInst.slice(1, 3);
            const remaining = Math.max(allInst.length - 1 - upcoming.length, 0);
            const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
            const total = parseFloat(formData.amountToReturn || "0");
            const lent = parseFloat(formData.amountLent || "0");
            const profit = total - lent;
            const parseLocal = (s: string) => {
              const [y, m, d] = s.split("-").map(Number);
              return new Date(y, m - 1, d);
            };
            const paymentLabel =
              formData.paymentType === "single"
                ? `Pago único en ${formData.daysOrInstallments} días`
                : `${formData.daysOrInstallments} cuotas · ${
                    { daily: "Diario", weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual" }[
                      formData.frequency
                    ]
                  }`;

            const Row = ({
              label,
              value,
              onEdit,
              accent,
            }: {
              label: string;
              value: React.ReactNode;
              onEdit?: () => void;
              accent?: boolean;
            }) => (
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <div className={`text-sm mt-0.5 ${accent ? "font-semibold text-primary" : "font-medium"}`}>
                    {value}
                  </div>
                </div>
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="text-[11px] font-semibold text-primary hover:underline shrink-0 mt-1"
                  >
                    Editar
                  </button>
                )}
              </div>
            );

            return (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-5"
              >
                <div className="fintech-card p-5 space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-primary/20">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold leading-tight">Revisión de la operación</h2>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Verifica los datos antes de registrar
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border/60">
                    <Row
                      label="Cliente"
                      value={fullName || "—"}
                      onEdit={() => {
                        setReviewing(false);
                        setStep(2);
                      }}
                    />
                    <Row
                      label="Tipo de operación"
                      value={operationType === "sale" ? "Venta al crédito" : "Préstamo"}
                    />
                    {operationType === "loan" ? (
                      <Row
                        label="Monto"
                        value={
                          <span>
                            {formatCurrency(formData.amountLent)}{" "}
                            <span className="text-muted-foreground font-normal">→</span>{" "}
                            {formatCurrency(formData.amountToReturn)}
                          </span>
                        }
                        onEdit={() => setReviewing(false)}
                      />
                    ) : (
                      <Row
                        label="Monto"
                        value={formatCurrency(formData.amountToReturn)}
                        onEdit={() => setReviewing(false)}
                      />
                    )}
                    <Row label="Forma de pago" value={paymentLabel} onEdit={() => setReviewing(false)} />
                    {next && (
                      <Row
                        label="Próxima cuota"
                        accent
                        value={
                          <span className="capitalize">
                            {format(parseLocal(next.due_date), "EEE dd MMM yyyy", { locale: es })} ·{" "}
                            {formatCurrency(String(next.amount))}
                          </span>
                        }
                      />
                    )}
                    {last && (
                      <Row
                        label="Última cuota"
                        value={
                          <span className="capitalize">
                            {format(parseLocal(last.due_date), "dd MMM yyyy", { locale: es })}
                          </span>
                        }
                      />
                    )}
                    {operationType === "loan" && !isNaN(profit) && (
                      <Row
                        label="Ganancia"
                        value={
                          <span className="text-emerald-400 font-semibold">{formatCurrency(String(profit))}</span>
                        }
                      />
                    )}
                  </div>

                  {/* Cronograma resumido */}
                  {(upcoming.length > 0 || remaining > 0) && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Cronograma
                      </p>
                      <div className="space-y-1.5">
                        {upcoming.map((inst) => (
                          <div
                            key={inst.number}
                            className="flex items-center justify-between text-xs text-muted-foreground"
                          >
                            <span className="capitalize">
                              Cuota {inst.number} · {format(parseLocal(inst.due_date), "dd MMM yyyy", { locale: es })}
                            </span>
                            <span className="tabular-nums">{formatCurrency(String(inst.amount))}</span>
                          </div>
                        ))}
                        {remaining > 0 && (
                          <p className="text-[11px] text-muted-foreground/80">
                            +{remaining} {remaining === 1 ? "cuota más" : "cuotas más"}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar y registrar
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setReviewing(false)}
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a editar
                </Button>
              </motion.div>
            );
          })()}

          {/* Step 4: Success + send agreement (integrated screen) */}
          {step === 4 && createdLoan && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {/* Success state */}
              <div className="flex flex-col items-center text-center pt-4">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4"
                >
                  <Check className="w-8 h-8 text-emerald-400" strokeWidth={2.5} />
                </motion.div>
                <h2 className="text-lg font-semibold">
                  {operationType === "sale"
                    ? "Venta al crédito registrada correctamente"
                    : "Préstamo registrado correctamente"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  La operación quedó guardada en tu cartera.
                </p>
              </div>

              {/* Recommended next action */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] text-muted-foreground">
                    Siguiente paso
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="flex items-start gap-3 px-1">
                  <div className="p-2 rounded-xl bg-primary/15 mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold leading-tight text-sm">
                      Enviar acuerdo al cliente
                    </h3>
                    <p className="text-[13px] text-muted-foreground leading-snug mt-1">
                      El acuerdo se enviará por <strong>WhatsApp</strong> con un enlace seguro. La validación de identidad se realizará mediante un <strong>código OTP enviado al correo</strong> del cliente.
                    </p>
                  </div>
                </div>

                {confirmSent && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 px-1">
                    <Check className="w-3.5 h-3.5" />
                    Estado actualizado a "Pendiente de confirmación".
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleSendWhatsApp}
                  className="w-full bg-emerald-500 hover:bg-emerald-500/90 h-12 text-base"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  {confirmSent ? "Reenviar acuerdo" : "Enviar acuerdo"}
                </Button>

                <Button
                  onClick={() => navigate("/portfolio")}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  {confirmSent ? "Listo, ir a Pagos" : "Omitir por ahora"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
