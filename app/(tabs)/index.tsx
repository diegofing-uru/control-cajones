import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AvisoCola } from '../../src/components/AvisoCola';
import { DireccionCard } from '../../src/components/DireccionCard';
import { IconoCaja } from '../../src/components/Iconos';
import { Pantalla } from '../../src/components/Pantalla';
import { Vacio } from '../../src/components/Vacio';
import { listarPendientes } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useDatos } from '../../src/lib/hooks';
import { useTema } from '../../src/theme';

export default function Pendientes() {
  const { c, f } = useTema();
  const { perfil, salir } = useAuth();
  const { datos, error, refrescando, recargar } = useDatos(listarPendientes);

  const lista = datos ?? [];
  const atrasadas = lista.filter((d) => d.atrasada).length;
  const subtitulo =
    datos === null
      ? 'Cargando…'
      : lista.length === 0
        ? 'Todo retirado'
        : `${lista.length} ${lista.length === 1 ? 'dirección' : 'direcciones'}${atrasadas ? ` · ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : ''}`;

  return (
    <Pantalla
      titulo="Pendientes"
      subtitulo={subtitulo}
      accion={
        <Pressable onPress={salir} hitSlop={10} accessibilityLabel={`Cerrar sesión de ${perfil?.nombre ?? ''}`}>
          <Ionicons name="log-out-outline" size={24} color={c.textoSuave} />
        </Pressable>
      }
    >
      <AvisoCola />
      {error && <Text style={{ color: c.atrasada, fontFamily: f.medio, paddingHorizontal: 20 }}>{error}</Text>}
      <FlatList
        data={lista}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DireccionCard d={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} tintColor={c.textoSuave} />}
        ListEmptyComponent={
          datos !== null ? (
            <Vacio
              icono={<IconoCaja size={56} color={c.textoSuave} />}
              titulo="No hay cajas afuera"
              texto="Cuando dejes cajas o cajones en una dirección, aparece acá hasta que se retiren."
            />
          ) : null
        }
      />
      <View style={estilos.fabContenedor} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/movimiento/nuevo')}
          style={({ pressed }) => [estilos.fab, { backgroundColor: c.cinta, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Nuevo movimiento"
        >
          <Ionicons name="add" size={28} color={c.sobreCinta} />
          <Text style={{ fontFamily: f.fuerte, fontSize: 17, color: c.sobreCinta }}>Nuevo movimiento</Text>
        </Pressable>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fabContenedor: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 60,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
