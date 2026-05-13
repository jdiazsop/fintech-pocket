import { supabase } from "@/integrations/supabase/client";

export interface ClientSyncPayload {
  first_name: string;
  last_name: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  dni: string | null;
  address: string | null;
  reference: string | null;
}

/**
 * Idempotent sync of a contact into the `clients` table.
 * Matches by (user_id, dni) or (user_id, phone_number) — backed by partial unique indexes
 * `clients_user_dni_unique` and `clients_user_phone_unique`. Returns the client row id.
 *
 * Strategy: lookup → update | insert. If a concurrent insert wins the race and we hit a
 * unique-violation (Postgres 23505), we retry the lookup-then-update path once.
 */
export async function upsertClient(
  userId: string,
  raw: ClientSyncPayload,
): Promise<string | null> {
  const payload: ClientSyncPayload = {
    first_name: raw.first_name?.trim() || "",
    last_name: raw.last_name?.trim() || null,
    phone_country_code: raw.phone_country_code?.trim() || null,
    phone_number: raw.phone_number?.trim() || null,
    dni: raw.dni?.trim() || null,
    address: raw.address?.trim() || null,
    reference: raw.reference?.trim() || null,
  };
  if (!payload.first_name) return null;

  const findExisting = async () => {
    const filters: string[] = [];
    if (payload.dni) filters.push(`dni.eq.${payload.dni}`);
    if (payload.phone_number) filters.push(`phone_number.eq.${payload.phone_number}`);
    if (filters.length === 0) return null;
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .or(filters.join(","))
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id || null;
  };

  const existingId = await findExisting();
  if (existingId) {
    const { error } = await supabase.from("clients").update(payload).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("clients")
    .insert({ user_id: userId, ...payload } as any)
    .select("id")
    .single();

  if (!insErr) return (inserted as any).id;

  // Race: another insert created the row between lookup and insert. Re-resolve and update.
  if ((insErr as any).code === "23505") {
    const racedId = await findExisting();
    if (racedId) {
      await supabase.from("clients").update(payload).eq("id", racedId);
      return racedId;
    }
  }
  throw insErr;
}

/**
 * Returns the existing client row (id + name) if a contact with the same DNI
 * or phone is already registered for this user. Used to block duplicate creation.
 * `excludeId` lets you ignore the current row when editing.
 */
export async function findDuplicateClient(
  userId: string,
  opts: { dni?: string | null; phone?: string | null; excludeId?: string | null },
): Promise<{ id: string; first_name: string; last_name: string | null; matched: "dni" | "phone" } | null> {
  const dni = opts.dni?.trim() || null;
  const phone = opts.phone?.trim() || null;
  if (!dni && !phone) return null;

  const filters: string[] = [];
  if (dni) filters.push(`dni.eq.${dni}`);
  if (phone) filters.push(`phone_number.eq.${phone}`);

  let query = supabase
    .from("clients")
    .select("id, first_name, last_name, dni, phone_number")
    .eq("user_id", userId)
    .or(filters.join(","));
  if (opts.excludeId) query = query.neq("id", opts.excludeId);

  const { data } = await query.limit(1);
  const row = (data as any[])?.[0];
  if (!row) return null;
  const matched: "dni" | "phone" = dni && row.dni === dni ? "dni" : "phone";
  return { id: row.id, first_name: row.first_name, last_name: row.last_name, matched };
}
