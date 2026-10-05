import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cantidades, fechaHora, iniciales } from '../lib/formato';
import type { Movimiento } from '../lib/types';
import { useTema } from '../theme';

interface Props {
  m: Movimiento;
  mostrarCalle?: boolean;
  ultimo?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
}

/** Fila de la línea de tiempo: quién, qué y cuándo */
export function MovimientoItem({ m, mostrarCalle, ultimo, onLongPress, onPress }: Props) {
  const { c, f } = useTema();
  const color = m.tipo === 'entrega' ? c.kraft : m.tipo === 'retiro' ? c.ok : c.textoSuave;
  const verbo =
    m.tipo === 'entrega'
      ? 'dejó'
      : m.tipo === 'retiro'
        ? 'retiró'
        : (m.cajas < 0 || m.cajones < 0 ? 'anuló una entrega de' : 'anuló un retiro de');

  return (
    <Pressable onLongPress={onLongPress} onPress={onPress} style={estilos.fila} delayLongPress={400}>
      <View style={estilos.riel}>
        <View style={[estilos.avatar, { backgroundColor: c.superficieAlt, borderColor: color }]}>
          <Text style={{ fontFamily: f.fuerte, fontSize: 13, color: c.texto }}>{iniciales(m.usuario_nombre)}</Text>
        </View>
        {!ultimo && <View style={[estilos.linea, { backgroundColor: c.linea }]} />}
      </View>
      <View style={[estilos.cuerpo, { opacity: m.anulado ? 0.5 : 1 }]}>
        <Text style={{ fontFamily: f.texto, fontSize: 16, color: c.texto }}>
          <Text style={{ fontFamily: f.fuerte }}>{m.usuario_nombre}</Text> {verbo}{' '}
          <Text style={{ fontFamily: f.fuerte, color, textDecorationLine: m.anulado ? 'line-through' : 'none' }}>
            {cantidades(m.cajas, m.cajones)}
          </Text>
        </Text>
        {mostrarCalle && (
          <Text style={{ fontFamily: f.medio, fontSize: 14, color: c.texto }} numberOfLines={1}>
            {m.calle}
          </Text>
        )}
        <View style={estilos.meta}>
          <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>{fechaHora(m.creado_en)}</Text>
          {m.origen === 'whatsapp' && <Ionicons name="logo-whatsapp" size={14} color={c.textoSuave} />}
          {m.anulado && <Text style={{ fontFamily: f.fuerte, fontSize: 13, color: c.atrasada }}>Anulado</Text>}
        </View>
        {m.nota ? (
          <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave, fontStyle: 'italic' }}>"{m.nota}"</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  riel: { alignItems: 'center', width: 36 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  linea: { width: 2, flex: 1, marginVertical: 4 },
  cuerpo: { flex: 1, paddingBottom: 20, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
