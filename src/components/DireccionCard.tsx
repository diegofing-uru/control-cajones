import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { diasTexto } from '../lib/formato';
import type { Direccion } from '../lib/types';
import { colorEstado, useTema } from '../theme';
import { Saldo } from './Saldo';

export function DireccionCard({ d }: { d: Direccion }) {
  const { c, f } = useTema();
  const color = colorEstado(c, d.estado, d.atrasada);
  const estadoTexto = d.estado === 'completada' ? 'Completada' : d.atrasada ? 'Atrasada' : 'Pendiente';

  return (
    <Pressable
      onPress={() => router.push(`/direccion/${d.id}`)}
      style={({ pressed }) => [
        estilos.card,
        { backgroundColor: c.superficie, borderColor: c.linea, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${d.calle}, ${estadoTexto}`}
    >
      <View style={[estilos.cinta, { backgroundColor: color }]} />
      <View style={estilos.cuerpo}>
        <View style={estilos.cabecera}>
          <Text style={[estilos.calle, { color: c.texto, fontFamily: f.titulo }]} numberOfLines={1}>
            {d.calle}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={c.textoSuave} />
        </View>
        {(d.contacto_nombre || d.referencia) && (
          <Text style={{ color: c.textoSuave, fontFamily: f.texto, fontSize: 14 }} numberOfLines={1}>
            {[d.contacto_nombre, d.referencia].filter(Boolean).join(' — ')}
          </Text>
        )}
        <View style={estilos.pie}>
          <Saldo cajas={d.saldo_cajas} cajones={d.saldo_cajones} />
          <View style={estilos.estado}>
            <Text style={{ color, fontFamily: f.fuerte, fontSize: 13 }}>{estadoTexto}</Text>
            {d.estado === 'pendiente' && (
              <Text style={{ color: c.textoSuave, fontFamily: f.texto, fontSize: 13 }}>{diasTexto(d.dias_pendiente)}</Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cinta: { width: 6 },
  cuerpo: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calle: { fontSize: 22, flexShrink: 1 },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  estado: { alignItems: 'flex-end', paddingBottom: 6 },
});
