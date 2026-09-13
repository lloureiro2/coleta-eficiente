import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const chaveAnonima = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Indica se as variáveis de ambiente do Supabase foram preenchidas (.env). */
export const supabaseConfigurado = url.length > 0 && chaveAnonima.length > 0;

export const supabase = createClient(
  url || 'https://exemplo-nao-configurado.supabase.co',
  chaveAnonima || 'chave-nao-configurada',
  {
    auth: {
      // No celular a sessão é guardada no AsyncStorage; no site, no localStorage (padrão).
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
