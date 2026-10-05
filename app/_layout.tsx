import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { iniciarSincronizacionAutomatica } from '../src/lib/colaOffline';
import { useTema } from '../src/theme';

SplashScreen.preventAutoHideAsync();

function Navegacion() {
  const { cargando, session } = useAuth();
  const { c, oscuro } = useTema();
  const [fuentesListas] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  useEffect(() => {
    if (!cargando && fuentesListas) SplashScreen.hideAsync();
  }, [cargando, fuentesListas]);

  useEffect(() => {
    if (!session) return;
    const cancelar = iniciarSincronizacionAutomatica();
    return cancelar;
  }, [session]);

  if (cargando || !fuentesListas) return null;

  return (
    <>
      <StatusBar style={oscuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="direccion/[id]" />
          <Stack.Screen name="movimiento/nuevo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="usuarios" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Navegacion />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
