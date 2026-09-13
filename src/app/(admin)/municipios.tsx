import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Botao, Campo, Carregando, Cartao, Chip, MensagemErro, Selo, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Municipio, TipoMunicipio } from '@/lib/types';

export default function ContratantesAdmin() {
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoMunicipio>('prefeitura');
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('municipios').select('*').order('nome');
    setMunicipios((data as Municipio[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function adicionar() {
    setErro(null);
    const rotulo = tipo === 'cooperativa' ? 'cooperativa' : 'prefeitura';
    if (!nome.trim() || !cidade.trim() || !uf.trim()) {
      setErro('Preencha nome, cidade e UF.');
      return;
    }
    if (!email.trim() || !senha) {
      setErro(`Informe o e-mail e a senha de acesso da ${rotulo}.`);
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setSalvando(true);
    const { error } = await supabase.rpc('criar_contratante', {
      p_nome: nome.trim(),
      p_cidade: cidade.trim(),
      p_uf: uf.trim().toUpperCase().slice(0, 2),
      p_email: email.trim(),
      p_senha: senha,
      p_tipo: tipo,
    });
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível criar: ${error.message}`);
      return;
    }
    setNome('');
    setCidade('');
    setUf('');
    setEmail('');
    setSenha('');
    await carregar();
  }

  if (!municipios) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  const rotuloTipo = tipo === 'cooperativa' ? 'cooperativa' : 'prefeitura';

  return (
    <Tela>
      <Titulo sub="Prefeitura e cooperativa entram com um e-mail de acesso. Pessoas vinculadas viram gestores.">
        Contratantes
      </Titulo>

      <Cartao>
        <Text style={estilos.rotuloSecao}>Novo contratante</Text>
        <MensagemErro texto={erro} />
        <Text style={estilos.rotuloCampo}>Tipo</Text>
        <View style={estilos.chips}>
          <Chip texto="Prefeitura" selecionado={tipo === 'prefeitura'} aoTocar={() => setTipo('prefeitura')} />
          <Chip texto="Cooperativa" selecionado={tipo === 'cooperativa'} aoTocar={() => setTipo('cooperativa')} />
        </View>
        <Campo
          rotulo={`Nome da ${rotuloTipo}`}
          value={nome}
          onChangeText={setNome}
          placeholder={tipo === 'cooperativa' ? 'Ex.: Cooperativa Recicla Vitória' : 'Ex.: Prefeitura de Vila Velha'}
        />
        <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} placeholder="Ex.: Vila Velha" />
        <Campo rotulo="UF" value={uf} onChangeText={setUf} autoCapitalize="characters" placeholder="Ex.: ES" maxLength={2} />
        <Campo
          rotulo="E-mail de acesso"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={tipo === 'cooperativa' ? 'contato@cooperativa.com' : 'prefeitura@cidade.gov.br'}
        />
        <Campo
          rotulo="Senha de acesso"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholder="Mínimo de 6 caracteres"
        />
        <Botao
          titulo={tipo === 'cooperativa' ? 'Criar cooperativa' : 'Criar prefeitura'}
          aoTocar={adicionar}
          carregando={salvando}
        />
        <Text style={estilos.dica}>
          Esta conta é da {rotuloTipo}, identificada pelo e-mail — não é de uma pessoa. Cidadãos e
          cidadãs contratados na Equipe podem ser promovidos a gestores.
        </Text>
      </Cartao>

      {municipios.length === 0 && <Vazio mensagem="Nenhum contratante cadastrado." />}

      {municipios.map((m) => (
        <Cartao key={m.id}>
          <View style={estilos.linhaMunicipio}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nomeMunicipio}>{m.nome}</Text>
              <Text style={estilos.detalheMunicipio}>
                {m.cidade} - {m.uf}
              </Text>
            </View>
            <Selo
              texto={m.tipo === 'prefeitura' ? 'Prefeitura' : 'Cooperativa'}
              fundo={Cores.primariaClara}
              cor={Cores.primariaEscura}
            />
          </View>
        </Cartao>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  rotuloSecao: {
    fontSize: 15,
    fontWeight: '700',
    color: Cores.texto,
    marginBottom: Espaco.m,
  },
  rotuloCampo: {
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
  dica: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: Espaco.m,
  },
  linhaMunicipio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.s,
  },
  nomeMunicipio: {
    fontSize: 16,
    fontWeight: '700',
    color: Cores.texto,
  },
  detalheMunicipio: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: 2,
  },
});
