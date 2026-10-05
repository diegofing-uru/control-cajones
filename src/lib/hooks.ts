import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO, suscribirDemo } from './demo';
import { leerCola, leerRechazos, suscribirCola, type Rechazado } from './colaOffline';
import { supabase } from './supabase';

/**
 * Carga datos al enfocar la pantalla y cada vez que cambian
 * las tablas indicadas en Supabase (tiempo real).
 */
export function useDatos<T>(cargar: () => Promise<T>, tablas: string[] = ['direcciones', 'movimientos']) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const recargar = useCallback(async (manual = false) => {
    if (manual) setRefrescando(true);
    try {
      setDatos(await cargarRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
    } finally {
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const claveTablas = tablas.join(',');
  useEffect(() => {
    if (DEMO) return suscribirDemo(() => recargar());
    const canal = supabase.channel(`cambios-${claveTablas}-${Math.random().toString(36).slice(2)}`);
    for (const tabla of claveTablas.split(',')) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => recargar());
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [claveTablas, recargar]);

  return { datos, error, refrescando, recargar: () => recargar(true) };
}

/** Estado de la cola offline para mostrar avisos */
export function useCola() {
  const [pendientes, setPendientes] = useState(0);
  const [rechazos, setRechazos] = useState<Rechazado[]>([]);
  useEffect(() => {
    const actualizar = async () => {
      setPendientes((await leerCola()).length);
      setRechazos(await leerRechazos());
    };
    actualizar();
    return suscribirCola(actualizar);
  }, []);
  return { pendientes, rechazos };
}

export function useDebounce<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
