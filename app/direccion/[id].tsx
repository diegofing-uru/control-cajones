import { Ionicons } from '@expo/vector-icons';
import { avisar } from '../../src/lib/avisar';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton } from '../../src/components/Boton';
import { MovimientoItem } from '../../src/components/MovimientoItem';
import { Saldo } from '../../src/components/Saldo';
import { actualizarContacto, anularMovimiento, movimientosDeDireccion, obtenerDireccion } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { cantidades, diasTexto } from '../../src/lib/formato';
import { useDatos } from '../../src/lib/hooks';
import type { Movimiento } from '../../src/lib/types';
import { colorEstado, useTema } from '../../src/theme';

export default function DetalleDireccion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, f } = useTema();
  const { esAdmin } = useAuth();
  const { datos, recargar } = useDatos(async () => {
    const [direccion, movimientos] = await Promise.all([obtenerDireccion(id), movimientosDeDireccion(id)]);
    return { direccion, movimientos };
  });
  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState<Movimiento | null>(null);

  const d = datos?.direccion;
  if (!datos) return <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }} />;
  if (!d) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo, padding: 20 }}>
        <Text style={{ fontFamily: f.medio, color: c.texto }}>Esta dirección no existe.</Text>
      </SafeAreaView>
    );
  }

  const color = colorEstado(c, d.estado, d.atrasada);
  const estadoTexto = d.estado === 'completada' ? 'Completada' : d.atrasada ? 'Atrasada' : 'Pendiente';
  const sinSaldo = d.saldo_cajas + d.saldo_cajones === 0;

  const pedirAnulacion = (m: Movimiento) => {
    if (!esAdmin || m.tipo === 'ajuste' || m.anulado) return;
    setAnulando(m);
  };

  const cabecera = (
    <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 24 }}>
      <View style={estilos.barra}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={26} color={c.texto} />
        </Pressable>
        <Pressable onPress={() => setEditando(true)} hitSlop={10} accessibilityLabel="Editar contacto">
          <Ionicons name="create-outline" size={24} color={c.texto} />
        </Pressable>
      </View>

      <View style={{ gap: 4 }}>
        <View style={estilos.estado}>
          <View style={[estilos.punto, { backgroundColor: color }]} />
          <Text style={{ fontFamily: f.fuerte, color, fontSize: 14 }}>{estadoTexto}</Text>
          {d.estado === 'pendiente' && (
            <Text style={{ fontFamily: f.texto, color: c.textoSuave, fontSize: 14 }}>{diasTexto(d.dias_pendiente)}</Text>
          )}
        </View>
        <Text style={{ fontFamily: f.numero, fontSize: 36, lineHeight: 40, color: c.texto }}>{d.calle}</Text>
        {d.referencia ? <Text style={{ fontFamily: f.texto, fontSize: 16, color: c.textoSuave }}>{d.referencia}</Text> : null}
      </View>

      {d.destino_previsto && !sinSaldo ? (
        <View style={[estilos.contacto, { backgroundColor: c.superficie, borderColor: c.linea }]}>
          <Ionicons name="arrow-forward-circle-outline" size={28} color={c.pendiente} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>Se muda a</Text>
            <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{d.destino_previsto}</Text>
          </View>
        </View>
      ) : null}

      {d.contacto_nombre || d.contacto_telefono ? (
        <Pressable
          disabled={!d.contacto_telefono}
          onPress={() => Linking.openURL(`tel:${d.contacto_telefono}`)}
          style={[estilos.contacto, { backgroundColor: c.superficie, borderColor: c.linea }]}
        >
          <Ionicons name="person-circle-outline" size={28} color={c.textoSuave} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{d.contacto_nombre || 'Cliente'}</Text>
            {d.contacto_telefono ? (
              <Text style={{ fontFamily: f.texto, color: c.textoSuave }}>{d.contacto_telefono}</Text>
            ) : null}
          </View>
          {d.contacto_telefono ? <Ionicons name="call" size={22} color={c.ok} /> : null}
        </Pressable>
      ) : null}

      <View style={[estilos.saldo, { backgroundColor: c.superficie, borderColor: c.linea }]}>
        <Text style={{ fontFamily: f.medio, color: c.textoSuave }}>Quedan en la dirección</Text>
        <Saldo cajas={d.saldo_cajas} cajones={d.saldo_cajones} grande />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Boton
          titulo="Registrar retiro"
          estilo={{ flex: 1 }}
          deshabilitado={sinSaldo}
          onPress={() => router.push({ pathname: '/movimiento/nuevo', params: { direccionId: d.id, tipo: 'retiro' } })}
        />
        <Boton
          titulo="Dejar más"
          variante="secundario"
          estilo={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/movimiento/nuevo', params: { direccionId: d.id, tipo: 'entrega' } })}
        />
      </View>
      {!sinSaldo && (
        <Boton
          titulo="Registrar mudanza"
          variante="secundario"
          onPress={() => router.push({ pathname: '/movimiento/nuevo', params: { direccionId: d.id, tipo: 'mudanza' } })}
        />
      )}

      <Text style={{ fontFamily: f.titulo, fontSize: 24, color: c.texto, marginTop: 8 }}>Movimientos</Text>
      {esAdmin && datos.movimientos.length > 0 && (
        <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave, marginTop: -12 }}>
          Mantené presionado un movimiento para anularlo.
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }} edges={['top']}>
      <FlatList
        data={datos.movimientos}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={cabecera}
        renderItem={({ item, index }) => (
          <MovimientoItem
            m={item}
            ultimo={index === datos.movimientos.length - 1}
            onLongPress={() => pedirAnulacion(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 48 }}
      />
      {editando && (
        <EditarContacto
          inicial={{
            referencia: d.referencia,
            contacto_nombre: d.contacto_nombre,
            contacto_telefono: d.contacto_telefono,
            destino_previsto: d.destino_previsto,
          }}
          onCerrar={() => setEditando(false)}
          onGuardar={async (campos) => {
            await actualizarContacto(d.id, campos);
            setEditando(false);
            recargar();
          }}
        />
      )}
      {anulando && (
        <AnularMovimiento
          m={anulando}
          onCerrar={() => setAnulando(null)}
          onConfirmar={async (motivo) => {
            await anularMovimiento(anulando.id, motivo);
            setAnulando(null);
            recargar();
          }}
        />
      )}
    </SafeAreaView>
  );
}

type Contacto = {
  referencia: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  destino_previsto: string | null;
};

function Hoja({ titulo, children, onCerrar }: { titulo: string; children: ReactNode; onCerrar: () => void }) {
  const { c, f } = useTema();
  return (
    <Modal transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={estilos.fondoModal} onPress={onCerrar} />
      <View style={[estilos.hoja, { backgroundColor: c.fondo }]}>
        <Text style={{ fontFamily: f.titulo, fontSize: 24, color: c.texto }}>{titulo}</Text>
        {children}
      </View>
    </Modal>
  );
}

function EditarContacto({
  inicial,
  onCerrar,
  onGuardar,
}: {
  inicial: Contacto;
  onCerrar: () => void;
  onGuardar: (c: Contacto) => Promise<void>;
}) {
  const { c, f } = useTema();
  const [v, setV] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const input = [estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }];
  const limpiar = (s: string | null) => (s && s.trim() ? s.trim() : null);

  return (
    <Hoja titulo="Datos de la dirección" onCerrar={onCerrar}>
      <TextInput style={input} placeholder="Referencia (ej: apto 302, portería)" placeholderTextColor={c.textoSuave}
        value={v.referencia ?? ''} onChangeText={(t) => setV({ ...v, referencia: t })} />
      <TextInput style={input} placeholder="Nombre del cliente" placeholderTextColor={c.textoSuave}
        value={v.contacto_nombre ?? ''} onChangeText={(t) => setV({ ...v, contacto_nombre: t })} />
      <TextInput style={input} placeholder="Teléfono del cliente" placeholderTextColor={c.textoSuave} keyboardType="phone-pad"
        value={v.contacto_telefono ?? ''} onChangeText={(t) => setV({ ...v, contacto_telefono: t })} />
      <TextInput style={input} placeholder="Se muda a (opcional)" placeholderTextColor={c.textoSuave}
        value={v.destino_previsto ?? ''} onChangeText={(t) => setV({ ...v, destino_previsto: t })} />
      <Boton
        titulo="Guardar datos"
        cargando={guardando}
        onPress={async () => {
          setGuardando(true);
          try {
            await onGuardar({
              referencia: limpiar(v.referencia),
              contacto_nombre: limpiar(v.contacto_nombre),
              contacto_telefono: limpiar(v.contacto_telefono),
              destino_previsto: limpiar(v.destino_previsto),
            });
          } catch (e) {
            avisar('No se pudo guardar', e instanceof Error ? e.message : '');
          } finally {
            setGuardando(false);
          }
        }}
      />
    </Hoja>
  );
}

function AnularMovimiento({
  m,
  onCerrar,
  onConfirmar,
}: {
  m: Movimiento;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const { c, f } = useTema();
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  return (
    <Hoja titulo="Anular movimiento" onCerrar={onCerrar}>
      <Text style={{ fontFamily: f.texto, fontSize: 16, color: c.textoSuave }}>
        {m.tipo === 'mudanza_salida' || m.tipo === 'mudanza_llegada'
          ? `Vas a anular la mudanza de ${cantidades(m.cajas, m.cajones)} ${m.tipo === 'mudanza_salida' ? 'a' : 'desde'} ${m.contraparte_calle} que registró ${m.usuario_nombre}. Los cajones vuelven a la dirección de origen y la mudanza queda tachada en las dos direcciones.`
          : `Vas a anular ${m.tipo === 'entrega' ? 'la entrega' : 'el retiro'} de ${cantidades(m.cajas, m.cajones)} que registró ${m.usuario_nombre}. El saldo se corrige y el movimiento queda tachado en el historial.`}
      </Text>
      <TextInput
        style={[estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }]}
        placeholder="Motivo (ej: se cargó en la dirección equivocada)"
        placeholderTextColor={c.textoSuave}
        value={motivo}
        onChangeText={setMotivo}
      />
      <Boton
        titulo="Anular movimiento"
        variante="peligro"
        cargando={cargando}
        deshabilitado={motivo.trim().length < 3}
        onPress={async () => {
          setCargando(true);
          try {
            await onConfirmar(motivo);
          } catch (e) {
            avisar('No se pudo anular', e instanceof Error ? e.message : '');
          } finally {
            setCargando(false);
          }
        }}
      />
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  contacto: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  saldo: { padding: 20, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: { padding: 24, paddingBottom: 40, gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
});
