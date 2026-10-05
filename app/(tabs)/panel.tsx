import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DireccionCard } from '../../src/components/DireccionCard';
import { IconoCaja, IconoCajon } from '../../src/components/Iconos';
import { Pantalla } from '../../src/components/Pantalla';
import { guardarDiasAlerta, listarPendientes, resumenPanel } from '../../src/lib/api';
import { useDatos } from '../../src/lib/hooks';
import { useTema } from '../../src/theme';

export default function Panel() {
  const { c, f } = useTema();
  const { datos, refrescando, recargar } = useDatos(async () => {
    const [resumen, pendientes] = await Promise.all([resumenPanel(), listarPendientes()]);
    return { resumen, atrasadas: pendientes.filter((d) => d.atrasada) };
  }, ['direcciones', 'movimientos', 'configuracion']);
  const [guardando, setGuardando] = useState(false);

  const r = datos?.resumen;

  const cambiarDias = async (delta: number) => {
    if (!r) return;
    const nuevo = Math.min(365, Math.max(1, r.dias_alerta + delta));
    setGuardando(true);
    try {
      await guardarDiasAlerta(nuevo);
      await recargar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : '');
    } finally {
      setGuardando(false);
    }
  };

  const Cifra = ({ valor, etiqueta, icono, color }: { valor: number; etiqueta: string; icono?: ReactNode; color?: string }) => (
    <View style={[estilos.cifra, { backgroundColor: c.superficie, borderColor: c.linea }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icono}
        <Text style={{ fontFamily: f.numero, fontSize: 48, lineHeight: 52, color: color ?? c.texto }}>{valor}</Text>
      </View>
      <Text style={{ fontFamily: f.medio, fontSize: 14, color: c.textoSuave }}>{etiqueta}</Text>
    </View>
  );

  return (
    <Pantalla
      titulo="Panel"
      subtitulo="Inventario fuera del depósito"
      accion={
        <Pressable onPress={() => router.push('/usuarios')} hitSlop={10} style={estilos.enlace}>
          <Ionicons name="people-outline" size={22} color={c.texto} />
          <Text style={{ fontFamily: f.medio, color: c.texto }}>Usuarios</Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} tintColor={c.textoSuave} />}
      >
        {r && (
          <>
            <View style={estilos.grilla}>
              <Cifra valor={r.cajas_afuera} etiqueta="cajas afuera" icono={<IconoCaja size={28} color={c.kraft} />} />
              <Cifra valor={r.cajones_afuera} etiqueta="cajones afuera" icono={<IconoCajon size={28} color={c.madera} />} />
            </View>
            <View style={estilos.grilla}>
              <Cifra valor={r.direcciones_pendientes} etiqueta="direcciones pendientes" color={c.pendiente} />
              <Cifra valor={r.direcciones_atrasadas} etiqueta="atrasadas" color={r.direcciones_atrasadas ? c.atrasada : c.texto} />
            </View>

            <View style={[estilos.config, { backgroundColor: c.superficie, borderColor: c.linea }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: f.fuerte, fontSize: 16, color: c.texto }}>Alerta de atraso</Text>
                <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave }}>
                  Marcar en rojo después de {r.dias_alerta} {r.dias_alerta === 1 ? 'día' : 'días'} sin retirar
                </Text>
              </View>
              <View style={estilos.ajuste}>
                <Pressable disabled={guardando} onPress={() => cambiarDias(-1)} hitSlop={8} accessibilityLabel="Un día menos">
                  <Ionicons name="remove-circle-outline" size={32} color={c.texto} />
                </Pressable>
                <Text style={{ fontFamily: f.numero, fontSize: 28, color: c.texto, minWidth: 36, textAlign: 'center' }}>
                  {r.dias_alerta}
                </Text>
                <Pressable disabled={guardando} onPress={() => cambiarDias(1)} hitSlop={8} accessibilityLabel="Un día más">
                  <Ionicons name="add-circle-outline" size={32} color={c.texto} />
                </Pressable>
              </View>
            </View>

            <Text style={{ fontFamily: f.titulo, fontSize: 24, color: c.texto, marginTop: 12 }}>
              {datos.atrasadas.length ? 'Para retirar cuanto antes' : 'Ninguna dirección atrasada'}
            </Text>
            {datos.atrasadas.map((d) => (
              <DireccionCard key={d.id} d={d} />
            ))}
          </>
        )}
      </ScrollView>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', gap: 12 },
  cifra: { flex: 1, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  config: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  ajuste: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
