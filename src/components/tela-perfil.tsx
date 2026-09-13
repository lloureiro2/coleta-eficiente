import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Botao, Campo, Cartao, Chip, MensagemErro, Selo, Tela, Titulo, Carregando } from '@/components/ui';
import { Cores, Espaco, Raio } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { buscarEnderecoPorCep, formatarCep, somenteDigitosCep } from '@/lib/cep';
import { ehContaInstitucional, nomeDaConta } from '@/lib/municipio';
import { rotuloCidadao, rotuloGestorPessoa } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import { formatarTelefone, mensagemTelefoneInvalido } from '@/lib/telefone';
import type { GeneroPessoa } from '@/lib/types';

/** Tela de perfil compartilhada entre cidadão e gestor. */
export default function TelaPerfil() {
  const { perfil, recarregarPerfil, sair } = useAuth();
  const municipio = perfil?.municipios ?? null;
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '');
  const [genero, setGenero] = useState<GeneroPessoa | null>(perfil?.genero ?? null);
  const [cep, setCep] = useState(perfil?.cep ?? '');
  const [endereco, setEndereco] = useState(perfil?.endereco ?? '');
  const [numero, setNumero] = useState(perfil?.numero ?? '');
  const [bairro, setBairro] = useState(perfil?.bairro ?? '');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [uf, setUf] = useState(perfil?.uf ?? '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  async function salvar() {
    if (!perfil) return;
    setErro(null);
    const erroTelefone = mensagemTelefoneInvalido(telefone);
    if (erroTelefone) {
      setErro(erroTelefone);
      return;
    }
    if (cep.trim() && somenteDigitosCep(cep).length !== 8) {
      setErro('Se informar o CEP, use 8 dígitos.');
      return;
    }
    if (!genero) {
      setErro('Informe se você é cidadão ou cidadã.');
      return;
    }
    setSalvando(true);
    setSalvo(false);
    const { error } = await supabase
      .from('profiles')
      .update({
        telefone: formatarTelefone(telefone),
        endereco: endereco.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        uf: uf.trim().toUpperCase().slice(0, 2) || null,
        cep: cep.trim() ? formatarCep(cep) : null,
        numero: numero.trim() || null,
        genero,
      })
      .eq('id', perfil.id);
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar: ${error.message}`);
      return;
    }
    await recarregarPerfil();
    setSalvo(true);
  }

  if (!perfil) return <Carregando />;

  const institucional = ehContaInstitucional(perfil);
  const seloTexto =
    perfil.papel === 'admin'
      ? 'Admin'
      : institucional
        ? municipio?.tipo === 'cooperativa'
          ? 'Cooperativa'
          : 'Prefeitura'
        : perfil.papel === 'gestor'
          ? rotuloGestorPessoa(perfil.genero)
          : rotuloCidadao(perfil.genero);

  return (
    <Tela>
      <Titulo>Perfil</Titulo>

      <Cartao>
        <View style={estilos.topo}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.nome}>
              {institucional && municipio?.nome ? municipio.nome : nomeDaConta(perfil)}
            </Text>
            {perfil.email ? <Text style={estilos.municipio}>{perfil.email}</Text> : null}
            {municipio && !institucional ? (
              <Text style={estilos.municipio}>
                {municipio.nome} · {municipio.cidade} - {municipio.uf}
              </Text>
            ) : municipio && institucional ? (
              <Text style={estilos.municipio}>
                {municipio.cidade} - {municipio.uf}
              </Text>
            ) : perfil.papel === 'cidadao' ? (
              <Text style={estilos.municipio}>
                Sem vínculo · aguardando uma prefeitura ou cooperativa te vincular
              </Text>
            ) : null}
          </View>
          <Selo texto={seloTexto} fundo={Cores.primariaClara} cor={Cores.primariaEscura} />
        </View>
      </Cartao>

      {!institucional && (
        <Cartao>
          <MensagemErro texto={erro} />
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
          <Campo rotulo="Endereço (opcional)" value={endereco} onChangeText={setEndereco} placeholder="Rua, avenida..." />
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
              <Campo
                rotulo="Cidade (opcional)"
                value={cidade}
                onChangeText={setCidade}
                placeholder="Vitória"
              />
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
          {salvo && <Text style={estilos.salvo}>Dados salvos!</Text>}
          <Botao titulo="Salvar alterações" aoTocar={salvar} carregando={salvando} />
        </Cartao>
      )}

      <Botao titulo="Sair da conta" variante="perigo" aoTocar={sair} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.s,
  },
  nome: {
    fontSize: 18,
    fontWeight: '700',
    color: Cores.texto,
  },
  municipio: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: 2,
  },
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
  salvo: {
    color: Cores.primariaEscura,
    fontWeight: '600',
    marginBottom: Espaco.s,
  },
});
