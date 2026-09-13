import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cores, Espaco, LarguraMaxima, Raio } from '@/constants/theme';

export function Tela({
  children,
  rolagem = true,
  style,
}: {
  children: ReactNode;
  rolagem?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const conteudo = (
    <View style={[estilos.conteudoTela, { paddingBottom: insets.bottom + Espaco.xg }, style]}>
      {children}
    </View>
  );

  if (!rolagem) {
    return <View style={[estilos.tela, { paddingTop: insets.top }]}>{conteudo}</View>;
  }

  return (
    <ScrollView
      style={[estilos.tela, { paddingTop: insets.top }]}
      contentContainerStyle={estilos.rolagem}
      keyboardShouldPersistTaps="handled">
      {conteudo}
    </ScrollView>
  );
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: Espaco.m }}>
      <Text style={estilos.titulo}>{children}</Text>
      {sub ? <Text style={estilos.subtitulo}>{sub}</Text> : null}
    </View>
  );
}

export function Cartao({
  children,
  style,
  aoTocar,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  aoTocar?: () => void;
}) {
  if (aoTocar) {
    return (
      <Pressable
        onPress={aoTocar}
        style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[estilos.cartao, style]}>{children}</View>;
}

export function Botao({
  titulo,
  aoTocar,
  variante = 'primario',
  carregando = false,
  desabilitado = false,
  style,
}: {
  titulo: string;
  aoTocar: () => void;
  variante?: 'primario' | 'secundario' | 'perigo';
  carregando?: boolean;
  desabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inativo = desabilitado || carregando;
  const fundo =
    variante === 'primario' ? Cores.primaria : variante === 'perigo' ? Cores.perigoClaro : Cores.neutroClaro;
  const corTexto =
    variante === 'primario' ? '#fff' : variante === 'perigo' ? Cores.perigo : Cores.texto;

  return (
    <Pressable
      onPress={aoTocar}
      disabled={inativo}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, opacity: inativo ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[estilos.botaoTexto, { color: corTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({
  rotulo,
  ...props
}: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ marginBottom: Espaco.m }}>
      <Text style={estilos.rotuloCampo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={Cores.textoSecundario}
        {...props}
        style={[estilos.campo, props.multiline && { height: 88, textAlignVertical: 'top' }, props.style]}
      />
    </View>
  );
}

export function Selo({
  texto,
  fundo = Cores.neutroClaro,
  cor = Cores.texto,
}: {
  texto: string;
  fundo?: string;
  cor?: string;
}) {
  return (
    <View style={[estilos.selo, { backgroundColor: fundo }]}>
      <Text style={[estilos.seloTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

export function Chip({
  texto,
  selecionado,
  aoTocar,
  cor,
}: {
  texto: string;
  selecionado: boolean;
  aoTocar: () => void;
  cor?: string | null;
}) {
  const corBase = cor ?? Cores.primaria;
  return (
    <Pressable
      onPress={aoTocar}
      style={[
        estilos.chip,
        selecionado
          ? { backgroundColor: corBase, borderColor: corBase }
          : { backgroundColor: Cores.cartao, borderColor: Cores.borda },
      ]}>
      <Text style={[estilos.chipTexto, { color: selecionado ? '#fff' : Cores.texto }]}>{texto}</Text>
    </Pressable>
  );
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return (
    <View style={estilos.vazio}>
      <Text style={estilos.vazioTexto}>{mensagem}</Text>
    </View>
  );
}

export function Carregando() {
  return (
    <View style={estilos.carregando}>
      <ActivityIndicator size="large" color={Cores.primaria} />
      <Text style={estilos.carregandoTexto}>Carregando…</Text>
    </View>
  );
}

/** Cobre a tela sem desmontar Stack/Tabs — evita tela branca no Expo Router. */
export function CarregandoSobreposto() {
  return (
    <View style={estilos.carregandoSobreposto}>
      <Carregando />
    </View>
  );
}

export function MensagemErro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <View style={estilos.erro}>
      <Text style={estilos.erroTexto}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  rolagem: {
    flexGrow: 1,
  },
  conteudoTela: {
    flex: 1,
    width: '100%',
    maxWidth: LarguraMaxima,
    alignSelf: 'center',
    paddingHorizontal: Espaco.m,
    paddingTop: Espaco.m,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: Cores.texto,
  },
  subtitulo: {
    marginTop: Espaco.xs,
    fontSize: 15,
    color: Cores.textoSecundario,
  },
  cartao: {
    backgroundColor: Cores.cartao,
    borderRadius: Raio.g,
    borderWidth: 1,
    borderColor: Cores.borda,
    padding: Espaco.m,
    marginBottom: Espaco.m,
  },
  botao: {
    borderRadius: Raio.m,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTexto: {
    fontSize: 16,
    fontWeight: '600',
  },
  rotuloCampo: {
    fontSize: 14,
    fontWeight: '600',
    color: Cores.texto,
    marginBottom: Espaco.s,
  },
  campo: {
    backgroundColor: Cores.cartao,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.m,
    paddingHorizontal: Espaco.m,
    paddingVertical: 12,
    fontSize: 16,
    color: Cores.texto,
  },
  selo: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seloTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipTexto: {
    fontSize: 14,
    fontWeight: '600',
  },
  vazio: {
    padding: Espaco.xg,
    alignItems: 'center',
  },
  vazioTexto: {
    fontSize: 15,
    color: Cores.textoSecundario,
    textAlign: 'center',
  },
  carregando: {
    flex: 1,
    minHeight: 160,
    width: '100%',
    backgroundColor: Cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.m,
  },
  carregandoTexto: {
    fontSize: 15,
    color: Cores.textoSecundario,
  },
  carregandoSobreposto: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: Cores.fundo,
  },
  erro: {
    backgroundColor: Cores.perigoClaro,
    borderRadius: Raio.m,
    padding: Espaco.m,
    marginBottom: Espaco.m,
  },
  erroTexto: {
    color: Cores.perigo,
    fontSize: 14,
  },
});
