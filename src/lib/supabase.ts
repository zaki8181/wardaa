import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyQuery = any;

export async function fetchAllPaginated<T>(
  tableName: string,
  buildQuery: (q: AnyQuery) => AnyQuery,
  batchSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  for (;;) {
    const { data, error } = await buildQuery(supabase.from(tableName))
      .range(start, start + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < batchSize) break;
    start += batchSize;
  }
  return all;
}

export async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
  session: { access_token: string },
): Promise<{ data?: unknown; error?: string }> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        Apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      return { error: json.error || `خطأ ${res.status}` };
    }
    return { data: json };
  } catch {
    return { error: 'تعذّر الاتصال بالخادم' };
  }
}
