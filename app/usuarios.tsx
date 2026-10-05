import { Ionicons } from '@expo/vector-icons';
import { avisar } from '../src/lib/avisar';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Boton } from '../src/components/Boton';
import { Pantalla } from '../src/components/Pantalla';
import { actualizarUsuario, aprobarUsuario, listarUsuarios, rechazarUsuario, restablecerContrasena } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { iniciales } from '../src/lib/formato';
import { useDatos } from '../src/lib/hooks';
import { mostrarCelular } from '../src/lib/identificador';
import type { Perfil } from '../src/lib/types';
import { useTema } from '../src/theme';

const contacto = (u: Perfil) => [u.email, mostrarCelular(u.telefono)].filter(Boolean).join('  ·  ');

export default function Usuarios() {
  const { c, f } = useTema();
  const { perfil: yo, esAdmin } = useAuth();
  const { datos, refrescando, recargar } = useDatos(listarUsuarios, ['perfiles']);
  const [cambiandoClave, setCambiandoClave] = useState<Perfil | null>(null);

  if (!esAdmin) {
    return (
      <Pantalla titulo="Usuarios">
        <Text style={{ fontFamily: f.medio, color: c.texto, padding: 20 }}>Solo los administradores pueden ver esta sección.</Text>
      </Pantalla>
    );
  }

  const ejecutar = async (accion: () => Promise<void>) => {
    try {
      await accion();
      recargar();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Probá de nuevo.';
      avisar('No se pudo completar', mensaje);
    }
  };

  const pendientes = (datos ?? []).filter((u) => u.pendiente);
  const equipo = (datos ?? []).filter((u) => !u.pendiente);

  const Avatar = ({ u }: { u: Perfil }) => (
    <View style={[estilos.avatar, { backgroundColor: c.superficieAlt }]}>
      <Text style={{ fontFamily: f.fuerte, color: c.texto }}>{iniciales(u.nombre)}</Text>
    </View>
  );

  return (
    <Pantalla
      titulo="Usuarios"
      subtitulo="Quién puede usar la app"
      accion={
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="close" size={28} color={c.texto} />
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} tintColor={c.textoSuave} />}
      >
        {pendientes.length > 0 && (
          <>
            <Text style={[estilos.seccion, { fontFamily: f.titulo, color: c.texto }]}>
              Esperando aprobación ({pendientes.length})
            </Text>
            {pendientes.map((u) => (
              <View key={u.id} style={[estilos.tarjeta, { backgroundColor: c.superficie, borderColor: c.pendiente }]}>
                <View style={estilos.fila}>
                  <Avatar u={u} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: f.fuerte, fontSize: 16, color: c.texto }}>{u.nombre}</Text>
                    <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave }}>{contacto(u)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Boton
                    titulo="Rechazar"
                    variante="secundario"
                    estilo={{ flex: 1, minHeight: 46 }}
                    onPress={() => ejecutar(() => rechazarUsuario(u.id))}
                  />
                  <Boton titulo="Aprobar" estilo={{ flex: 1, minHeight: 46 }} onPress={() => ejecutar(() => aprobarUsuario(u.id))} />
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={[estilos.seccion, { fontFamily: f.titulo, color: c.texto }]}>Equipo</Text>
        <Text style={{ fontFamily: f.texto, fontSize: 14, color: c.textoSuave, marginTop: -6 }}>
          Tocá el rol para cambiarlo. El interruptor activa o desactiva la cuenta.
        </Text>
        {equipo.map((u) => {
          const soyYo = u.id === yo?.id;
          return (
            <View
              key={u.id}
              style={[estilos.tarjeta, { backgroundColor: c.superficie, borderColor: c.linea, opacity: u.activo ? 1 : 0.6 }]}
            >
              <View style={estilos.fila}>
                <Avatar u={u} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: f.fuerte, fontSize: 16, color: c.texto }}>
                    {u.nombre}
                    {soyYo ? ' (vos)' : ''}
                  </Text>
                  <Text style={{ fontFamily: f.texto, fontSize: 13, color: c.textoSuave }}>{contacto(u)}</Text>
                </View>
                <Switch
                  value={u.activo}
                  disabled={soyYo}
                  onValueChange={(activo) => ejecutar(() => actualizarUsuario(u.id, { activo }))}
                  trackColor={{ true: c.ok, false: c.linea }}
                  accessibilityLabel={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                />
              </View>
              <View style={estilos.acciones}>
                <Pressable
                  disabled={soyYo}
                  onPress={() =>
                    ejecutar(() => actualizarUsuario(u.id, { rol: u.rol === 'administrador' ? 'operario' : 'administrador' }))
                  }
                  style={[estilos.chip, { borderColor: c.linea, backgroundColor: u.rol === 'administrador' ? c.texto : c.superficie }]}
                >
                  <Text style={{ fontFamily: f.medio, color: u.rol === 'administrador' ? c.fondo : c.texto }}>
                    {u.rol === 'administrador' ? 'Administrador' : 'Operario'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setCambiandoClave(u)} hitSlop={6} style={estilos.enlace}>
                  <Ionicons name="key-outline" size={16} color={c.textoSuave} />
                  <Text style={{ fontFamily: f.medio, color: c.textoSuave }}>Nueva contraseña</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {cambiandoClave && (
        <NuevaContrasena
          u={cambiandoClave}
          onCerrar={() => setCambiandoClave(null)}
          onGuardar={async (pw) => {
            await restablecerContrasena(cambiandoClave.id, pw);
            setCambiandoClave(null);
          }}
        />
      )}
    </Pantalla>
  );
}

function NuevaContrasena({ u, onCerrar, onGuardar }: { u: Perfil; onCerrar: () => void; onGuardar: (pw: string) => Promise<void> }) {
  const { c, f } = useTema();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  return (
    <Modal transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={estilos.fondoModal} onPress={onCerrar} />
      <View style={[estilos.hoja, { backgroundColor: c.fondo }]}>
        <Text style={{ fontFamily: f.titulo, fontSize: 24, color: c.texto }}>Nueva contraseña</Text>
        <Text style={{ fontFamily: f.texto, fontSize: 15, color: c.textoSuave }}>
          Para {u.nombre}. Pasásela en persona o por mensaje; puede usarla para ingresar desde ahora.
        </Text>
        <TextInput
          style={[estilos.input, { backgroundColor: c.superficie, borderColor: c.linea, color: c.texto, fontFamily: f.texto }]}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor={c.textoSuave}
          value={pw}
          onChangeText={setPw}
          autoCapitalize="none"
        />
        {error && <Text style={{ fontFamily: f.medio, color: c.atrasada }}>{error}</Text>}
        <Boton
          titulo="Guardar contraseña"
          cargando={cargando}
          deshabilitado={pw.length < 8}
          onPress={async () => {
            setCargando(true);
            setError(null);
            try {
              await onGuardar(pw);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo guardar.');
              setCargando(false);
            }
          }}
        />
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  seccion: { fontSize: 22, marginTop: 8 },
  tarjeta: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  acciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center' },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: { padding: 24, paddingBottom: 40, gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
});
