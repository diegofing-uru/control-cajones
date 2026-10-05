import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton } from '../src/components/Boton';
import { IconoCaja, IconoCajon } from '../src/components/Iconos';
import { useAuth } from '../src/lib/auth';
import { DEMO, USUARIOS_DEMO, reiniciarDemo } from '../src/lib/demo';
import { useTema } from '../src/theme';

export default function Login() {
  const { c, f } = useTema();
  const { ingresar } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    setCargando(true);
    setError(await ingresar(email, password));
    setCargando(false);
  };

  const input = [estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.barra }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
          <TextInput
            style={input}
            placeholder="Email"
            placeholderTextColor={c.textoSuave}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={input}
            placeholder="Contraseña"
            placeholderTextColor={c.textoSuave}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={enviar}
          />
          {error && <Text style={{ color: c.atrasada, fontFamily: f.medio }}>{error}</Text>}
          <Boton titulo="Ingresar" onPress={enviar} cargando={cargando} deshabilitado={!email || !password} />
          {DEMO && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={{ fontFamily: f.medio, color: c.textoSuave }}>Versión de prueba. Entrar como:</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {USUARIOS_DEMO.map((u) => (
                  <Pressable
                    key={u.email}
                    onPress={() => {
                      setEmail(u.email);
                      setPassword(u.password);
                    }}
                    style={[estilos.demo, { borderColor: c.linea, backgroundColor: c.superficie }]}
                  >
                    <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{u.nombre.split(' ')[0]}</Text>
                    <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>
                      {u.rol === 'administrador' ? 'Administradora' : 'Operario'}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  marca: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 32, gap: 12 },
  panel: { padding: 24, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 },
  demo: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 17 },
});
