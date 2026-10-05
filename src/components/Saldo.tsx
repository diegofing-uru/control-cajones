import { StyleSheet, Text, View } from 'react-native';
import { useTema } from '../theme';
import { IconoCaja, IconoCajon } from './Iconos';

interface Props {
  cajas: number;
  cajones: number;
  grande?: boolean;
}

/** Los números del saldo son el elemento protagonista: grandes, condensados, tipo cartel de depósito */
export function Saldo({ cajas, cajones, grande = false }: Props) {
  const { c, f } = useTema();
  const tamNum = grande ? 64 : 38;
  const tamIcono = grande ? 30 : 22;

  const Item = ({ n, tipo }: { n: number; tipo: 'caja' | 'cajon' }) => {
    const color = tipo === 'caja' ? c.kraft : c.madera;
    const etiqueta = tipo === 'caja' ? (n === 1 ? 'caja' : 'cajas') : n === 1 ? 'cajón' : 'cajones';
    return (
      <View style={[estilos.item, n === 0 && { opacity: 0.35 }]} accessibilityLabel={`${n} ${etiqueta}`}>
        {tipo === 'caja' ? <IconoCaja size={tamIcono} color={color} /> : <IconoCajon size={tamIcono} color={color} />}
        <Text style={{ fontFamily: f.numero, fontSize: tamNum, lineHeight: tamNum * 1.05, color: c.texto }}>{n}</Text>
        <Text style={{ fontFamily: f.medio, fontSize: grande ? 16 : 13, color: c.textoSuave, marginBottom: grande ? 10 : 6 }}>
          {etiqueta}
        </Text>
      </View>
    );
  };

  return (
    <View style={[estilos.fila, { gap: grande ? 28 : 18 }]}>
      <Item n={cajas} tipo="caja" />
      <Item n={cajones} tipo="cajon" />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-end' },
  item: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
});
