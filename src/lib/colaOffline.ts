import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { ErrorNegocio, registrarMovimiento } from './api';
import { DEMO } from './demo';
import type { NuevoMovimiento } from './types';

// En web alcanza con navigator.onLine; evita pedidos de prueba de conectividad
if (Platform.OS === 'web') NetInfo.configure({ reachabilityShouldRun: () => false });

// La demo y la app real pueden compartir dominio (y localStorage): claves separadas
// para que un movimiento de prueba nunca se envíe a la base real
const PREFIJO = DEMO ? 'demo-' : '';
const CLAVE = `${PREFIJO}cola-movimientos-v1`;
const CLAVE_RECHAZOS = `${PREFIJO}movimientos-rechazados-v1`;

export interface Rechazado {
  movimiento: NuevoMovimiento;
  motivo: string;
}

type Oyente = () => void;
const oyentes = new Set<Oyente>();
const avisar = () => oyentes.forEach((o) => o());

export function suscribirCola(o: Oyente) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

async function leer<T>(clave: string): Promise<T[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(clave)) ?? '[]');
  } catch {
    return [];
  }
}

export const leerCola = () => leer<NuevoMovimiento>(CLAVE);
export const leerRechazos = () => leer<Rechazado>(CLAVE_RECHAZOS);

export async function descartarRechazos() {
  await AsyncStorage.removeItem(CLAVE_RECHAZOS);
  avisar();
}

/**
 * Intenta enviar el movimiento. Si no hay señal, lo guarda en la cola y devuelve 'en-cola'.
 * Los errores de negocio (ej: saldo insuficiente) se propagan para mostrarlos en pantalla.
 */
export async function enviarOEncolar(m: NuevoMovimiento): Promise<'enviado' | 'en-cola'> {
  const red = await NetInfo.fetch();
  if (red.isConnected === false) {
    await encolar(m);
    return 'en-cola';
  }
  try {
    await registrarMovimiento(m);
    return 'enviado';
  } catch (e) {
    if (e instanceof ErrorNegocio) throw e;
    await encolar(m); // error de red u otro transitorio
    return 'en-cola';
  }
}

async function encolar(m: NuevoMovimiento) {
  const cola = await leerCola();
  cola.push(m);
  await AsyncStorage.setItem(CLAVE, JSON.stringify(cola));
  avisar();
}

let sincronizando = false;

/** Envía los movimientos pendientes en orden. Es seguro reintentar: el servidor ignora duplicados. */
export async function sincronizar(): Promise<void> {
  if (sincronizando) return;
  sincronizando = true;
  try {
    let cola = await leerCola();
    while (cola.length > 0) {
      const [primero, ...resto] = cola;
      try {
        await registrarMovimiento(primero!);
      } catch (e) {
        if (!(e instanceof ErrorNegocio)) break; // sin red: se reintenta más tarde
        const rechazos = await leerRechazos();
        rechazos.push({ movimiento: primero!, motivo: e.message });
        await AsyncStorage.setItem(CLAVE_RECHAZOS, JSON.stringify(rechazos));
      }
      cola = resto;
      await AsyncStorage.setItem(CLAVE, JSON.stringify(cola));
      avisar();
    }
  } finally {
    sincronizando = false;
  }
}

/** Sincroniza cada vez que vuelve la conexión */
export function iniciarSincronizacionAutomatica() {
  sincronizar();
  return NetInfo.addEventListener((estado) => {
    if (estado.isConnected) sincronizar();
  });
}
