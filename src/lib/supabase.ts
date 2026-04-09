/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    supabase = null;
  }
} else {
  console.warn('Supabase credentials missing. Frontend storage will be file-based only.');
}

export const isSupabaseEnabled = (): boolean => {
  return supabase !== null && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};

export type SupabaseRow = Record<string, any>;

export async function fetchTable<T = any>(table: string, columns = '*'): Promise<T[]> {
  if (!supabase || !isSupabaseEnabled()) return [];
  try {
    const { data, error } = await supabase.from(table).select(columns);
    if (error) {
      console.error(`Supabase select error on ${table}:`, error.message);
      return [];
    }
    return (data as T[]) || [];
  } catch (error) {
    console.error(`Supabase fetch error on ${table}:`, error);
    return [];
  }
}

export async function upsertTable<T = any>(table: string, rows: any[]): Promise<T[] | null> {
  if (!supabase || !isSupabaseEnabled()) return null;
  try {
    const { data, error } = await supabase.from(table).upsert(rows as any, { onConflict: 'id' });
    if (error) {
      console.error(`Supabase upsert error on ${table}:`, error.message);
      return null;
    }
    return (data as T[]) || null;
  } catch (error) {
    console.error(`Supabase upsert error on ${table}:`, error);
    return null;
  }
}

export async function deleteRow(table: string, id: string): Promise<boolean> {
  if (!supabase || !isSupabaseEnabled()) return false;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error(`Supabase delete error on ${table} id=${id}:`, error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Supabase delete error on ${table} id=${id}:`, error);
    return false;
  }
}

export async function deleteAll(table: string): Promise<boolean> {
  if (!supabase || !isSupabaseEnabled()) return false;
  try {
    const { error } = await supabase.from(table).delete().neq('id', '');
    if (error) {
      console.error(`Supabase delete all error on ${table}:`, error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Supabase delete all error on ${table}:`, error);
    return false;
  }
}

export async function subscribeToTable<T = any>(
  table: string,
  callback: (payload: { eventType: string; new?: T; old?: T }) => void,
): Promise<() => Promise<void>> {
  if (!supabase || !isSupabaseEnabled()) {
    return async () => {};
  }

  try {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callback({ eventType: payload.eventType, new: payload.new as T, old: payload.old as T });
      });

    await channel.subscribe();

    return async () => {
      await supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error(`Supabase subscription error on ${table}:`, error);
    return async () => {};
  }
}
