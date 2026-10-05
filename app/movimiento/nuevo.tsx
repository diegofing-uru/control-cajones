import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton } from '../../src/components/Boton';
import { IconoCaja, IconoCajon } from '../../src/components/Iconos';
import { Stepper } from '../../src/components/Stepper';
import { ErrorNegocio, buscarDirecciones, obtenerDireccion } from '../../src/lib/api';
import { enviarOEncolar } from '../../src/lib/colaOffline';
import { cantidades, plural } from '../../src/lib/formato';
import { useDebounce } from '../../src/lib/hooks';
import type { Direccion } from '../../src/lib/types';
import { uuid } from '../../src/lib/uuid';
import { useTema } from '../../src/theme';

type Tipo = 'entrega' | 'retiro';

export default function NuevoMovimiento() {
  const params = useLocalSearchParams<{ direccionId?: string; tipo?: Tipo }>();
  const { c, f } = useTema();

  const [tipo, setTipo] = useState<Tipo>(params.tipo === 'retiro' ? 'retiro' : 'entrega');
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [calleNueva, setCalleNueva] = useState<string | null>(null); // dirección que todavía no existe
  const [referencia, setReferencia] = useState('');
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState<Direccion[]>([]);
  const [cajas, setCajas] = useState(0);
  const [cajones, setCajones] = useState(0);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<null | 'enviado' | 'en-cola'>(null);
  const consulta = useDebounce(texto, 250);
  const confirmacion = useRef(new Animated.Value(0)).current;

  // Dirección preseleccionada (desde el detalle)
  useEffect(() => {
    if (params.direccionId) obtenerDireccion(params.direccionId).then(setDireccion).catch(() => {});
  }, [params.direccionId]);

  // Sugerencias mientras se escribe
  useEffect(() => {
    if (!consulta.trim() || direccion || calleNueva) {
      setSugerencias([]);
      return;
    }
    let vigente = true;
    buscarDirecciones(consulta)
      .then((r) => vigente && setSugerencias(r))
      .catch(() => vigente && setSugerencias([]));
    return () => {
      vigente = false;
    };
  }, [consulta, direccion, calleNueva]);

  // Al pasar a retiro, no permitir más de lo que hay
  const maxCajas = tipo === 'retiro' ? (direccion?.saldo_cajas ?? 0) : undefined;
  const maxCajones = tipo === 'retiro' ? (direccion?.saldo_cajones ?? 0) : undefined;
  useEffect(() => {
    if (maxCajas !== undefined && cajas > maxCajas) setCajas(maxCajas);
    if (maxCajones !== undefined && cajones > maxCajones) setCajones(maxCajones);
  }, [maxCajas, maxCajones, cajas, cajones]);

  const tieneDireccion = !!direccion || !!calleNueva;
  const retiroSinDireccion = tipo === 'retiro' && !direccion;
  const puedeGuardar = tieneDireccion && !retiroSinDireccion && cajas + cajones > 0 && !guardando;

  const elegir = (d: Direccion) => {
    Haptics.selectionAsync();
    setDireccion(d);
    setTexto('');
  };

  const limpiarDireccion = () => {
    if (params.direccionId) return;
    setDireccion(null);
    setCalleNueva(null);
    setReferencia('');
  };

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const resultado = await enviarOEncolar({
        client_id: uuid(),
        tipo,
        cajas,
        cajones,
        direccion_id: direccion?.id,
        calle: direccion ? undefined : (calleNueva ?? undefined),
        referencia: referencia.trim() || undefined,
        nota: nota.trim() || undefined,
        registrado_en: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setListo(resultado);
      Animated.spring(confirmacion, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
      setTimeout(() => router.back(), 1100);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof ErrorNegocio ? e.message : 'No se pudo guardar. Probá de nuevo.');
      setGuardando(false);
    }
  };

  const input = [estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }];
  const verbo = tipo === 'entrega' ? 'Guardar entrega' : 'Guardar retiro';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={estilos.barra}>
          <Text style={{ fontFamily: f.numero, fontSize: 30, color: c.texto }}>Nuevo movimiento</Text>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={28} color={c.texto} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* 1. Tipo */}
          <View style={[estilos.segmento, { backgroundColor: c.superficieAlt }]}>
            {(['entrega', 'retiro'] as const).map((t) => {
              const activo = tipo === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTipo(t);
                  }}
                  style={[estilos.opcion, activo && { backgroundColor: c.superficie, borderColor: c.linea }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                >
                  <Ionicons
                    name={t === 'entrega' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={22}
                    color={activo ? (t === 'entrega' ? c.kraft : c.ok) : c.textoSuave}
                  />
                  <Text style={{ fontFamily: f.fuerte, fontSize: 17, color: activo ? c.texto : c.textoSuave }}>
                    {t === 'entrega' ? 'Dejé' : 'Retiré'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 2. Dirección */}
          {direccion || calleNueva ? (
            <Pressable
              onPress={limpiarDireccion}
              style={[estilos.elegida, { backgroundColor: c.superficie, borderColor: c.linea }]}
            >
              <Ionicons name="location" size={22} color={c.texto} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: f.titulo, fontSize: 21, color: c.texto }}>{direccion?.calle ?? calleNueva}</Text>
                <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave }}>
                  {direccion
                    ? `Hay ${plural(direccion.saldo_cajas, 'caja', 'cajas')} y ${plural(direccion.saldo_cajones, 'cajón', 'cajones')}`
                    : 'Dirección nueva'}
                </Text>
              </View>
              {!params.direccionId && <Text style={{ fontFamily: f.medio, color: c.textoSuave }}>Cambiar</Text>}
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <TextInput
                style={input}
                placeholder="Dirección (ej: Av. Italia 2345)"
                placeholderTextColor={c.textoSuave}
                value={texto}
                onChangeText={setTexto}
                autoCorrect={false}
                autoFocus={!params.direccionId}
              />
              {sugerencias.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => elegir(d)}
                  style={[estilos.sugerencia, { backgroundColor: c.superficie, borderColor: c.linea }]}
                >
                  <Ionicons name="location-outline" size={20} color={c.textoSuave} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{d.calle}</Text>
                    <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>
                      {d.saldo_cajas + d.saldo_cajones > 0 ? `Quedan ${cantidades(d.saldo_cajas, d.saldo_cajones)}` : 'Sin cajas'}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {texto.trim().length > 3 && tipo === 'entrega' && (
                <Pressable
                  onPress={() => {
                    setCalleNueva(texto.trim());
                    setTexto('');
                  }}
                  style={[estilos.sugerencia, { borderColor: c.linea, borderStyle: 'dashed' }]}
                >
                  <Ionicons name="add-circle-outline" size={20} color={c.texto} />
                  <Text style={{ fontFamily: f.medio, color: c.texto, flex: 1 }}>Nueva dirección: "{texto.trim()}"</Text>
                </Pressable>
              )}
              {tipo === 'retiro' && texto.trim().length > 2 && consulta === texto && sugerencias.length === 0 && (
                <Text style={{ fontFamily: f.texto, color: c.textoSuave }}>
                  No hay cajas registradas en direcciones que coincidan.
                </Text>
              )}
            </View>
          )}

          {calleNueva && (
            <TextInput
              style={input}
              placeholder="Referencia (opcional: apto, portería…)"
              placeholderTextColor={c.textoSuave}
              value={referencia}
              onChangeText={setReferencia}
            />
          )}

          {/* 3. Cantidades */}
          <Stepper
            etiqueta="Cajas"
            icono={<IconoCaja size={24} color={c.kraft} />}
            valor={cajas}
            onCambio={setCajas}
            max={maxCajas}
            ayuda={tipo === 'retiro' && direccion ? `Máximo ${direccion.saldo_cajas}` : 'Mantené presionado para sumar de a 5'}
          />
          <Stepper
            etiqueta="Cajones"
            icono={<IconoCajon size={24} color={c.madera} />}
            valor={cajones}
            onCambio={setCajones}
            max={maxCajones}
            ayuda={tipo === 'retiro' && direccion ? `Máximo ${direccion.saldo_cajones}` : undefined}
          />

          <TextInput
            style={[input, { height: 80, paddingTop: 14, textAlignVertical: 'top' }]}
            placeholder="Nota (opcional: dónde quedaron, con quién hablaste…)"
            placeholderTextColor={c.textoSuave}
            value={nota}
            onChangeText={setNota}
            multiline
          />

          {error && (
            <View style={[estilos.error, { borderColor: c.atrasada }]}>
              <Ionicons name="alert-circle" size={20} color={c.atrasada} />
              <Text style={{ fontFamily: f.medio, color: c.texto, flex: 1 }}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[estilos.pie, { borderTopColor: c.linea, backgroundColor: c.fondo }]}>
          {tieneDireccion && cajas + cajones > 0 && (
            <Text style={{ fontFamily: f.texto, color: c.textoSuave, textAlign: 'center' }}>
              {tipo === 'entrega' ? 'Dejás' : 'Retirás'} {cantidades(cajas, cajones)}
            </Text>
          )}
          <Boton titulo={verbo} onPress={guardar} deshabilitado={!puedeGuardar} cargando={guardando && !listo} />
        </View>
      </KeyboardAvoidingView>

      {listo && (
        <View style={[StyleSheet.absoluteFill, estilos.overlay, { backgroundColor: c.fondo }]}>
          <Animated.View style={{ transform: [{ scale: confirmacion }], alignItems: 'center', gap: 12 }}>
            <Ionicons
              name={listo === 'enviado' ? 'checkmark-circle' : 'cloud-offline'}
              size={96}
              color={listo === 'enviado' ? c.ok : c.pendiente}
            />
            <Text style={{ fontFamily: f.numero, fontSize: 32, color: c.texto }}>
              {tipo === 'entrega' ? 'Entrega guardada' : 'Retiro guardado'}
            </Text>
            {listo === 'en-cola' && (
              <Text style={{ fontFamily: f.texto, fontSize: 16, color: c.textoSuave, textAlign: 'center', paddingHorizontal: 32 }}>
                Sin señal: se envía solo cuando vuelva la conexión.
              </Text>
            )}
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  segmento: { flexDirection: 'row', padding: 4, borderRadius: 16, gap: 4 },
  opcion: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  input: { minHeight: 56, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 17 },
  elegida: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  sugerencia: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  pie: { padding: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  overlay: { alignItems: 'center', justifyContent: 'center' },
});
