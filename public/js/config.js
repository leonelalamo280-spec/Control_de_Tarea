// Configuración de Supabase.
// En local: copiá .env.example como .env.local y completá las variables.
// En Vercel: agregá las mismas variables en Project Settings > Environment Variables.
// Nunca uses la clave service_role/secret en el navegador.
const env = import.meta.env || {};
export const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://xzahmeckmiuzxdshexux.supabase.co";
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_TLV3x7WTtxg7bpl_LARx-A_gJ2EvTyL";
export const USE_LOCAL_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
