import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CarregandoSobreposto } from '@/components/ui';
import { Cores } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function LayoutCidadao() {
  const { sessao, perfil, carregando } = useAuth();

  if (!carregando && (!sessao || !perfil)) return <Redirect href="/(auth)/login" />;
  if (!carregando && perfil?.papel === 'admin') return <Redirect href="/(admin)/municipios" />;
  if (!carregando && perfil?.papel === 'gestor') return <Redirect href="/(gestor)" />;

  return (
    <View style={estilos.flex}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Cores.primaria,
          tabBarInactiveTintColor: Cores.textoSecundario,
        }}>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="solicitar"
          options={{
            title: 'Solicitar',
            tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="pedidos"
          options={{
            title: 'Meus pedidos',
            tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
          }}
        />
      </Tabs>
      {carregando ? <CarregandoSobreposto /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
});
