import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CarregandoSobreposto } from '@/components/ui';
import { Cores } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function LayoutAdmin() {
  const { sessao, perfil, carregando } = useAuth();

  if (!carregando && (!sessao || !perfil)) return <Redirect href="/(auth)/login" />;
  if (!carregando && perfil?.papel === 'gestor') return <Redirect href="/(gestor)" />;
  if (!carregando && perfil && perfil.papel !== 'admin') return <Redirect href="/(cidadao)" />;

  return (
    <View style={estilos.flex}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Cores.primaria,
          tabBarInactiveTintColor: Cores.textoSecundario,
        }}>
        <Tabs.Screen
          name="municipios"
          options={{
            title: 'Contratantes',
            tabBarIcon: ({ color, size }) => <Ionicons name="business" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="usuarios"
          options={{
            title: 'Usuários',
            tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
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
