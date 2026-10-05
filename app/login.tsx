import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
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
import { Boton } from '../src/components/Boton';
import { IconoCaja, IconoCajon } from '../src/components/Iconos';
import { useAuth } from '../src/lib/auth';
import { DEMO, USUARIOS_DEMO, reiniciarDemo } from '../src/lib/demo';
import { useTema } from '../src/theme';

type Modo = 'ingresar' | 'registrarse';

export default function Login() {
  const { c, f } = useTema();
  const { ingresar, registrarse } = useAuth();
  const [modo, setModo] = useState<Modo>('ingresar');
  const [nombre, setNombre] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [registrado, setRegistrado] = useState(false);

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError(null);
  };

  const enviar = async () => {
    setCargando(true);
    setError(null);
    if (modo === 'ingresar') {
      setError(await ingresar(identificador, password));
    } else {
      const r = await registrarse(nombre, identificador, password);
      if (r.tipo === 'error') setError(r.mensaje);
      if (r.tipo === 'pendiente') {
        setRegistrado(true);
        setPassword('');
      }
    }
    setCargando(false);
  };

  const input = [estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }];
  const completo = identificador.trim() && password && (modo === 'ingresar' || nombre.trim());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.barra }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={estilos.marca}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <IconoCaja size={44} color={c.kraft} />
              <IconoCajon size={44} color={c.cinta} />
            </View>
            <Text style={{ fontFamily: f.numero, fontSize: 44, color: c.sobreBarra, lineHeight: 46 }}>
              Control de{'\n'}cajones
            </Text>
            <Text style={{ fontFamily: f.texto, fontSize: 16, color: c.sobreBarra, opacity: 0.7 }}>
              Cada caja que sale, vuelve.
            </Text>
          </View>

          <View style={[estilos.panel, { backgroundColor: c.fondo }]}>
            {registrado ? (
              <View style={{ gap: 14, paddingVertical: 8 }}>
                <Ionicons name="hourglass-outline" size={40} color={c.pendiente} />
                <Text style={{ fontFamily: f.titulo, fontSize: 26, color: c.texto }}>Cuenta creada</Text>
                <Text style={{ fontFamily: f.texto, fontSize: 16, color: c.textoSuave }}>
                  Un administrador tiene que aprobarla. Cuando lo haga, vas a poder ingresar con tu{' '}
                  {identificador.includes('@') ? 'email' : 'celular'} y tu contraseña.
                </Text>
                <Boton
                  titulo="Volver a ingresar"
                  onPress={() => {
                    setRegistrado(false);
                    cambiarModo('ingresar');
                  }}
                />
              </View>
            ) : (
              <>
                <View style={[estilos.segmento, { backgroundColor: c.superficieAlt }]}>
                  {(['ingresar', 'registrarse'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => cambiarModo(m)}
                      style={[estilos.opcion, modo === m && { backgroundColor: c.superficie, borderColor: c.linea }]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: modo === m }}
                    >
                      <Text style={{ fontFamily: f.fuerte, fontSize: 16, color: modo === m ? c.texto : c.textoSuave }}>
                        {m === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {modo === 'registrarse' && (
                  <TextInput
                    style={input}
                    placeholder="Nombre y apellido"
                    placeholderTextColor={c.textoSuave}
                    autoComplete="name"
                    value={nombre}
                    onChangeText={setNombre}
                  />
                )}
                <TextInput
                  style={input}
                  placeholder="Email o celular"
                  placeholderTextColor={c.textoSuave}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  value={identificador}
                  onChangeText={setIdentificador}
                />
                <View>
                  <TextInput
                    style={[input, { paddingRight: 52 }]}
                    placeholder={modo === 'registrarse' ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña'}
                    placeholderTextColor={c.textoSuave}
                    secureTextEntry={!verPassword}
                    autoComplete={modo === 'registrarse' ? 'new-password' : 'current-password'}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={enviar}
                  />
                  <Pressable
                    onPress={() => setVerPassword(!verPassword)}
                    style={estilos.ojo}
                    hitSlop={8}
                    accessibilityLabel={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Ionicons name={verPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.textoSuave} />
                  </Pressable>
                </View>
                {modo === 'registrarse' && (
                  <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave }}>
                    Podés usar tu email o tu celular (ej: 099 123 456). Un administrador aprueba la cuenta antes del primer
                    ingreso.
                  </Text>
                )}
                {error && <Text style={{ color: c.atrasada, fontFamily: f.medio }}>{error}</Text>}
                <Boton
                  titulo={modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
                  onPress={enviar}
                  cargando={cargando}
                  deshabilitado={!completo}
                />

                {DEMO && modo === 'ingresar' && (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <Text style={{ fontFamily: f.medio, color: c.textoSuave }}>Versión de prueba. Entrar como:</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {USUARIOS_DEMO.map((u) => (
                        <Pressable
                          key={u.identificador}
                          onPress={() => {
                            setIdentificador(u.identificador);
                            setPassword(u.password);
                          }}
                          style={[estilos.demo, { borderColor: c.linea, backgroundColor: c.superficie }]}
                        >
                          <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{u.nombre.split(' ')[0]}</Text>
                          <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>
                            {u.rol === 'administrador' ? 'Administradora, con email' : 'Operario, con celular'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={reiniciarDemo} hitSlop={8}>
                      <Text style={{ fontFamily: f.medio, color: c.textoSuave, textDecorationLine: 'underline' }}>
                        Reiniciar datos de prueba
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  marca: { flex: 1, minHeight: 220, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 32, gap: 12 },
  panel: { padding: 24, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
  segmento: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  opcion: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  demo: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 17 },
  ojo: { position: 'absolute', right: 16, top: 17 },
});
