import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Botao, Campo, Cartao, MensagemErro, Tela } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { supabase, supabaseConfigurado } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setErro(null);
    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setEnviando(false);
    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : `Não foi possível entrar: ${error.message}`
      );
    }
    // Ao entrar, o redirecionamento acontece automaticamente pelo layout.
  }

  return (
    <Tela>
      <View style={estilos.cabecalho}>
        <Text style={estilos.logo}>♻️</Text>
        <Text style={estilos.nome}>Coleta Eficiente</Text>
        <Text style={estilos.slogan}>Reciclagem porta a porta na sua cidade</Text>
      </View>

      {!supabaseConfigurado && (
        <Cartao style={{ backgroundColor: Cores.alertaClaro, borderColor: Cores.alerta }}>
          <Text style={{ color: Cores.alerta, fontWeight: '600' }}>
            Supabase não configurado. Copie .env.example para .env, preencha a URL e a chave do seu
            projeto e reinicie o app. Veja o README.
          </Text>
        </Cartao>
      )}

      <Cartao>
        <MensagemErro texto={erro} />
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="voce@exemplo.com"
        />
        <Campo
          rotulo="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholder="Sua senha"
        />
        <Botao titulo="Entrar" aoTocar={entrar} carregando={enviando} />
      </Cartao>

      <View style={estilos.rodape}>
        <Text style={{ color: Cores.textoSecundario }}>Ainda não tem conta? </Text>
        <Link href="/(auth)/cadastro" style={estilos.link}>
          Criar conta
        </Link>
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: {
    alignItems: 'center',
    marginTop: Espaco.xg,
    marginBottom: Espaco.g,
  },
  logo: {
    fontSize: 56,
  },
  nome: {
    fontSize: 28,
    fontWeight: '800',
    color: Cores.primariaEscura,
    marginTop: Espaco.s,
  },
  slogan: {
    fontSize: 15,
    color: Cores.textoSecundario,
    marginTop: Espaco.xs,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Espaco.s,
  },
  link: {
    color: Cores.primariaEscura,
    fontWeight: '700',
  },
});
