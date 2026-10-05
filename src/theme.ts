import { useColorScheme } from 'react-native';

/**
 * Identidad visual: asfalto + cinta de embalar.
 * El amarillo "cinta" se reserva para la acción principal; el kraft identifica cajas
 * y el verde oliva identifica cajones, en íconos y números.
 */
const base = {
  cinta: '#FFC21A',
  sobreCinta: '#18222B',
  kraft: '#B27A42',
  madera: '#6E7D3A',
  ok: '#2F8F5B',
  pendiente: '#C98A00',
  atrasada: '#D2453B',
};

const claro = {
  ...base,
  fondo: '#ECEFF2',
  superficie: '#FFFFFF',
  superficieAlt: '#F5F7F8',
  texto: '#18222B',
  textoSuave: '#5A6874',
  linea: '#D6DCE1',
  barra: '#18222B',
  sobreBarra: '#FFFFFF',
};

const oscuro: typeof claro = {
  ...base,
  fondo: '#10171D',
  superficie: '#1A242C',
  superficieAlt: '#222E37',
  texto: '#EEF1F3',
  textoSuave: '#97A4AE',
  linea: '#2C3943',
  barra: '#1A242C',
  sobreBarra: '#EEF1F3',
};

export type Colores = typeof claro;

export const fuentes = {
  numero: 'BarlowCondensed_700Bold',
  titulo: 'BarlowCondensed_600SemiBold',
  texto: 'Barlow_400Regular',
  medio: 'Barlow_500Medium',
  fuerte: 'Barlow_600SemiBold',
};

export function useTema() {
  const esquema = useColorScheme();
  return { c: esquema === 'dark' ? oscuro : claro, f: fuentes, oscuro: esquema === 'dark' };
}

export function colorEstado(c: Colores, estado: 'pendiente' | 'completada', atrasada: boolean) {
  if (estado === 'completada') return c.ok;
  return atrasada ? c.atrasada : c.pendiente;
}
