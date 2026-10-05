export type Rol = 'operario' | 'administrador';
export type TipoMovimiento = 'entrega' | 'retiro' | 'ajuste';
export type EstadoDireccion = 'pendiente' | 'completada';

export interface Perfil {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  /** Cuenta creada por la persona, esperando que un administrador la apruebe */
  pendiente: boolean;
}

export interface Direccion {
  id: string;
  calle: string;
  referencia: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  saldo_cajas: number;
  saldo_cajones: number;
  estado: EstadoDireccion;
  ultima_entrega_en: string | null;
  creada_en: string;
  dias_pendiente: number | null;
  atrasada: boolean;
}

export interface Movimiento {
  id: string;
  client_id: string;
  direccion_id: string;
  calle: string;
  usuario_id: string;
  usuario_nombre: string;
  tipo: TipoMovimiento;
  cajas: number;
  cajones: number;
  origen: 'app' | 'whatsapp';
  nota: string | null;
  anula_id: string | null;
  anulado: boolean;
  registrado_en: string;
  creado_en: string;
}

export interface Resumen {
  cajas_afuera: number;
  cajones_afuera: number;
  direcciones_pendientes: number;
  direcciones_atrasadas: number;
  dias_alerta: number;
  cuentas_pendientes: number;
}

/** Lo que se guarda en la cola offline y se envía a la RPC */
export interface NuevoMovimiento {
  client_id: string;
  tipo: 'entrega' | 'retiro';
  cajas: number;
  cajones: number;
  direccion_id?: string;
  calle?: string;
  referencia?: string;
  nota?: string;
  registrado_en: string;
}
