import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';
import type { Perfil } from './types';

interface ContextoAuth {
  sessao: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<ContextoAuth>({
  sessao: null,
  perfil: null,
  carregando: true,
  recarregarPerfil: async () => {},
  sair: async () => {},
});

function comTimeout<T>(promessa: Promise<T>, ms: number) {
  return Promise.race([
    promessa,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]);
}

async function encerrarSessaoInvalida() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Sem sessão no servidor (conta apagada): limpa só o aparelho.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscarPerfil = useCallback(async (userId: string, obrigatorio = false) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, municipios(*)')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) {
      if (obrigatorio) setPerfil(null);
      return false;
    }
    // Mantém o mesmo objeto quando nada mudou: a releitura periódica não pode
    // reiniciar efeitos das telas que dependem do perfil.
    setPerfil((atual) => {
      const novo = data as Perfil;
      return atual && JSON.stringify(atual) === JSON.stringify(novo) ? atual : novo;
    });
    return true;
  }, []);

  const aplicarSessao = useCallback(
    async (session: Session | null) => {
      if (!session) {
        setSessao(null);
        setPerfil(null);
        return;
      }
      try {
        const { data: userData, error: userError } = await comTimeout(supabase.auth.getUser(), 8000);
        if (userError || !userData.user) {
          await encerrarSessaoInvalida();
          setSessao(null);
          setPerfil(null);
          return;
        }
        const ok = await comTimeout(buscarPerfil(userData.user.id, true), 8000);
        if (!ok) {
          await encerrarSessaoInvalida();
          setSessao(null);
          setPerfil(null);
          return;
        }
        setSessao(session);
      } catch {
        await encerrarSessaoInvalida();
        setSessao(null);
        setPerfil(null);
      }
    },
    [buscarPerfil]
  );

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      try {
        const resultado = await comTimeout(supabase.auth.getSession(), 8000);
        if (!ativo) return;
        await comTimeout(aplicarSessao(resultado.data.session), 12000);
      } catch {
        if (ativo) {
          await encerrarSessaoInvalida();
          setSessao(null);
          setPerfil(null);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    iniciar();

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      // getSession() já trata a sessão inicial; este evento duplicado deixava a tela presa.
      if (evento === 'INITIAL_SESSION') return;
      if (evento === 'SIGNED_OUT' || !novaSessao) {
        setSessao(null);
        setPerfil(null);
        return;
      }
      setTimeout(() => {
        void aplicarSessao(novaSessao);
      }, 0);
    });

    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [aplicarSessao]);

  useEffect(() => {
    const userId = sessao?.user.id;
    if (!userId) return;

    const atualizar = () => {
      void buscarPerfil(userId);
    };

    const canal = supabase
      .channel(`perfil-atual-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        atualizar
      )
      .subscribe();

    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') atualizar();
    });

    const aoFicarVisivel = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        atualizar();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', aoFicarVisivel);
    }

    const intervalo = setInterval(atualizar, 8000);

    return () => {
      void supabase.removeChannel(canal);
      app.remove();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', aoFicarVisivel);
      }
      clearInterval(intervalo);
    };
  }, [sessao?.user.id, buscarPerfil]);

  const recarregarPerfil = useCallback(async () => {
    if (sessao) await buscarPerfil(sessao.user.id);
  }, [sessao, buscarPerfil]);

  const sair = useCallback(async () => {
    await encerrarSessaoInvalida();
    setSessao(null);
    setPerfil(null);
  }, []);

  const valor = useMemo(
    () => ({ sessao, perfil, carregando, recarregarPerfil, sair }),
    [sessao, perfil, carregando, recarregarPerfil, sair]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
