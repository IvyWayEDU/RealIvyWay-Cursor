 'use server';
 
 import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
 
 export type ResolvedSchool = {
   id: string;
   name: string;
   normalized: string;
 };
 
 export function normalizeSchoolInput(input: string): { name: string; normalized: string } {
   const name = String(input ?? '').trim();
   const normalized = name.toLowerCase();
   return { name, normalized };
 }
 
 /**
  * Resolve a school row by normalized name, inserting if needed.
  *
  * Requirements:
  * - normalized = lowercase(trim(input))
  * - SELECT id FROM schools WHERE normalized_name = normalized
  * - INSERT INTO schools (name, normalized_name) VALUES (input, normalized) RETURNING id
  */
 export async function resolveOrCreateSchoolByName(input: string): Promise<ResolvedSchool> {
   const { name, normalized } = normalizeSchoolInput(input);
   if (!name) {
     throw new Error('[resolveOrCreateSchoolByName] Missing school name');
   }
 
   const supabase = getSupabaseAdmin();
 
   const { data: existing, error: existingErr } = await supabase
     .from('schools')
     .select('id, name')
     .eq('normalized_name', normalized)
     .maybeSingle();
   if (existingErr) throw existingErr;
 
   if (existing?.id) {
     return { id: String(existing.id), name: typeof existing.name === 'string' && existing.name.trim() ? existing.name.trim() : name, normalized };
   }
 
   const { data: inserted, error: insertErr } = await supabase
     .from('schools')
     .insert({ name, normalized_name: normalized } as any)
     .select('id, name')
     .single();
   if (insertErr) throw insertErr;
 
   return {
     id: String((inserted as any)?.id),
     name: typeof (inserted as any)?.name === 'string' && (inserted as any).name.trim() ? (inserted as any).name.trim() : name,
     normalized,
   };
 }
