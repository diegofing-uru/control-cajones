import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

type Tipo = 'entrega' | 'retiro' | 'mudanza';

const TIPOS: { valor: Tipo; texto: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { valor: 'mudanza', texto: 'Mudanza', icono: 'swap-horizontal' },
  { valor: 'entrega', texto: 'Dejé', icono: 'arrow-down-circle' },
  { valor: 'retiro', texto: 'Retiré', icono: 'arrow-up-circle' },
];

const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const tieneSaldo = (d: Direccion) => d.saldo_cajas + d.saldo_cajones > 0;

export default function NuevoMovimiento() {
  const params = useLocalSearchParams<{ direccionId?: string; tipo?: Tipo }>();
  const { c, f } = useTema();

  const [tipo, setTipo] = useState<Tipo>(
    params.tipo === 'retiro' || params.tipo === 'mudanza' ? params.tipo : 'entrega',
  );
  // En una mudanza, "direccion" es el origen
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [calleNueva, setCalleNueva] = useState<string | null>(null); // dirección que todavía no existe
  const [referencia, setReferencia] = useState('');
  const [destino, setDestino] = useState<Direccion | null>(null);
  const [destinoNuevo, setDestinoNuevo] = useState<string | null>(null);
  const [destinoReferencia, setDestinoReferencia] = useState('');
  const [destinoPrevisto, setDestinoPrevisto] = useState('');
  const [cajas, setCajas] = useState(0);
  const [cajones, setCajones] = useState(0);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<null | 'enviado' | 'en-cola'>(null);
  // Si se viene del detalle, la dirección queda fija (salvo que se pase a registrar una mudanza)
  const [fija, setFija] = useState(!!params.direccionId);
  const confirmacion = useRef(new Animated.Value(0)).current;
  const esMudanza = tipo === 'mudanza';

  // Dirección preseleccionada (desde el detalle)
  useEffect(() => {
    if (params.direccionId) obtenerDireccion(params.direccionId).then(setDireccion).catch(() => {});
  }, [params.direccionId]);

  // Mudanza: por defecto se muda todo lo que hay, y si al entregar se anotó el destino, viene precargado
  useEffect(() => {
    if (!esMudanza || !direccion) return;
    setCajas(direccion.saldo_cajas);
    setCajones(direccion.saldo_cajones);
    const previsto = direccion.destino_previsto;
    if (!previsto || destino || destinoNuevo) return;
    let vigente = true;
    buscarDirecciones(previsto)
      .then((r) => {
        if (!vigente) return;
        const existente = r.find((d) => normalizar(d.calle) === normalizar(previsto) && d.id !== direccion.id);
        if (existente) setDestino(existente);
        else setDestinoNuevo(previsto);
      })
      .catch(() => vigente && setDestinoNuevo(previsto));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esMudanza, direccion?.id]);

  // En retiros y mudanzas no se puede sacar más de lo que hay
  const conTope = tipo !== 'entrega';
  const maxCajas = conTope ? (direccion?.saldo_cajas ?? 0) : undefined;
  const maxCajones = conTope ? (direccion?.saldo_cajones ?? 0) : undefined;
  useEffect(() => {
    if (maxCajas !== undefined && cajas > maxCajas) setCajas(maxCajas);
    if (maxCajones !== undefined && cajones > maxCajones) setCajones(maxCajones);
  }, [maxCajas, maxCajones, cajas, cajones]);

  const cambiarTipo = (t: Tipo) => {
    Haptics.selectionAsync();
    setError(null);
    setTipo(t);
    if (t !== 'entrega' && calleNueva) setCalleNueva(null); // solo se puede crear una dirección al entregar
  };

  /** Retiro donde no hay nada registrado: probablemente los cajones vinieron con una mudanza */
  const pasarAMudanza = (hacia: Direccion | string) => {
    Haptics.selectionAsync();
    setError(null);
    setTipo('mudanza');
    if (typeof hacia === 'string') {
      setDestino(null);
      setDestinoNuevo(hacia);
    } else {
      setDestino(hacia);
      setDestinoNuevo(null);
    }
    setDireccion(null);
    setFija(false);
  };

  const total = cajas + cajones;
  const tieneDestino = !!destino || !!destinoNuevo;
  const puedeGuardar =
    !guardando &&
    total > 0 &&
    (tipo === 'entrega'
      ? !!direccion || !!calleNueva
      : tipo === 'retiro'
        ? !!direccion
        : !!direccion && tieneDestino && destino?.id !== direccion.id);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const base = {
        client_id: uuid(),
        cajas,
        cajones,
        nota: nota.trim() || undefined,
        registrado_en: new Date().toISOString(),
      };
      const resultado = await enviarOEncolar(
        esMudanza
          ? {
              ...base,
              tipo: 'mudanza',
              direccion_id: direccion!.id,
              destino_id: destino?.id,
              destino_calle: destino ? undefined : (destinoNuevo ?? undefined),
              destino_referencia: destinoReferencia.trim() || undefined,
            }
          : {
              ...base,
              tipo,
              direccion_id: direccion?.id,
              calle: direccion ? undefined : (calleNueva ?? undefined),
              referencia: referencia.trim() || undefined,
              destino_previsto: tipo === 'entrega' ? destinoPrevisto.trim() || undefined : undefined,
            },
      );
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
  const verbo = { entrega: 'Guardar entrega', retiro: 'Guardar retiro', mudanza: 'Guardar mudanza' }[tipo];
  const nombreDestino = destino?.calle ?? destinoNuevo;
  const resumen = {
    entrega: `Dejás ${cantidades(cajas, cajones)}`,
    retiro: `Retirás ${cantidades(cajas, cajones)}`,
    mudanza: `Mudás ${cantidades(cajas, cajones)}${nombreDestino ? ` a ${nombreDestino}` : ''}`,
  }[tipo];
  const mostrarResumen = total > 0 && (!!direccion || !!calleNueva);
  const linkMudanza = (hacia: Direccion | string) => (
    <Pressable onPress={() => pasarAMudanza(hacia)} style={[estilos.sugerencia, { borderColor: c.pendiente }]}>
      <Ionicons name="swap-horizontal" size={20} color={c.pendiente} />
      <Text style={{ fontFamily: f.medio, color: c.texto, flex: 1 }}>
        ¿Los cajones vinieron de otra dirección? Registrá la mudanza
      </Text>
    </Pressable>
  );

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
            {TIPOS.map((t) => {
              const activo = tipo === t.valor;
              const colorIcono = { entrega: c.kraft, retiro: c.ok, mudanza: c.pendiente }[t.valor];
              return (
                <Pressable
                  key={t.valor}
                  onPress={() => cambiarTipo(t.valor)}
                  style={[estilos.opcion, activo && { backgroundColor: c.superficie, borderColor: c.linea }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                >
                  <Ionicons name={t.icono} size={20} color={activo ? colorIcono : c.textoSuave} />
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: f.fuerte, fontSize: 16, color: activo ? c.texto : c.textoSuave, flexShrink: 1 }}
                  >
                    {t.texto}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 2. Dirección (en una mudanza: origen y destino) */}
          <SelectorDireccion
            // Al pasar a mudanza (o volver) cambia qué se busca: se empieza de cero
            key={esMudanza ? 'origen' : 'direccion'}
            etiqueta={esMudanza ? 'Desde (donde están los cajones)' : undefined}
            valor={direccion}
            nueva={tipo === 'entrega' ? calleNueva : null}
            onElegir={(d) => {
              setDireccion(d);
              if (esMudanza && destino?.id === d.id) setDestino(null);
            }}
            onNueva={tipo === 'entrega' ? setCalleNueva : undefined}
            onLimpiar={
              fija
                ? undefined
                : () => {
                    setDireccion(null);
                    setCalleNueva(null);
                    setReferencia('');
                  }
            }
            filtrar={esMudanza ? tieneSaldo : undefined}
            autoFocus={!fija && !esMudanza}
            sinResultados={
              tipo === 'retiro'
                ? (texto) => (
                    <>
                      <Text style={{ fontFamily: f.texto, color: c.textoSuave }}>
                        No hay cajas registradas en direcciones que coincidan.
                      </Text>
                      {linkMudanza(texto)}
                    </>
                  )
                : esMudanza
                  ? () => (
                      <Text style={{ fontFamily: f.texto, color: c.textoSuave }}>
                        No hay direcciones con cajas que coincidan.
                      </Text>
                    )
                  : undefined
            }
          />

          {tipo === 'retiro' && direccion && !tieneSaldo(direccion) && linkMudanza(direccion)}
          {esMudanza && direccion && !tieneSaldo(direccion) && (
            <Text style={{ fontFamily: f.texto, color: c.atrasada }}>En esta dirección no quedan cajas para mudar.</Text>
          )}

          {calleNueva && tipo === 'entrega' && (
            <TextInput
              style={input}
              placeholder="Referencia (opcional: apto, portería…)"
              placeholderTextColor={c.textoSuave}
              value={referencia}
              onChangeText={setReferencia}
            />
          )}

          {esMudanza && (
            <>
              <SelectorDireccion
                etiqueta="Hacia (la dirección nueva)"
                valor={destino}
                nueva={destinoNuevo}
                onElegir={(d) => setDestino(d)}
                onNueva={setDestinoNuevo}
                onLimpiar={() => {
                  setDestino(null);
                  setDestinoNuevo(null);
                  setDestinoReferencia('');
                }}
                filtrar={(d) => d.id !== direccion?.id}
                placeholder="A dónde se mudan (ej: Av. Brasil 2840)"
                autoFocus={!!direccion && !direccion.destino_previsto}
              />
              {destinoNuevo && (
                <TextInput
                  style={input}
                  placeholder="Referencia del destino (opcional: apto, portería…)"
                  placeholderTextColor={c.textoSuave}
                  value={destinoReferencia}
                  onChangeText={setDestinoReferencia}
                />
              )}
            </>
          )}

          {/* 3. Cantidades */}
          <Stepper
            etiqueta="Cajas"
            icono={<IconoCaja size={24} color={c.kraft} />}
            valor={cajas}
            onCambio={setCajas}
            max={maxCajas}
            ayuda={conTope && direccion ? `Máximo ${direccion.saldo_cajas}` : 'Mantené presionado para sumar de a 5'}
          />
          <Stepper
            etiqueta="Cajones"
            icono={<IconoCajon size={24} color={c.madera} />}
            valor={cajones}
            onCambio={setCajones}
            max={maxCajones}
            ayuda={conTope && direccion ? `Máximo ${direccion.saldo_cajones}` : undefined}
          />

          {tipo === 'entrega' && (
            <TextInput
              style={input}
              placeholder="Se muda a (opcional, si ya lo sabés)"
              placeholderTextColor={c.textoSuave}
              value={destinoPrevisto}
              onChangeText={setDestinoPrevisto}
            />
          )}

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
          {mostrarResumen && (
            <Text style={{ fontFamily: f.texto, color: c.textoSuave, textAlign: 'center' }}>{resumen}</Text>
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
              {{ entrega: 'Entrega guardada', retiro: 'Retiro guardado', mudanza: 'Mudanza guardada' }[tipo]}
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

/**
 * Elegir una dirección: buscador con sugerencias o, si se permite, una dirección nueva.
 * Sin onLimpiar la dirección elegida queda fija (por ejemplo, cuando se viene del detalle).
 */
function SelectorDireccion({
  etiqueta,
  valor,
  nueva,
  onElegir,
  onNueva,
  onLimpiar,
  filtrar,
  placeholder = 'Dirección (ej: Av. Italia 2345)',
  autoFocus,
  sinResultados,
}: {
  etiqueta?: string;
  valor: Direccion | null;
  nueva: string | null;
  onElegir: (d: Direccion) => void;
  onNueva?: (calle: string) => void;
  onLimpiar?: () => void;
  filtrar?: (d: Direccion) => boolean;
  placeholder?: string;
  autoFocus?: boolean;
  sinResultados?: (texto: string) => ReactNode;
}) {
  const { c, f } = useTema();
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState<Direccion[]>([]);
  const consulta = useDebounce(texto, 250);
  const elegida = valor || nueva;

  useEffect(() => {
    if (!consulta.trim() || elegida) {
      setSugerencias([]);
      return;
    }
    let vigente = true;
    buscarDirecciones(consulta)
      .then((r) => vigente && setSugerencias(filtrar ? r.filter(filtrar) : r))
      .catch(() => vigente && setSugerencias([]));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, elegida]);

  const titulo = etiqueta ? (
    <Text style={{ fontFamily: f.fuerte, fontSize: 14, color: c.textoSuave }}>{etiqueta}</Text>
  ) : null;

  if (elegida) {
    return (
      <View style={{ gap: 8 }}>
        {titulo}
        <Pressable
          onPress={onLimpiar}
          disabled={!onLimpiar}
          style={[estilos.elegida, { backgroundColor: c.superficie, borderColor: c.linea }]}
        >
          <Ionicons name="location" size={22} color={c.texto} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f.titulo, fontSize: 21, color: c.texto }}>{valor?.calle ?? nueva}</Text>
            <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave }}>
              {valor
                ? `Hay ${plural(valor.saldo_cajas, 'caja', 'cajas')} y ${plural(valor.saldo_cajones, 'cajón', 'cajones')}`
                : 'Dirección nueva'}
            </Text>
          </View>
          {onLimpiar && <Text style={{ fontFamily: f.medio, color: c.textoSuave }}>Cambiar</Text>}
        </Pressable>
      </View>
    );
  }

  const elegir = (d: Direccion) => {
    Haptics.selectionAsync();
    onElegir(d);
    setTexto('');
  };

  return (
    <View style={{ gap: 8 }}>
      {titulo}
      <TextInput
        style={[estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }]}
        placeholder={placeholder}
        placeholderTextColor={c.textoSuave}
        value={texto}
        onChangeText={setTexto}
        autoCorrect={false}
        autoFocus={autoFocus}
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
              {tieneSaldo(d) ? `Quedan ${cantidades(d.saldo_cajas, d.saldo_cajones)}` : 'Sin cajas'}
            </Text>
          </View>
        </Pressable>
      ))}
      {onNueva && texto.trim().length > 3 && (
        <Pressable
          onPress={() => {
            onNueva(texto.trim());
            setTexto('');
          }}
          style={[estilos.sugerencia, { borderColor: c.linea, borderStyle: 'dashed' }]}
        >
          <Ionicons name="add-circle-outline" size={20} color={c.texto} />
          <Text style={{ fontFamily: f.medio, color: c.texto, flex: 1 }}>Nueva dirección: "{texto.trim()}"</Text>
        </Pressable>
      )}
      {sinResultados && texto.trim().length > 2 && consulta === texto && sugerencias.length === 0 && sinResultados(texto.trim())}
    </View>
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
    gap: 6,
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
