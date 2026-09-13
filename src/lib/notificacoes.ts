import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { supabase } from './supabase';

async function moduloNotificacoes() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

let handlerConfigurado = false;

async function garantirHandler() {
  if (handlerConfigurado || Platform.OS === 'web') return;
  handlerConfigurado = true;
  try {
    const Notifications = await moduloNotificacoes();
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Expo Go no Android (SDK 53+) pode não ter o módulo nativo de push.
  }
}

export async function registrarTokenPush(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    await garantirHandler();
    const Notifications = await moduloNotificacoes();
    if (!Notifications) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('status-coleta', {
        name: 'Status da coleta',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    let status = atual.status;
    if (status !== 'granted') {
      const pedido = await Notifications.requestPermissionsAsync();
      status = pedido.status;
    }
    if (status !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    const token = (
      await (projectId
        ? Notifications.getExpoPushTokenAsync({ projectId })
        : Notifications.getExpoPushTokenAsync())
    ).data;

    await supabase.from('dispositivos_push').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        plataforma: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' }
    );
  } catch {
    // Expo Go no Android (SDK 53+) não entrega push remoto.
  }
}

/** Pede permissão e grava o token depois do login. */
export function RegistrarPush() {
  const { perfil } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!perfil) return;
    void registrarTokenPush(perfil.id);
  }, [perfil]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelar: (() => void) | undefined;
    void (async () => {
      const Notifications = await moduloNotificacoes();
      if (!Notifications) return;
      const sub = Notifications.addNotificationResponseReceivedListener(() => {
        router.push('/(cidadao)/pedidos');
      });
      cancelar = () => sub.remove();
    })();
    return () => cancelar?.();
  }, [router]);

  return null;
}
