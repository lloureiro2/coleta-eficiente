import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CarregandoSobreposto } from '@/components/ui';
import { Cores } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function LayoutGestor() {
  const { sessao, perfil, carregando } = useAuth();

  if (!carregando && (!sessao || !perfil)) return <Redirect href="/(auth)/login" />;
  if (!carregando && perfil?.papel === 'admin') return <Redirect href="/(admin)/municipios" />;
  if (!carregando && perfil && perfil.papel !== 'gestor') return <Redirect href="/(cidadao)" />;

  return (
    <View style={estilos.flex}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Cores.primaria,
          tabBarInactiveTintColor: Cores.textoSecundario,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Solicitações',
            tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="rota"
          options={{
            title: 'Rota',
            tabBarIcon: ({ color, size }) => <Ionicons name="navigate" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="equipe"
          options={{
            title: 'Equipe',
            tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
          }}
        />
        <Tabs.Screen name="agenda" options={{ href: null }} />
        <Tabs.Screen
          name="resumo"
          options={{
            title: 'Resumo',
            tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
          }}
        />
        <Tabs.Screen name="solicitacao/[id]" options={{ href: null }} />
      </Tabs>
      {carregando ? <CarregandoSobreposto /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
});
