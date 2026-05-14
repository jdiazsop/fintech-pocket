import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, Phone, IdCard, MapPin, Loader2, Check, UserPlus, Plus, ChevronsUpDown, Mail } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/countryCodes";
import { PERU_DEPARTMENTS, DISTRICT_SUGGESTIONS } from "@/lib/peruLocations";
import {
  sanitizeName, sanitizeDigits, sanitizeDni, sanitizeEmail,
  isValidName, isValidPhone, isValidDni, isValidEmail,
  NAME_ERROR, PHONE_ERROR, DNI_ERROR, EMAIL_ERROR,
} from "@/lib/validators";
import { findDuplicateClient } from "@/lib/clientSync";

export default function NewClient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dni, setDni] = useState("");
  const [reference, setReference] = useState("");

  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [exactAddress, setExactAddress] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);

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

  const validate = () => {
    if (!firstName.trim() || !isValidName(firstName)) {
      toast({ title: "Nombre inválido", description: NAME_ERROR, variant: "destructive" });
      return false;
    }
    if (!lastName.trim() || !isValidName(lastName)) {
      toast({ title: "Apellido inválido", description: NAME_ERROR, variant: "destructive" });
      return false;
    }
    if (!isValidPhone(phoneNumber)) {
      toast({ title: "Celular inválido", description: PHONE_ERROR, variant: "destructive" });
      return false;
    }
    if (dni.trim() && !isValidDni(dni)) {
      toast({ title: "Documento inválido", description: DNI_ERROR, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      const dup = await findDuplicateClient(user.id, {
        dni: dni.trim() || null,
        phone: phoneNumber.trim() || null,
      });
      if (dup) {
        const fullName = `${dup.first_name} ${dup.last_name || ""}`.trim();
        toast({
          title: "Cliente ya registrado",
          description: `${fullName} ya existe en tu cartera (${dup.matched === "dni" ? "mismo DNI" : "mismo celular"}).`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          phone_country_code: phoneCountryCode,
          phone_number: phoneNumber.trim(),
          dni: dni.trim().toUpperCase() || null,
          address: composedAddress || null,
          reference: reference.trim() || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      setCreated({ id: (data as any).id, name: `${firstName.trim()} ${lastName.trim()}`.trim() });
      toast({ title: "Cliente creado", description: "Se guardó correctamente" });
    } catch (e: any) {
      console.error(e);
      const msg = e?.code === "23505"
        ? "Ya existe un cliente con ese DNI o celular."
        : "No se pudo guardar el cliente";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  if (created) {
    return (
      <AppLayout>
        <div className="px-4 py-10 max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fintech-card p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 220 }}
              className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-4"
            >
              <Check className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h1 className="text-xl font-bold mb-1">Cliente creado correctamente</h1>
            <p className="text-sm text-muted-foreground mb-6">{created.name}</p>

            <div className="text-sm text-muted-foreground mb-4">
              ¿Deseas registrar una operación para este cliente?
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => navigate("/new-loan")}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar operación
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/portfolio")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a clientes
              </Button>
            </div>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-muted/50 active:scale-95 transition-all"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Nuevo cliente</h1>
              <p className="text-xs text-muted-foreground leading-tight">Registra una persona en tu cartera</p>
            </div>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fintech-card p-4 space-y-4"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5" /> Datos personales
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName" className="text-xs">Nombres</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(sanitizeName(e.target.value))}
                placeholder="Juan Carlos"
                autoComplete="given-name"
                aria-invalid={firstName.length > 0 && !isValidName(firstName)}
              />
              {firstName.length > 0 && !isValidName(firstName) && (
                <p className="text-[11px] text-destructive mt-1">{NAME_ERROR}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName" className="text-xs">Apellidos</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(sanitizeName(e.target.value))}
                placeholder="Pérez Soto"
                autoComplete="family-name"
                aria-invalid={lastName.length > 0 && !isValidName(lastName)}
              />
              {lastName.length > 0 && !isValidName(lastName) && (
                <p className="text-[11px] text-destructive mt-1">{NAME_ERROR}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Celular</Label>
            <div className="flex gap-2">
              <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(sanitizeDigits(e.target.value))}
                placeholder="987654321"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={15}
                className="flex-1"
                aria-invalid={phoneNumber.length > 0 && !isValidPhone(phoneNumber)}
              />
            </div>
            {phoneNumber.length > 0 && !isValidPhone(phoneNumber) && (
              <p className="text-[11px] text-destructive mt-1">{PHONE_ERROR}</p>
            )}
          </div>

          <div>
            <Label htmlFor="dni" className="text-xs flex items-center gap-1"><IdCard className="w-3 h-3" /> DNI / CE <span className="text-muted-foreground normal-case">(opcional)</span></Label>
            <Input
              id="dni"
              value={dni}
              onChange={(e) => setDni(sanitizeDni(e.target.value))}
              placeholder="12345678"
              inputMode="text"
              maxLength={12}
              aria-invalid={dni.length > 0 && !isValidDni(dni)}
            />
            {dni.length > 0 && !isValidDni(dni) && (
              <p className="text-[11px] text-destructive mt-1">{DNI_ERROR}</p>
            )}
          </div>

          <div>
            <Label htmlFor="reference" className="text-xs">Referencia <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Vecino, compañero de trabajo..." />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="fintech-card p-4 space-y-3"
        >
          <Collapsible open={showAddress} onOpenChange={setShowAddress}>
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> Ubicación <span className="normal-case lowercase">(opcional)</span>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Departamento</Label>
                  <Select value={department} onValueChange={(v) => { setDepartment(v); setProvince(""); setDistrict(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {PERU_DEPARTMENTS.map((d) => (
                        <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Provincia</Label>
                  <Select value={province} onValueChange={(v) => { setProvince(v); setDistrict(""); }} disabled={!department}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {provincesForDept.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Distrito</Label>
                <Popover open={districtOpen} onOpenChange={setDistrictOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!province}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-50"
                    >
                      <span className={district ? "" : "text-muted-foreground"}>{district || "Selecciona o escribe"}</span>
                      <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                    <Command>
                      <CommandInput placeholder="Buscar distrito..." value={district} onValueChange={setDistrict} />
                      <CommandList>
                        <CommandEmpty>Sin sugerencias. Usa lo escrito.</CommandEmpty>
                        <CommandGroup>
                          {districtSuggestions.map((d) => (
                            <CommandItem key={d} value={d} onSelect={(v) => { setDistrict(v); setDistrictOpen(false); }}>
                              {d}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-xs">Dirección exacta</Label>
                <Input value={exactAddress} onChange={(e) => setExactAddress(e.target.value)} placeholder="Av. siempre viva 123" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.section>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 h-12"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Guardar cliente
        </Button>
      </div>
    </AppLayout>
  );
}
