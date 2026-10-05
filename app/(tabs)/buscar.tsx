import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { DireccionCard } from '../../src/components/DireccionCard';
import { Pantalla } from '../../src/components/Pantalla';
import { Vacio } from '../../src/components/Vacio';
import { buscarDirecciones } from '../../src/lib/api';
import { useDebounce } from '../../src/lib/hooks';
import type { Direccion } from '../../src/lib/types';
import { useTema } from '../../src/theme';

export default function Buscar() {
  const { c, f } = useTema();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Direccion[] | null>(null);
  const consulta = useDebounce(texto);

  useEffect(() => {
    if (!consulta.trim()) {
      setResultados(null);
      return;
    }
    let vigente = true;
    buscarDirecciones(consulta)
      .then((r) => vigente && setResultados(r))
      .catch(() => vigente && setResultados([]));
    return () => {
      vigente = false;
    };
  }, [consulta]);

  return (
    <Pantalla titulo="Buscar">
      <View style={[estilos.buscador, { backgroundColor: c.superficie, borderColor: c.linea }]}>
        <Ionicons name="search" size={20} color={c.textoSuave} />
        <TextInput
          style={{ flex: 1, fontFamily: f.texto, fontSize: 17, color: c.texto }}
          placeholder="Calle o nombre del cliente"
          placeholderTextColor={c.textoSuave}
          value={texto}
          onChangeText={setTexto}
          autoCorrect={false}
          returnKeyType="search"
        />
        {texto ? <Ionicons name="close-circle" size={20} color={c.textoSuave} onPress={() => setTexto('')} /> : null}
      </View>
      <FlatList
        data={resultados ?? []}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DireccionCard d={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          resultados === null ? (
            <Vacio
              icono={<Ionicons name="map-outline" size={48} color={c.textoSuave} />}
              titulo="Encontrá una dirección"
              texto="Incluye las completadas, para ver su historial."
            />
          ) : (
            <Vacio
              icono={<Ionicons name="help-circle-outline" size={48} color={c.textoSuave} />}
              titulo="Sin resultados"
              texto={`No hay direcciones que coincidan con "${consulta}".`}
            />
          )
        }
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
  },
});
