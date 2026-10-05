import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Boton } from '../src/components/Boton';
import { Pantalla } from '../src/components/Pantalla';
import { actualizarUsuario, crearUsuario, listarUsuarios } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { iniciales } from '../src/lib/formato';
import { useDatos } from '../src/lib/hooks';
import type { Perfil, Rol } from '../src/lib/types';
import { useTema } from '../src/theme';

export default function Usuarios() {
  const { c, f } = useTema();
  const { perfil: yo, esAdmin } = useAuth();
  const { datos, recargar } = useDatos(listarUsuarios, ['perfiles']);
  const [creando, setCreando] = useState(false);

  if (!esAdmin) {
    return (
      <Pantalla titulo="Usuarios">
        <Text style={{ fontFamily: f.medio, color: c.texto, padding: 20 }}>Solo los administradores pueden ver esta sección.</Text>
      </Pantalla>
    );
  }

  const cambiar = async (u: Perfil, cambios: Partial<Pick<Perfil, 'rol' | 'activo'>>) => {
    try {
      await actualizarUsuario(u.id, cambios);
      recargar();
    } catch (e) {
      Alert.alert('No se pudo actualizar', e instanceof Error ? e.message : '');
    }
  };

  return (
    <Pantalla
      titulo="Usuarios"
      subtitulo="Quién puede registrar movimientos"
      accion={
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="close" size={28} color={c.texto} />
        </Pressable>
      }
    >
      <FlatList
        data={datos ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={
          creando ? (
            <FormularioUsuario
              onCancelar={() => setCreando(false)}
              onCreado={() => {
                setCreando(false);
                recargar();
              }}
            />
          ) : (
            <Boton titulo="Agregar empleado" onPress={() => setCreando(true)} estilo={{ marginBottom: 6 }} />
          )
        }
        renderItem={({ item: u }) => {
          const soyYo = u.id === yo?.id;
          return (
            <View style={[estilos.fila, { backgroundColor: c.superficie, borderColor: c.linea, opacity: u.activo ? 1 : 0.55 }]}>
              <View style={[estilos.avatar, { backgroundColor: c.superficieAlt }]}>
                <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{iniciales(u.nombre)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: f.fuerte, fontSize: 16, color: c.texto }}>
                  {u.nombre}
                  {soyYo ? ' (vos)' : ''}
                </Text>
                <Pressable
                  disabled={soyYo}
                  onPress={() => cambiar(u, { rol: u.rol === 'administrador' ? 'operario' : 'administrador' })}
                  hitSlop={6}
                >
                  <Text style={{ fontFamily: f.medio, fontSize: 14, color: c.textoSuave }}>
                    {u.rol === 'administrador' ? 'Administrador' : 'Operario'}
                    {soyYo ? '' : ' · tocar para cambiar'}
                  </Text>
                </Pressable>
              </View>
              <Switch
                value={u.activo}
                disabled={soyYo}
                onValueChange={(activo) => cambiar(u, { activo })}
                trackColor={{ true: c.ok, false: c.linea }}
                accessibilityLabel={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
              />
            </View>
          );
        }}
      />
    </Pantalla>
  );
}

function FormularioUsuario({ onCancelar, onCreado }: { onCancelar: () => void; onCreado: () => void }) {
  const { c, f } = useTema();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState<Rol>('operario');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const input = [estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }];

  const crear = async () => {
    setCargando(true);
    setError(null);
    try {
      await crearUsuario({ nombre: nombre.trim(), email: email.trim(), password, telefono: telefono.trim() || undefined, rol });
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el usuario.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <Text style={{ fontFamily: f.titulo, fontSize: 22, color: c.texto }}>Nuevo empleado</Text>
      <TextInput style={input} placeholder="Nombre y apellido" placeholderTextColor={c.textoSuave} value={nombre} onChangeText={setNombre} />
      <TextInput style={input} placeholder="Email" placeholderTextColor={c.textoSuave} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={input} placeholder="Contraseña inicial (mínimo 8)" placeholderTextColor={c.textoSuave} value={password}
        onChangeText={setPassword} secureTextEntry />
      <TextInput style={input} placeholder="Celular (para WhatsApp, opcional)" placeholderTextColor={c.textoSuave} value={telefono}
        onChangeText={setTelefono} keyboardType="phone-pad" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['operario', 'administrador'] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRol(r)}
            style={[estilos.chip, { borderColor: c.linea, backgroundColor: rol === r ? c.texto : c.superficie }]}
          >
            <Text style={{ fontFamily: f.medio, color: rol === r ? c.fondo : c.texto }}>
              {r === 'operario' ? 'Operario' : 'Administrador'}
            </Text>
          </Pressable>
        ))}
      </View>
      {error && <Text style={{ fontFamily: f.medio, color: c.atrasada }}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} estilo={{ flex: 1 }} />
        <Boton titulo="Crear empleado" onPress={crear} cargando={cargando} estilo={{ flex: 1 }}
          deshabilitado={!nombre.trim() || !email.trim() || password.length < 8} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
});
