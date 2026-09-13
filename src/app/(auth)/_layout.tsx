import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CarregandoSobreposto } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function LayoutAuth() {
  const { sessao, perfil, carregando } = useAuth();

  if (!carregando && sessao && perfil) return <Redirect href="/" />;

  return (
    <View style={estilos.flex}>
      <Stack screenOptions={{ headerShown: false }} />
      {carregando ? <CarregandoSobreposto /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
});
