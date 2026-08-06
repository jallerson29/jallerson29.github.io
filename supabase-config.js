import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/**
 * Cole abaixo apenas os valores públicos do seu projeto Supabase:
 * - Project URL
 * - Publishable/anon key
 *
 * Nunca coloque a service_role key no site.
 */
export const SUPABASE_URL = 'COLE_AQUI_A_PROJECT_URL';
export const SUPABASE_ANON_KEY = 'COLE_AQUI_A_PUBLISHABLE_KEY';
export const MEDIA_BUCKET = 'apollus-media';

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('COLE_AQUI') &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes('COLE_AQUI');

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function mediaUrl(path) {
  if (!path || !supabase) return '';
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}
