/**
 * Modo demo: un backend falso en el dispositivo que replica las reglas de la base de datos
 * (validación de saldo, anulaciones, usuarios inactivos). Sirve para probar la app sin Supabase.
 * Se activa con EXPO_PUBLIC_DEMO=1.
 */
import type { Direccion, Movimiento, NuevoMovimiento, Perfil, Resumen, Rol } from './types';
import type { Identificador } from './identificador';
import { uuid } from './uuid';

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export class ErrorDemo extends Error {}

type DireccionBase = Omit<Direccion, 'dias_pendiente' | 'atrasada'>;
type MovBase = Omit<Movimiento, 'calle' | 'usuario_nombre' | 'anulado' | 'contraparte_direccion_id' | 'contraparte_calle' | 'anula_tipo'>;

type PerfilDemo = Perfil & { password: string };

interface Estado {
  version: number;
  perfiles: PerfilDemo[];
  direcciones: DireccionBase[];
  movimientos: MovBase[];
  diasAlerta: number;
}

const CLAVE = 'demo-control-cajones-v3';
const DIA = 86400000;

/** Usuarios para entrar rápido en la demo: Marcela con email, Juan con celular */
export const USUARIOS_DEMO = [
  { identificador: 'admin@demo.uy', password: 'demo1234', nombre: 'Marcela Silva', rol: 'administrador' as Rol },
  { identificador: '098 111 222', password: 'demo1234', nombre: 'Juan Rodríguez', rol: 'operario' as Rol },
];

function hace(dias: number, horas = 0) {
  return new Date(Date.now() - dias * DIA - horas * 3600000).toISOString();
}

function semilla(): Estado {
  const base = { activo: true, pendiente: false, password: 'demo1234' };
  const p: PerfilDemo[] = [
    { ...base, id: uuid(), nombre: 'Marcela Silva', email: 'admin@demo.uy', telefono: null, rol: 'administrador' },
    { ...base, id: uuid(), nombre: 'Juan Rodríguez', email: null, telefono: '+59898111222', rol: 'operario' },
    { ...base, id: uuid(), nombre: 'Nicolás Pereira', email: 'nico@demo.uy', telefono: '+59899333444', rol: 'operario' },
    // Una cuenta recién creada, para mostrar la aprobación
    { ...base, id: uuid(), nombre: 'Martín Gómez', email: null, telefono: '+59897555666', rol: 'operario', activo: false, pendiente: true },
  ];
  const [marcela, juan, nico] = p as [PerfilDemo, PerfilDemo, PerfilDemo];

  const direcciones: DireccionBase[] = [];
  const movimientos: MovBase[] = [];

  const dir = (calle: string, extra: Partial<DireccionBase> = {}) => {
    const d: DireccionBase = {
      id: uuid(), calle, referencia: null, contacto_nombre: null, contacto_telefono: null, destino_previsto: null,
      saldo_cajas: 0, saldo_cajones: 0, estado: 'completada', ultima_entrega_en: null, creada_en: hace(40), ...extra,
    };
    direcciones.push(d);
    return d;
  };
  const mov = (d: DireccionBase, usuario: Perfil, tipo: 'entrega' | 'retiro', cajas: number, cajones: number, fecha: string, nota: string | null = null) => {
    movimientos.push({
      id: uuid(), client_id: uuid(), direccion_id: d.id, usuario_id: usuario.id, tipo, cajas, cajones,
      origen: 'app', nota, anula_id: null, mudanza_id: null, registrado_en: fecha, creado_en: fecha,
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

  // Entrega en la que ya se sabe a dónde se muda el cliente
  const g = dir('Bulevar España 2201', { contacto_nombre: 'Familia Suárez', contacto_telefono: '094 222 333', destino_previsto: 'Av. Brasil 2840' });
  mov(g, juan, 'entrega', 14, 6, hace(4, 2));

  // Mudanza ya hecha: los cajones pasaron de Cassinoni a Agraciada
  const h = dir('Cassinoni 1450', { contacto_nombre: 'Sofía Cabrera' });
  mov(h, nico, 'entrega', 9, 3, hace(10, 4));
  const i = dir('Av. Agraciada 3120', { contacto_nombre: 'Sofía Cabrera' });
  const grupo = uuid();
  const fechaMudanza = hace(1, 5);
  for (const [d, tipo] of [[h, 'mudanza_salida'], [i, 'mudanza_llegada']] as const) {
    movimientos.push({
      id: uuid(), client_id: uuid(), direccion_id: d.id, usuario_id: juan.id, tipo, cajas: 9, cajones: 3,
      origen: 'app', nota: null, anula_id: null, mudanza_id: grupo, registrado_en: fechaMudanza, creado_en: fechaMudanza,
    });
  }
  h.saldo_cajas = 0;
  h.saldo_cajones = 0;
  h.estado = 'completada';
  i.saldo_cajas = 9;
  i.saldo_cajones = 3;
  i.ultima_entrega_en = fechaMudanza;
  i.estado = 'pendiente';

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
  const calle = (id: string) => s.direcciones.find((d) => d.id === id)!.calle;
  const par = m.mudanza_id ? s.movimientos.find((x) => x.mudanza_id === m.mudanza_id && x.id !== m.id) : undefined;
  return {
    ...m,
    calle: calle(m.direccion_id),
    usuario_nombre: s.perfiles.find((p) => p.id === m.usuario_id)!.nombre,
    anulado: s.movimientos.some((x) => x.anula_id === m.id),
    contraparte_direccion_id: par?.direccion_id ?? null,
    contraparte_calle: par ? calle(par.direccion_id) : null,
    anula_tipo: m.anula_id ? (s.movimientos.find((x) => x.id === m.anula_id)?.tipo ?? null) : null,
  };
}

function yo() {
  const p = db().perfiles.find((x) => x.id === sesionId);
  if (!p || !p.activo) throw new ErrorDemo('Tu usuario no está activo. Hablá con un administrador.');
  return p;
}

function buscarPorIdentificador(id: Identificador) {
  return db().perfiles.find((x) => ('email' in id ? x.email === id.email : x.telefono === id.phone));
}

function sinPassword({ password: _p, ...perfil }: PerfilDemo): Perfil {
  return perfil;
}

function recalcularEstado(d: DireccionBase) {
  d.estado = d.saldo_cajas + d.saldo_cajones === 0 ? 'completada' : 'pendiente';
}

function nuevaDireccion(calle: string, referencia?: string): DireccionBase {
  const d: DireccionBase = {
    id: uuid(), calle: calle.trim().replace(/\s+/g, ' '), referencia: referencia?.trim() || null,
    contacto_nombre: null, contacto_telefono: null, destino_previsto: null, saldo_cajas: 0, saldo_cajones: 0,
    estado: 'completada', ultima_entrega_en: null, creada_en: new Date().toISOString(),
  };
  db().direcciones.push(d);
  return d;
}

/** Igual que la RPC registrar_mudanza: pasa el saldo del origen al destino */
function registrarMudanza(m: NuevoMovimiento, usuario: Perfil) {
  const s = db();
  const o = s.direcciones.find((x) => x.id === m.direccion_id);
  if (!o) throw new ErrorDemo('La dirección de origen no existe.');
  if (m.cajas > o.saldo_cajas || m.cajones > o.saldo_cajones) {
    throw new ErrorDemo(`En ${o.calle} hay ${cantidadesTexto(o.saldo_cajas, o.saldo_cajones)}: no se puede mudar más de eso.`);
  }
  let d = m.destino_id
    ? s.direcciones.find((x) => x.id === m.destino_id)
    : s.direcciones.find((x) => normalizar(x.calle) === normalizar(m.destino_calle ?? ''));
  if (!d) {
    if (m.destino_id) throw new ErrorDemo('La dirección de destino no existe.');
    if (!m.destino_calle?.trim()) throw new ErrorDemo('Indicá a qué dirección se mudan.');
    d = nuevaDireccion(m.destino_calle, m.destino_referencia);
  }
  if (d.id === o.id) throw new ErrorDemo('La dirección de destino tiene que ser distinta de la de origen.');

  const ahora = new Date().toISOString();
  const grupo = uuid();
  for (const [dir, tipo, clientId] of [[o, 'mudanza_salida', m.client_id], [d, 'mudanza_llegada', uuid()]] as const) {
    s.movimientos.push({
      id: uuid(), client_id: clientId, direccion_id: dir.id, usuario_id: usuario.id, tipo, cajas: m.cajas, cajones: m.cajones,
      origen: 'app', nota: m.nota?.trim() || null, anula_id: null, mudanza_id: grupo, registrado_en: m.registrado_en, creado_en: ahora,
    });
  }
  o.saldo_cajas -= m.cajas;
  o.saldo_cajones -= m.cajones;
  o.destino_previsto = null;
  recalcularEstado(o);
  if (!d.contacto_nombre && !d.contacto_telefono) {
    d.contacto_nombre = o.contacto_nombre;
    d.contacto_telefono = o.contacto_telefono;
  }
  d.saldo_cajas += m.cajas;
  d.saldo_cajones += m.cajones;
  d.ultima_entrega_en = ahora; // el plazo para retirar cuenta desde la mudanza
  recalcularEstado(d);
  guardar();
}

function cantidadesTexto(cajas: number, cajones: number) {
  return `${cajas} ${cajas === 1 ? 'caja' : 'cajas'} y ${cajones} ${cajones === 1 ? 'cajón' : 'cajones'}`;
}

// ---------------- API equivalente ----------------

export const demo = {
  async ingresar(id: Identificador, password: string): Promise<Perfil | string> {
    await pausa();
    const p = buscarPorIdentificador(id);
    if (!p || p.password !== password) {
      return 'email' in id ? 'Email o contraseña incorrectos.' : 'Celular o contraseña incorrectos.';
    }
    if (p.pendiente) return 'Tu cuenta está esperando que un administrador la apruebe.';
    if (!p.activo) return 'Tu cuenta está desactivada. Hablá con un administrador.';
    sesionId = p.id;
    return sinPassword(p);
  },

  async registrarse(nombre: string, id: Identificador, password: string): Promise<true | string> {
    await pausa();
    if (buscarPorIdentificador(id)) return 'Ya hay una cuenta con ese email o celular.';
    db().perfiles.push({
      id: uuid(), nombre, password, rol: 'operario', activo: false, pendiente: true,
      email: 'email' in id ? id.email : null, telefono: 'phone' in id ? id.phone : null,
    });
    guardar();
    return true;
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

  async actualizarContacto(id: string, campos: Pick<Direccion, 'referencia' | 'contacto_nombre' | 'contacto_telefono' | 'destino_previsto'>) {
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
    if (m.tipo === 'mudanza') return registrarMudanza(m, usuario);

    let d = m.direccion_id
      ? s.direcciones.find((x) => x.id === m.direccion_id)
      : s.direcciones.find((x) => normalizar(x.calle) === normalizar(m.calle ?? ''));
    if (!d) {
      if (!m.calle?.trim()) throw new ErrorDemo('Indicá una dirección.');
      if (m.tipo === 'retiro') {
        throw new ErrorDemo(`No hay cajas ni cajones registrados en ${m.calle.trim()}. Si vinieron de otra dirección, registrá primero la mudanza.`);
      }
      d = nuevaDireccion(m.calle, m.referencia);
    }
    if (m.tipo === 'retiro') {
      if (m.cajas > d.saldo_cajas) throw new ErrorDemo(`Solo hay ${d.saldo_cajas} ${d.saldo_cajas === 1 ? 'caja registrada' : 'cajas registradas'} en esta dirección.`);
      if (m.cajones > d.saldo_cajones) throw new ErrorDemo(`Solo hay ${d.saldo_cajones} ${d.saldo_cajones === 1 ? 'cajón registrado' : 'cajones registrados'} en esta dirección.`);
    }
    const ahora = new Date().toISOString();
    s.movimientos.push({
      id: uuid(), client_id: m.client_id, direccion_id: d.id, usuario_id: usuario.id, tipo: m.tipo,
      cajas: m.cajas, cajones: m.cajones, origen: 'app', nota: m.nota ?? null, anula_id: null, mudanza_id: null,
      registrado_en: m.registrado_en, creado_en: ahora,
    });
    const signo = m.tipo === 'entrega' ? 1 : -1;
    d.saldo_cajas += signo * m.cajas;
    d.saldo_cajones += signo * m.cajones;
    if (m.tipo === 'entrega') {
      d.ultima_entrega_en = ahora;
      if (m.destino_previsto?.trim()) d.destino_previsto = m.destino_previsto.trim().replace(/\s+/g, ' ');
    }
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
    // En una mudanza se anulan los dos movimientos (salida y llegada)
    const aAnular = orig.mudanza_id ? s.movimientos.filter((x) => x.mudanza_id === orig.mudanza_id) : [orig];
    const cambios = aAnular.map((x) => ({
      x,
      d: s.direcciones.find((y) => y.id === x.direccion_id)!,
      signo: x.tipo === 'entrega' || x.tipo === 'mudanza_llegada' ? -1 : 1,
    }));
    for (const { x, d, signo } of cambios) {
      if (d.saldo_cajas + signo * x.cajas < 0 || d.saldo_cajones + signo * x.cajones < 0) {
        throw new ErrorDemo(`No se puede anular: el saldo de ${d.calle} quedaría negativo. Revisá los retiros posteriores.`);
      }
    }
    const ahora = new Date().toISOString();
    for (const { x, d, signo } of cambios) {
      s.movimientos.push({
        id: uuid(), client_id: uuid(), direccion_id: d.id, usuario_id: usuario.id, tipo: 'ajuste',
        cajas: signo * x.cajas, cajones: signo * x.cajones, origen: 'app', nota: motivo.trim(),
        anula_id: x.id, mudanza_id: null, registrado_en: ahora, creado_en: ahora,
      });
      d.saldo_cajas += signo * x.cajas;
      d.saldo_cajones += signo * x.cajones;
      recalcularEstado(d);
    }
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
      cuentas_pendientes: db().perfiles.filter((p) => p.pendiente).length,
    };
  },

  async guardarDiasAlerta(dias: number) {
    if (yo().rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede cambiar la alerta.');
    db().diasAlerta = dias;
    guardar();
  },

  async obtenerPerfil(id: string) {
    const p = db().perfiles.find((x) => x.id === id);
    return p ? sinPassword(p) : null;
  },

  async listarUsuarios() {
    await pausa();
    return db()
      .perfiles.map(sinPassword)
      .sort((x, y) => x.nombre.localeCompare(y.nombre));
  },

  async actualizarUsuario(id: string, cambios: Partial<Pick<Perfil, 'rol' | 'activo' | 'pendiente'>>) {
    await pausa();
    if (yo().rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede modificar usuarios.');
    const u = db().perfiles.find((x) => x.id === id)!;
    const dejaDeSerAdmin = u.rol === 'administrador' && u.activo && (cambios.rol === 'operario' || cambios.activo === false);
    if (dejaDeSerAdmin && !db().perfiles.some((x) => x.id !== id && x.rol === 'administrador' && x.activo)) {
      throw new ErrorDemo('Tiene que quedar al menos un administrador activo.');
    }
    Object.assign(u, cambios);
    guardar();
  },

  async restablecerContrasena(id: string, password: string) {
    await pausa();
    if (yo().rol !== 'administrador') throw new ErrorDemo('Solo un administrador puede cambiar contraseñas.');
    if (password.length < 8) throw new ErrorDemo('La contraseña debe tener al menos 8 caracteres.');
    db().perfiles.find((x) => x.id === id)!.password = password;
    guardar();
  },
};
