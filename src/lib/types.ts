export type Rol = 'operario' | 'administrador';
export type TipoMovimiento = 'entrega' | 'retiro' | 'ajuste' | 'mudanza_salida' | 'mudanza_llegada';
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
  /** A dónde se muda el cliente, si se supo al entregar */
  destino_previsto: string | null;
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
  /** Une la salida y la llegada de una misma mudanza */
  mudanza_id: string | null;
  /** En una mudanza: la otra dirección (destino si es salida, origen si es llegada) */
  contraparte_direccion_id: string | null;
  contraparte_calle: string | null;
  /** En un ajuste: el tipo del movimiento que anuló */
  anula_tipo: TipoMovimiento | null;
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

/**
 * Lo que se guarda en la cola offline y se envía a la RPC.
 * En una mudanza, direccion_id es el origen y los campos destino_* indican a dónde van.
 */
export interface NuevoMovimiento {
  client_id: string;
  tipo: 'entrega' | 'retiro' | 'mudanza';
  cajas: number;
  cajones: number;
  direccion_id?: string;
  calle?: string;
  referencia?: string;
  nota?: string;
  registrado_en: string;
  /** Entrega: a dónde se muda el cliente, si ya se sabe */
  destino_previsto?: string;
  destino_id?: string;
  destino_calle?: string;
  destino_referencia?: string;
}
