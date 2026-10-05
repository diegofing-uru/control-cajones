import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { obtenerPerfil } from './api';
import { DEMO, demo } from './demo';
import { supabase } from './supabase';
import type { Perfil } from './types';

interface Auth {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  esAdmin: boolean;
  ingresar: (email: string, password: string) => Promise<string | null>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      return;
    }
    try {
      const p = await obtenerPerfil(s.user.id);
      if (p && !p.activo) {
        await supabase.auth.signOut();
        setPerfil(null);
        return;
      }
      setPerfil(p);
    } catch {
      // sin conexión: se mantiene la sesión y se reintenta en el próximo cambio
    }
  }, []);

  useEffect(() => {
    if (DEMO) {
      setCargando(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
      cargarPerfil(s);
    });
    return () => data.subscription.unsubscribe();
  }, [cargarPerfil]);

  const ingresar = useCallback(async (email: string, password: string) => {
    if (DEMO) {
      const r = await demo.ingresar(email, password);
      if (typeof r === 'string') return r;
      setSession({ user: { id: r.id } } as Session);
      setPerfil(r);
      return null;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return 'Email o contraseña incorrectos.';
    const p = await obtenerPerfil(data.user.id).catch(() => null);
    if (p && !p.activo) {
      await supabase.auth.signOut();
      return 'Tu usuario está desactivado. Hablá con un administrador.';
    }
    return null;
  }, []);

  const salir = useCallback(async () => {
    if (DEMO) {
      demo.salir();
      setSession(null);
      setPerfil(null);
      return;
    }
    await supabase.auth.signOut();
  }, []);

  return (
    <Contexto.Provider
      value={{ cargando, session, perfil, esAdmin: perfil?.rol === 'administrador', ingresar, salir }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useAuth(): Auth {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
