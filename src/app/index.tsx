import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Carregando } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { sessao, perfil, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={estilos.flex}>
        <Carregando />
      </View>
    );
  }
  if (!sessao || !perfil) return <Redirect href="/(auth)/login" />;
  if (perfil.papel === 'admin') return <Redirect href="/(admin)/municipios" />;
  if (perfil.papel === 'gestor') return <Redirect href="/(gestor)" />;
  return <Redirect href="/(cidadao)" />;
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
});
