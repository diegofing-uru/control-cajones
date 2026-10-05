import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTema } from '../theme';

interface Props {
  etiqueta: string;
  icono: ReactNode;
  valor: number;
  onCambio: (v: number) => void;
  max?: number;
  ayuda?: string;
}

/** Contador grande para cargar cantidades con el pulgar, sin teclado */
export function Stepper({ etiqueta, icono, valor, onCambio, max, ayuda }: Props) {
  const { c, f } = useTema();
  const puedeRestar = valor > 0;
  const puedeSumar = max === undefined || valor < max;

  const cambiar = (delta: number) => {
    const nuevo = valor + delta;
    if (nuevo < 0 || (max !== undefined && nuevo > max)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    onCambio(nuevo);
  };

  const Boton = ({ delta, activo }: { delta: number; activo: boolean }) => (
    <Pressable
      onPress={() => cambiar(delta)}
      onLongPress={() => cambiar(delta * 5)}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: delta > 0 ? c.cinta : c.superficieAlt, opacity: activo ? (pressed ? 0.7 : 1) : 0.35 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Sumar' : 'Restar'} ${etiqueta}`}
      hitSlop={6}
    >
      <Ionicons name={delta > 0 ? 'add' : 'remove'} size={30} color={delta > 0 ? c.sobreCinta : c.texto} />
    </Pressable>
  );

  return (
    <View style={[estilos.contenedor, { backgroundColor: c.superficie, borderColor: c.linea }]}>
      <View style={estilos.etiqueta}>
        {icono}
        <Text style={{ fontFamily: f.fuerte, fontSize: 17, color: c.texto }}>{etiqueta}</Text>
      </View>
      <View style={estilos.controles}>
        <Boton delta={-1} activo={puedeRestar} />
        <Text
          style={{ fontFamily: f.numero, fontSize: 48, color: c.texto, minWidth: 64, textAlign: 'center' }}
          accessibilityLiveRegion="polite"
        >
          {valor}
        </Text>
        <Boton delta={1} activo={puedeSumar} />
      </View>
      {ayuda ? <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>{ayuda}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
