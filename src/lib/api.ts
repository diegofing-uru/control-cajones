import { DEMO, ErrorDemo, demo } from './demo';
import { supabase } from './supabase';
import type { Direccion, Movimiento, NuevoMovimiento, Perfil, Resumen } from './types';

/** Error de negocio (validación del servidor) — no tiene sentido reintentarlo */
export class ErrorNegocio extends Error {}

/** En modo demo, los errores de validación se tratan igual que los del servidor */
async function viaDemo<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorDemo) throw new ErrorNegocio(e.message);
    throw e;
  }
}

function lanzar(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === 'P0001' || error.code === '23505') throw new ErrorNegocio(error.message);
  throw new Error(error.message);
}

export async function listarPendientes(): Promise<Direccion[]> {
  if (DEMO) return viaDemo(() => demo.listarPendientes());
  const { data, error } = await supabase
    .from('vista_direcciones')
    .select('*')
    .eq('estado', 'pendiente')
    .order('ultima_entrega_en', { ascending: true });
  lanzar(error);
  return data ?? [];
}

export async function buscarDirecciones(texto: string): Promise<Direccion[]> {
  if (DEMO) return viaDemo(() => demo.buscarDirecciones(texto));
  const q = texto.trim().replace(/[%,()]/g, ' ');
  if (!q) return [];
  const { data, error } = await supabase
    .from('vista_direcciones')
    .select('*')
    .or(`calle.ilike.%${q}%,contacto_nombre.ilike.%${q}%`)
    .order('estado', { ascending: false })
    .limit(20);
  lanzar(error);
  return data ?? [];
}

export async function obtenerDireccion(id: string): Promise<Direccion | null> {
  if (DEMO) return viaDemo(() => demo.obtenerDireccion(id));
  const { data, error } = await supabase.from('vista_direcciones').select('*').eq('id', id).maybeSingle();
  lanzar(error);
  return data;
}

export async function actualizarContacto(
  id: string,
  campos: Pick<Direccion, 'referencia' | 'contacto_nombre' | 'contacto_telefono' | 'destino_previsto'>,
): Promise<void> {
  if (DEMO) return viaDemo(() => demo.actualizarContacto(id, campos));
  const { error } = await supabase.from('direcciones').update(campos).eq('id', id);
  lanzar(error);
}

export async function movimientosDeDireccion(id: string): Promise<Movimiento[]> {
  if (DEMO) return viaDemo(() => demo.movimientosDeDireccion(id));
  const { data, error } = await supabase
    .from('vista_movimientos')
    .select('*')
    .eq('direccion_id', id)
    .order('creado_en', { ascending: false });
  lanzar(error);
  return data ?? [];
}

export async function historial(usuarioId?: string): Promise<Movimiento[]> {
  if (DEMO) return viaDemo(() => demo.historial(usuarioId));
  let consulta = supabase.from('vista_movimientos').select('*').order('creado_en', { ascending: false }).limit(150);
  if (usuarioId) consulta = consulta.eq('usuario_id', usuarioId);
  const { data, error } = await consulta;
  lanzar(error);
  return data ?? [];
}

export async function registrarMovimiento(m: NuevoMovimiento): Promise<void> {
  if (DEMO) return viaDemo(() => demo.registrarMovimiento(m));
  if (m.tipo === 'mudanza') {
    const { error } = await supabase.rpc('registrar_mudanza', {
      p_client_id: m.client_id,
      p_origen_id: m.direccion_id,
      p_cajas: m.cajas,
      p_cajones: m.cajones,
      p_destino_id: m.destino_id ?? null,
      p_destino_calle: m.destino_calle ?? null,
      p_destino_referencia: m.destino_referencia ?? null,
      p_nota: m.nota ?? null,
      p_registrado_en: m.registrado_en,
    });
    lanzar(error);
    return;
  }
  const { error } = await supabase.rpc('registrar_movimiento', {
    p_client_id: m.client_id,
    p_tipo: m.tipo,
    p_cajas: m.cajas,
    p_cajones: m.cajones,
    p_direccion_id: m.direccion_id ?? null,
    p_calle: m.calle ?? null,
    p_referencia: m.referencia ?? null,
    p_nota: m.nota ?? null,
    p_registrado_en: m.registrado_en,
    p_destino_previsto: m.destino_previsto ?? null,
  });
  lanzar(error);
}

export async function anularMovimiento(id: string, motivo: string): Promise<void> {
  if (DEMO) return viaDemo(() => demo.anularMovimiento(id, motivo));
  const { error } = await supabase.rpc('anular_movimiento', { p_movimiento_id: id, p_motivo: motivo });
  lanzar(error);
}

export async function resumenPanel(): Promise<Resumen> {
  if (DEMO) return viaDemo(() => demo.resumenPanel());
  const { data, error } = await supabase.rpc('resumen_panel').single();
  lanzar(error);
  const r = data as Record<string, number | string>;
  return {
    cajas_afuera: Number(r.cajas_afuera),
    cajones_afuera: Number(r.cajones_afuera),
    direcciones_pendientes: Number(r.direcciones_pendientes),
    direcciones_atrasadas: Number(r.direcciones_atrasadas),
    dias_alerta: Number(r.dias_alerta),
    cuentas_pendientes: Number(r.cuentas_pendientes),
  };
}

export async function guardarDiasAlerta(dias: number): Promise<void> {
  if (DEMO) return viaDemo(() => demo.guardarDiasAlerta(dias));
  const { error } = await supabase.from('configuracion').update({ dias_alerta: dias }).eq('id', true);
  lanzar(error);
}

export async function obtenerPerfil(id: string): Promise<Perfil | null> {
  if (DEMO) return viaDemo(() => demo.obtenerPerfil(id));
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', id).maybeSingle();
  lanzar(error);
  return data;
}

export async function listarUsuarios(): Promise<Perfil[]> {
  if (DEMO) return viaDemo(() => demo.listarUsuarios());
  const { data, error } = await supabase.from('perfiles').select('*').order('nombre');
  lanzar(error);
  return data ?? [];
}

export async function actualizarUsuario(
  id: string,
  cambios: Partial<Pick<Perfil, 'rol' | 'activo' | 'pendiente'>>,
): Promise<void> {
  if (DEMO) return viaDemo(() => demo.actualizarUsuario(id, cambios));
  const { error } = await supabase.from('perfiles').update(cambios).eq('id', id);
  lanzar(error);
}

export const aprobarUsuario = (id: string) => actualizarUsuario(id, { activo: true, pendiente: false });
export const rechazarUsuario = (id: string) => actualizarUsuario(id, { activo: false, pendiente: false });

export async function restablecerContrasena(usuarioId: string, password: string): Promise<void> {
  if (DEMO) return viaDemo(() => demo.restablecerContrasena(usuarioId, password));
  const { data, error } = await supabase.functions.invoke('restablecer-contrasena', {
    body: { usuario_id: usuarioId, password },
  });
  if (error) {
    let mensaje = 'No se pudo cambiar la contraseña.';
    try {
      const cuerpo = await (error as { context?: Response }).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {}
    throw new ErrorNegocio(mensaje);
  }
  if (data?.error) throw new ErrorNegocio(data.error);
}
