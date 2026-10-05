import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTema } from '../theme';

export function Vacio({ icono, titulo, texto }: { icono: ReactNode; titulo: string; texto?: string }) {
  const { c, f } = useTema();
  return (
    <View style={estilos.contenedor}>
      {icono}
      <Text style={{ fontFamily: f.titulo, fontSize: 22, color: c.texto, textAlign: 'center' }}>{titulo}</Text>
      {texto ? (
        <Text style={{ fontFamily: f.texto, fontSize: 15, color: c.textoSuave, textAlign: 'center' }}>{texto}</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 48 },
});
