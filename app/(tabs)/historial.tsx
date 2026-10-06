import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MovimientoItem } from '../../src/components/MovimientoItem';
import { Pantalla } from '../../src/components/Pantalla';
import { Vacio } from '../../src/components/Vacio';
import { historial } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useDatos } from '../../src/lib/hooks';
import { useTema } from '../../src/theme';

export default function Historial() {
  const { c, f } = useTema();
  const { perfil } = useAuth();
  const [soloMios, setSoloMios] = useState(false);
  const { datos, refrescando, recargar } = useDatos(() => historial(soloMios ? perfil?.id : undefined), ['movimientos']);
  const primeraVez = useRef(true);

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloMios]);

  // Una mudanza genera dos movimientos (salida y llegada): en el historial general alcanza con la salida
  const visibles = (datos ?? []).filter((m) => m.tipo !== 'mudanza_llegada' && m.anula_tipo !== 'mudanza_llegada');

  const Filtro = ({ valor, texto }: { valor: boolean; texto: string }) => {
    const activo = soloMios === valor;
    return (
      <Pressable
        onPress={() => setSoloMios(valor)}
        style={[estilos.chip, { backgroundColor: activo ? c.texto : c.superficie, borderColor: c.linea }]}
      >
        <Text style={{ fontFamily: f.medio, color: activo ? c.fondo : c.texto }}>{texto}</Text>
      </Pressable>
    );
  };

  return (
    <Pantalla titulo="Historial" subtitulo="Últimos movimientos de todo el equipo">
      <View style={estilos.filtros}>
        <Filtro valor={false} texto="Todos" />
        <Filtro valor={true} texto="Mis movimientos" />
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <MovimientoItem
            m={item}
            mostrarCalle
            ultimo={index === visibles.length - 1}
            onPress={() => router.push(`/direccion/${item.direccion_id}`)}
          />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} tintColor={c.textoSuave} />}
        ListEmptyComponent={
          datos !== null ? (
            <Vacio icono={<Ionicons name="time-outline" size={48} color={c.textoSuave} />} titulo="Todavía no hay movimientos" />
          ) : null
        }
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { paddingHorizontal: 16, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
});
