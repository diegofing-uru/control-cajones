import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useTema } from '../theme';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: 'principal' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  cargando?: boolean;
  estilo?: ViewStyle;
}

export function Boton({ titulo, onPress, variante = 'principal', deshabilitado, cargando, estilo }: Props) {
  const { c, f } = useTema();
  const fondo = variante === 'principal' ? c.cinta : variante === 'peligro' ? c.atrasada : c.superficie;
  const texto = variante === 'principal' ? c.sobreCinta : variante === 'peligro' ? '#FFFFFF' : c.texto;
  const inactivo = deshabilitado || cargando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, borderColor: c.linea, borderWidth: variante === 'secundario' ? 1 : 0 },
        { opacity: inactivo ? 0.45 : pressed ? 0.8 : 1 },
        estilo,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo }}
    >
      {cargando ? (
        <ActivityIndicator color={texto} />
      ) : (
        <Text style={{ color: texto, fontFamily: f.fuerte, fontSize: 17 }}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
