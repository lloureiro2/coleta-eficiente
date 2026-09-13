import 'react-native-gesture-handler';
import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Cores } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RegistrarPush } from '@/lib/notificacoes';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function EsconderSplash() {
  const { carregando } = useAuth();

  useEffect(() => {
    if (!carregando) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [carregando]);

  return null;
}

export default function LayoutRaiz() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Cores.fundo }}>
      <SafeAreaProvider>
        <AuthProvider>
          <EsconderSplash />
          <RegistrarPush />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { flex: 1, backgroundColor: Cores.fundo },
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
