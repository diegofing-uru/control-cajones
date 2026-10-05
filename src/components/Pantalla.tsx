import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema } from '../theme';

interface Props {
  titulo?: string;
  subtitulo?: string;
  accion?: ReactNode;
  children: ReactNode;
}

export function Pantalla({ titulo, subtitulo, accion, children }: Props) {
  const { c, f } = useTema();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }} edges={['top']}>
      {titulo ? (
        <View style={estilos.cabecera}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f.numero, fontSize: 34, color: c.texto }}>{titulo}</Text>
            {subtitulo ? (
              <Text style={{ fontFamily: f.texto, fontSize: 15, color: c.textoSuave }}>{subtitulo}</Text>
            ) : null}
          </View>
          {accion}
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
