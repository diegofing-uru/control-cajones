/**
 * Modo demo: un backend falso en el dispositivo que replica las reglas de la base de datos
 * (validación de saldo, anulaciones, usuarios inactivos). Sirve para probar la app sin Supabase.
 * Se activa con EXPO_PUBLIC_DEMO=1.
 */
import type { Direccion, Movimiento, NuevoMovimiento, Perfil, Resumen, Rol } from './types';
import { uuid } from './uuid';

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export class ErrorDemo extends Error {}

type DireccionBase = Omit<Direccion, 'dias_pendiente' | 'atrasada'>;
type MovBase = Omit<Movimiento, 'calle' | 'usuario_nombre' | 'anulado'>;

interface Estado {
  version: number;
  perfiles: (Perfil & { email: string; password: string })[];
  direcciones: DireccionBase[];
  movimientos: MovBase[];
  diasAlerta: number;
}

const CLAVE = 'demo-control-cajones-v1';
const DIA = 86400000;

export const USUARIOS_DEMO = [
  { email: 'admin@demo.uy', password: 'demo1234', nombre: 'Marcela Silva', rol: 'administrador' as Rol },
  { email: 'juan@demo.uy', password: 'demo1234', nombre: 'Juan Rodríguez', rol: 'operario' as Rol },
];

function hace(dias: number, horas = 0) {
  return new Date(Date.now() - dias * DIA - horas * 3600000).toISOString();
}

function semilla(): Estado {
  const p = USUARIOS_DEMO.map((u) => ({ id: uuid(), telefono: null, activo: true, ...u }));
  p.push({ id: uuid(), email: 'nico@demo.uy', password: 'demo1234', nombre: 'Nicolás Pereira', rol: 'operario', telefono: null, activo: true });
  const [marcela, juan, nico] = p as [typeof p[0], typeof p[0], typeof p[0]];

  const direcciones: DireccionBase[] = [];
  const movimientos: MovBase[] = [];

  const dir = (calle: string, extra: Partial<DireccionBase> = {}) => {
    const d: DireccionBase = {
      id: uuid(), calle, referencia: null, contacto_nombre: null, contacto_telefono: null,
      saldo_cajas: 0, saldo_cajones: 0, estado: 'completada', ultima_entrega_en: null, creada_en: hace(40), ...extra,
    };
    direcciones.push(d);
    return d;
  };
  const mov = (d: DireccionBase, usuario: Perfil, tipo: 'entrega' | 'retiro', cajas: number, cajones: number, fecha: string, nota: string | null = null) => {
    movimientos.push({
      id: uuid(), client_id: uuid(), direccion_id: d.id, usuario_id: usuario.id, tipo, cajas, cajones,
      origen: 'app', nota, anula_id: null, registrado_en: fecha, creado_en: fecha,
    });
    const s = tipo === 'entrega' ? 1 : -1;
    d.saldo_cajas += s * cajas;
    d.saldo_cajones += s * cajones;
    if (tipo === 'entrega') d.ultima_entrega_en = fecha;
    d.estado = d.saldo_cajas + d.saldo_cajones === 0 ? 'completada' : 'pendiente';
  };

  const a = dir('Av. Italia 2345', { referencia: 'Apto 302', contacto_nombre: 'Laura Méndez', contacto_telefono: '099 123 456' });
  mov(a, juan, 'entrega', 15, 6, hace(22, 3), 'Quedaron en el garaje');
  mov(a, nico, 'retiro', 5, 0, hace(9, 5));

  const b = dir('Bulevar Artigas 1180', { contacto_nombre: 'Pablo Fernández', contacto_telefono: '098 555 210' });
  mov(b, nico, 'entrega', 20, 8, hace(17, 1));

  const c = dir('21 de Setiembre 2871', { referencia: 'Portería, preguntar por Raúl' });
  mov(c, juan, 'entrega', 10, 4, hace(6, 2));
  mov(c, juan, 'retiro', 0, 2, hace(2, 4));

  const d = dir('Luis A. de Herrera 1290', { contacto_nombre: 'Estudio Rivas' });
  mov(d, marcela, 'entrega', 8, 0, hace(3, 6));

  const e = dir('Ellauri 450');
  mov(e, nico, 'entrega', 12, 5, hace(0, 3), 'Cliente pide retirar el viernes');

  const f = dir('Rambla República de México 5515');
  mov(f, juan, 'entrega', 6, 2, hace(30, 2));
  mov(f, nico, 'retiro', 6, 2, hace(12, 1));

  return { version: 1, perfiles: p, direcciones, movimientos, diasAlerta: 15 };
}

let estado: Estado | null = null;
let sesionId: string | null = null;
const oyentes = new Set<() => void>();

function almacen(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function db(): Estado {
  if (estado) return estado;
  try {
    const guardado = almacen()?.getItem(CLAVE);
    if (guardado) estado = JSON.parse(guardado);
  } catch {}
  if (!estado) estado = semilla();
  return estado;
}

function guardar() {
  try {
    almacen()?.setItem(CLAVE, JSON.stringify(estado));
  } catch {}
  oyentes.forEach((o) => o());
}

export function suscribirDemo(o: () => void) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

export function reiniciarDemo() {
  estado = semilla();
  guardar();
}

const pausa = () => new Promise((r) => setTimeout(r, 120));
const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function vista(d: DireccionBase): Direccion {
  const pendiente = d.estado === 'pendiente' && d.ultima_entrega_en;
  const dias = pendiente ? Math.floor((Date.now() - new Date(d.ultima_entrega_en!).getTime()) / DIA) : null;
  return { ...d, dias_pendiente: dias, atrasada: dias !== null && dias >= db().diasAlerta };
}

function vistaMov(m: MovBase): Movimiento {
  const s = db();
  return {
    ...m,
    calle: s.direcciones.find((d) => d.id === m.direccion_id)!.calle,
    usuario_nombre: s.perfiles.find((p) => p.id === m.usuario_id)!.nombre,
    anulado: s.movimientos.some((x) => x.anula_id === m.id),
  };
}

function yo() {
  const p = db().perfiles.find((x) => x.id === sesionId);
  if (!p || !p.activo) throw new ErrorDemo('Tu usuario no está activo. Hablá con un administrador.');
  return p;
}

function recalcularEstado(d: DireccionBase) {
  d.estado = d.saldo_cajas + d.saldo_cajones === 0 ? 'completada' : 'pendiente';
}

// ---------------- API equivalente ----------------

export const demo = {
  async ingresar(email: string, password: string): Promise<Perfil | string> {
    await pausa();
    const p = db().perfiles.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!p) return 'Email o contraseña incorrectos.';
    if (!p.activo) return 'Tu usuario está desactivado. Hablá con un administrador.';
    sesionId = p.id;
    return p;
  },
  salir() {
    sesionId = null;
  },

  async listarPendientes() {
    await pausa();
    return db()
      .direcciones.filter((d) => d.estado === 'pendiente')
      .map(vista)
      .sort((x, y) => (x.ultima_entrega_en ?? '').localeCompare(y.ultima_entrega_en ?? ''));
  },

  async buscarDirecciones(texto: string) {
    await pausa();
    const q = normalizar(texto);
    if (!q) return [];
    return db()
      .direcciones.filter((d) => normalizar(d.calle).includes(q) || normalizar(d.contacto_nombre ?? '').includes(q))
      .map(vista)
      .sort((x, y) => (x.estado === y.estado ? 0 : x.estado === 'pendiente' ? -1 : 1))
      .slice(0, 20);
  },

  async obtenerDireccion(id: string) {
    await pausa();
    const d = db().direcciones.find((x) => x.id === id);
    return d ? vista(d) : null;
  },

  async actualizarContacto(id: string, campos: Pick<Direccion, 'referencia' | 'contacto_nombre' | 'contacto_telefono'>) {
    yo();
    Object.assign(db().direcciones.find((x) => x.id === id)!, campos);
    guardar();
  },

  async movimientosDeDireccion(id: string) {
    await pausa();
    return db()
      .movimientos.filter((m) => m.direccion_id === id)
      .map(vistaMov)
      .sort((x, y) => y.creado_en.localeCompare(x.creado_en));
  },

  async historial(usuarioId?: string) {
    await pausa();
    return db()
      .movimientos.filter((m) => !usuarioId || m.usuario_id === usuarioId)
      .map(vistaMov)
      .sort((x, y) => y.creado_en.localeCompare(x.creado_en))
      .slice(0, 150);
  },

  async registrarMovimiento(m: NuevoMovimiento) {
    await pausa();
    const usuario = yo();
    const s = db();
    if (s.movimientos.some((x) => x.client_id === m.client_id)) return;
    if (m.cajas < 0 || m.cajones < 0 || m.cajas + m.cajones === 0) throw new ErrorDemo('Ingresá al menos una caja o un cajón.');

    let d = m.direccion_id
      ? s.direcciones.find((x) => x.id === m.direccion_id)
      : s.direcciones.find((x) => normalizar(x.calle) === normalizar(m.calle ?? ''));
    if (!d) {
      if (!m.calle?.trim()) throw new ErrorDemo('Indicá una dirección.');
      if (m.tipo === 'retiro') throw new ErrorDemo(`No hay cajas ni cajones registrados en ${m.calle.trim()}.`);
      d = {
        id: uuid(), calle: m.calle.trim().replace(/\s+/g, ' '), referencia: m.referencia ?? null,
        contacto_nombre: null, contacto_telefono: null, saldo_cajas: 0, saldo_cajones: 0,
        estado: 'completada', ultima_entrega_en: null, creada_en: new Date().toISOString(),
      };
      s.direcciones.push(d);
    }
    if (m.tipo === 'retiro') {
      if (m.cajas > d.saldo_cajas) throw new ErrorDemo(`Solo hay ${d.saldo_cajas} ${d.saldo_cajas === 1 ? 'caja registrada' : 'cajas registradas'} en esta dirección.`);
      if (m.cajones > d.saldo_cajones) throw new ErrorDemo(`Solo hay ${d.saldo_cajones} ${d.saldo_cajones === 1 ? 'cajón registrado' : 'cajones registrados'} en esta dirección.`);
    }
    const ahora = new Date().toISOString();
    s.movimientos.push({
      id: uuid(), client_id: m.client_id, direccion_id: d.id, usuario_id: usuario.id, tipo: m.tipo,
      cajas: m.cajas, cajones: m.cajones, origen: 'app', nota: m.nota ?? null, anula_id: null,
      registrado_en: m.registrado_en, creado_en: ahora,
    });
    const signo = m.tipo === 'entrega' ? 1 : -1;
    d.saldo_cajas += signo * m.cajas;
    d.saldo_cajones += signo * m.cajones;
    if (m.tipo === 'entrega') d.ultima_entrega_en = ahora;
    recalcularEstado(d);
    guardar();
  },

  async anularMovimiento(id: string, motivo: string) {
    await pausa();
    const usuario = yo();
    if (usuario.rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede anular movimientos.');
    const s = db();
    const orig = s.movimientos.find((x) => x.id === id);
    if (!orig) throw new ErrorDemo('El movimiento no existe.');
    if (orig.tipo === 'ajuste') throw new ErrorDemo('Un ajuste no se puede anular.');
    if (s.movimientos.some((x) => x.anula_id === id)) throw new ErrorDemo('Este movimiento ya fue anulado.');
    const d = s.direcciones.find((x) => x.id === orig.direccion_id)!;
    const signo = orig.tipo === 'entrega' ? -1 : 1;
    if (d.saldo_cajas + signo * orig.cajas < 0 || d.saldo_cajones + signo * orig.cajones < 0) {
      throw new ErrorDemo('No se puede anular: el saldo actual quedaría negativo. Revisá los retiros posteriores.');
    }
    const ahora = new Date().toISOString();
    s.movimientos.push({
      id: uuid(), client_id: uuid(), direccion_id: d.id, usuario_id: usuario.id, tipo: 'ajuste',
      cajas: signo * orig.cajas, cajones: signo * orig.cajones, origen: 'app', nota: motivo.trim(),
      anula_id: id, registrado_en: ahora, creado_en: ahora,
    });
    d.saldo_cajas += signo * orig.cajas;
    d.saldo_cajones += signo * orig.cajones;
    recalcularEstado(d);
    guardar();
  },

  async resumenPanel(): Promise<Resumen> {
    await pausa();
    const dirs = db().direcciones.map(vista);
    return {
      cajas_afuera: dirs.reduce((t, d) => t + d.saldo_cajas, 0),
      cajones_afuera: dirs.reduce((t, d) => t + d.saldo_cajones, 0),
      direcciones_pendientes: dirs.filter((d) => d.estado === 'pendiente').length,
      direcciones_atrasadas: dirs.filter((d) => d.atrasada).length,
      dias_alerta: db().diasAlerta,
    };
  },

  async guardarDiasAlerta(dias: number) {
    if (yo().rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede cambiar la alerta.');
    db().diasAlerta = dias;
    guardar();
  },

  async obtenerPerfil(id: string) {
    const p = db().perfiles.find((x) => x.id === id);
    if (!p) return null;
    const { email: _e, password: _p, ...perfil } = p;
    return perfil;
  },

  async listarUsuarios() {
    await pausa();
    return db()
      .perfiles.map(({ email: _e, password: _p, ...perfil }) => perfil)
      .sort((x, y) => x.nombre.localeCompare(y.nombre));
  },

  async actualizarUsuario(id: string, cambios: Partial<Pick<Perfil, 'rol' | 'activo'>>) {
    if (yo().rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede modificar usuarios.');
    Object.assign(db().perfiles.find((x) => x.id === id)!, cambios);
    guardar();
  },

  async crearUsuario(datos: { nombre: string; email: string; password: string; telefono?: string; rol: Rol }) {
    await pausa();
    if (yo().rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede crear usuarios.');
    const email = datos.email.trim().toLowerCase();
    if (db().perfiles.some((p) => p.email === email)) throw new ErrorDemo('Ya existe un usuario con ese email.');
    db().perfiles.push({
      id: uuid(), email, password: datos.password, nombre: datos.nombre, telefono: datos.telefono ?? null,
      rol: datos.rol, activo: true,
    });
    guardar();
  },
};
