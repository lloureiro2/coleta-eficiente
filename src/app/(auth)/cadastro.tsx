import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Botao, Campo, Cartao, Chip, MensagemErro, Tela, Titulo } from '@/components/ui';
import { Cores, Espaco, Raio } from '@/constants/theme';
import { buscarEnderecoPorCep, formatarCep, somenteDigitosCep } from '@/lib/cep';
import { supabase } from '@/lib/supabase';
import { formatarTelefone, mensagemTelefoneInvalido } from '@/lib/telefone';
import type { GeneroPessoa } from '@/lib/types';

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [genero, setGenero] = useState<GeneroPessoa | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function buscarCep() {
    setErro(null);
    if (somenteDigitosCep(cep).length !== 8) {
      setErro('Informe um CEP com 8 dígitos.');
      return;
    }
    setBuscandoCep(true);
    try {
      const dados = await buscarEnderecoPorCep(cep);
      setCep(dados.cep);
      if (dados.logradouro) setEndereco(dados.logradouro);
      if (dados.bairro) setBairro(dados.bairro);
      setCidade(dados.cidade);
      setUf(dados.uf);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar o CEP.');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function cadastrar() {
    setErro(null);
    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (!nome.trim()) {
      setErro('Preencha o nome completo.');
      return;
    }
    if (!genero) {
      setErro('Informe se você é cidadão ou cidadã.');
      return;
    }
    const erroTelefone = mensagemTelefoneInvalido(telefone);
    if (erroTelefone) {
      setErro(erroTelefone);
      return;
    }
    if (cep.trim() && somenteDigitosCep(cep).length !== 8) {
      setErro('Se informar o CEP, use 8 dígitos.');
      return;
    }

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          tipo_conta: 'cidadao',
          nome: nome.trim(),
          telefone: formatarTelefone(telefone),
          endereco: endereco.trim() || null,
          numero: numero.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf.trim() ? uf.trim().toUpperCase().slice(0, 2) : null,
          cep: cep.trim() ? formatarCep(cep) : null,
          genero,
        },
      },
    });
    setEnviando(false);

    if (error) {
      setErro(`Não foi possível criar a conta: ${error.message}`);
      return;
    }
    if (!data.session) {
      setAviso('Conta criada! Confirme seu e-mail e depois faça login.');
      return;
    }
    router.replace('/');
  }

  return (
    <Tela>
      <Titulo sub="Crie sua conta para solicitar coletas na sua cidade.">Criar conta</Titulo>

      <Cartao>
        <MensagemErro texto={erro} />
        {aviso && (
          <View style={estilos.aviso}>
            <Text style={{ color: Cores.primariaEscura, fontWeight: '600' }}>{aviso}</Text>
          </View>
        )}

        <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} placeholder="Seu nome" />

        <Text style={estilos.rotulo}>Você é</Text>
        <View style={estilos.chips}>
          <Chip
            texto="Cidadão"
            selecionado={genero === 'masculino'}
            aoTocar={() => setGenero('masculino')}
          />
          <Chip
            texto="Cidadã"
            selecionado={genero === 'feminino'}
            aoTocar={() => setGenero('feminino')}
          />
        </View>

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
          placeholder="Mínimo de 6 caracteres"
        />
        <Campo
          rotulo="Telefone com DDD"
          value={telefone}
          onChangeText={(t) => setTelefone(formatarTelefone(t))}
          keyboardType="phone-pad"
          placeholder="(00) 00000-0000"
        />

        <Text style={estilos.rotulo}>CEP (opcional)</Text>
        <View style={estilos.linhaCep}>
          <TextInput
            value={cep}
            onChangeText={(t) => setCep(formatarCep(t))}
            keyboardType="number-pad"
            placeholder="00000-000"
            placeholderTextColor={Cores.textoSecundario}
            style={estilos.campoCep}
          />
          <Botao
            titulo="Buscar"
            variante="secundario"
            aoTocar={buscarCep}
            carregando={buscandoCep}
            style={estilos.botaoCep}
          />
        </View>
        <Text style={estilos.dica}>O CEP é opcional. Se informar, use Buscar para preencher o endereço.</Text>
        <Campo
          rotulo="Endereço (opcional)"
          value={endereco}
          onChangeText={setEndereco}
          placeholder="Rua, avenida..."
        />
        <Campo
          rotulo="Número (opcional)"
          value={numero}
          onChangeText={setNumero}
          keyboardType="number-pad"
          placeholder="123"
        />
        <Campo rotulo="Bairro (opcional)" value={bairro} onChangeText={setBairro} placeholder="Seu bairro" />
        <View style={estilos.linhaCidade}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Cidade (opcional)" value={cidade} onChangeText={setCidade} placeholder="Vitória" />
          </View>
          <View style={{ width: 88 }}>
            <Campo
              rotulo="UF"
              value={uf}
              onChangeText={(t) => setUf(t.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              placeholder="ES"
              maxLength={2}
            />
          </View>
        </View>

        <Botao titulo="Criar conta" aoTocar={cadastrar} carregando={enviando} style={{ marginTop: Espaco.s }} />
      </Cartao>

      <View style={estilos.rodape}>
        <Text style={{ color: Cores.textoSecundario }}>Já tem conta? </Text>
        <Link href="/(auth)/login" style={estilos.link}>
          Entrar
        </Link>
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  rotulo: {
    fontSize: 14,
    fontWeight: '600',
    color: Cores.texto,
    marginBottom: Espaco.s,
  },
  chips: {
    flexDirection: 'row',
    gap: Espaco.s,
    marginBottom: Espaco.m,
  },
  linhaCep: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Espaco.s,
    marginBottom: Espaco.m,
  },
  campoCep: {
    flex: 1,
    backgroundColor: Cores.fundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.m,
    paddingHorizontal: Espaco.m,
    paddingVertical: 12,
    fontSize: 16,
    color: Cores.texto,
  },
  botaoCep: {
    paddingHorizontal: Espaco.g,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  linhaCidade: {
    flexDirection: 'row',
    gap: Espaco.s,
  },
  dica: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginBottom: Espaco.m,
  },
  aviso: {
    backgroundColor: Cores.primariaClara,
    borderRadius: Raio.m,
    padding: Espaco.m,
    marginBottom: Espaco.m,
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
