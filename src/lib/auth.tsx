import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { obtenerPerfil } from './api';
import { DEMO, demo } from './demo';
import { interpretarIdentificador } from './identificador';
import { supabase } from './supabase';
import type { Perfil } from './types';

export type ResultadoRegistro =
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'pendiente' } // cuenta creada, espera aprobación
  | { tipo: 'admin' }; // primera cuenta del sistema: entra directo como administrador

interface Auth {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  esAdmin: boolean;
  ingresar: (identificador: string, password: string) => Promise<string | null>;
  registrarse: (nombre: string, identificador: string, password: string) => Promise<ResultadoRegistro>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Auth | null>(null);

export const MENSAJE_PENDIENTE = 'Tu cuenta está esperando que un administrador la apruebe.';
const MENSAJE_INACTIVO = 'Tu cuenta está desactivada. Hablá con un administrador.';

/** null si el perfil puede usar la app; si no, el motivo */
function motivoBloqueo(p: Perfil | null): string | null {
  if (!p) return null;
  if (p.pendiente) return MENSAJE_PENDIENTE;
  if (!p.activo) return MENSAJE_INACTIVO;
  return null;
}

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
      if (motivoBloqueo(p)) {
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

  const ingresar = useCallback(async (identificador: string, password: string) => {
    const id = interpretarIdentificador(identificador);
    if (typeof id === 'string') return id;

    if (DEMO) {
      const r = await demo.ingresar(id, password);
      if (typeof r === 'string') return r;
      setSession({ user: { id: r.id } } as Session);
      setPerfil(r);
      return null;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ ...id, password });
    if (error) return 'email' in id ? 'Email o contraseña incorrectos.' : 'Celular o contraseña incorrectos.';
    const motivo = motivoBloqueo(await obtenerPerfil(data.user.id).catch(() => null));
    if (motivo) {
      await supabase.auth.signOut();
      return motivo;
    }
    return null;
  }, []);

  const registrarse = useCallback(
    async (nombre: string, identificador: string, password: string): Promise<ResultadoRegistro> => {
      if (nombre.trim().length < 3) return { tipo: 'error', mensaje: 'Escribí tu nombre y apellido.' };
      if (password.length < 8) return { tipo: 'error', mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
      const id = interpretarIdentificador(identificador);
      if (typeof id === 'string') return { tipo: 'error', mensaje: id };

      if (DEMO) {
        const r = await demo.registrarse(nombre.trim(), id, password);
        return typeof r === 'string' ? { tipo: 'error', mensaje: r } : { tipo: 'pendiente' };
      }

      const { data, error } = await supabase.auth.signUp({
        ...id,
        password,
        options: { data: { nombre: nombre.trim() } },
      });
      if (error) {
        const yaExiste = /already|registered|exists/i.test(error.message);
        return {
          tipo: 'error',
          mensaje: yaExiste ? 'Ya hay una cuenta con ese email o celular.' : 'No se pudo crear la cuenta. Probá de nuevo.',
        };
      }
      if (!data.user) return { tipo: 'error', mensaje: 'No se pudo crear la cuenta. Probá de nuevo.' };

      const p = await obtenerPerfil(data.user.id).catch(() => null);
      if (p && p.activo && !p.pendiente) return { tipo: 'admin' }; // primera cuenta: queda adentro
      await supabase.auth.signOut();
      return { tipo: 'pendiente' };
    },
    [],
  );

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
      value={{ cargando, session, perfil, esAdmin: perfil?.rol === 'administrador', ingresar, registrarse, salir }}
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
