// Veloura Manager V2 — ID generation helper
// Calls the generate_business_id RPC which is backed by the id_sequences
// table. Returns human-readable IDs like BAT-000001, SAL-000001, etc.

import { supabase } from '../lib/supabase';

export async function generateBusinessIdRpc(prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_business_id', { p_prefix: prefix });
  if (error) throw error;
  if (!data || typeof data !== 'string') {
    throw new Error(`Failed to generate business ID for prefix ${prefix}`);
  }
  return data as string;
}
