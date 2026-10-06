import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { descartarRechazos, sincronizar } from '../lib/colaOffline';
import { cantidades } from '../lib/formato';
import { useCola } from '../lib/hooks';
import { useTema } from '../theme';

/** Avisa si hay movimientos guardados sin señal o rechazados al sincronizar */
export function AvisoCola() {
  const { c, f } = useTema();
  const { pendientes, rechazos } = useCola();
  if (pendientes === 0 && rechazos.length === 0) return null;

  return (
    <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
      {pendientes > 0 && (
        <Pressable
          onPress={() => sincronizar()}
          style={[estilos.aviso, { backgroundColor: c.superficie, borderColor: c.pendiente }]}
        >
          <Ionicons name="cloud-offline-outline" size={20} color={c.pendiente} />
          <Text style={{ flex: 1, fontFamily: f.medio, color: c.texto }}>
            {pendientes === 1 ? '1 movimiento guardado sin señal' : `${pendientes} movimientos guardados sin señal`}. Se
            envían solos al recuperar conexión.
          </Text>
        </Pressable>
      )}
      {rechazos.length > 0 && (
        <View style={[estilos.aviso, { backgroundColor: c.superficie, borderColor: c.atrasada, alignItems: 'flex-start' }]}>
          <Ionicons name="alert-circle-outline" size={20} color={c.atrasada} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: f.fuerte, color: c.texto }}>No se pudieron registrar:</Text>
            {rechazos.map((r) => (
              <Text key={r.movimiento.client_id} style={{ fontFamily: f.texto, color: c.textoSuave }}>
                {r.movimiento.tipo === 'entrega' ? 'Entrega' : r.movimiento.tipo === 'retiro' ? 'Retiro' : 'Mudanza'} de{' '}
                {cantidades(r.movimiento.cajas, r.movimiento.cajones)}: {r.motivo}
              </Text>
            ))}
            <Pressable onPress={descartarRechazos} hitSlop={8}>
              <Text style={{ fontFamily: f.fuerte, color: c.atrasada, marginTop: 4 }}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
});
