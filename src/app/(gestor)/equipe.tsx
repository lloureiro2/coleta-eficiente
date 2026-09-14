import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { Botao, Campo, Carregando, Cartao, MensagemErro, Selo, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { rotuloCidadao, rotuloGestorPessoa, rotuloRebaixarCidadao } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { Municipio, Perfil } from '@/lib/types';

export default function EquipeGestor() {
  const { perfil } = useAuth();
  const rotuloInstituicao = perfil?.municipios?.tipo === 'cooperativa' ? 'cooperativa' : 'prefeitura';

  const [equipe, setEquipe] = useState<Perfil[] | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState<string | null>(null);

  const [buscaEmail, setBuscaEmail] = useState('');
  const [buscaCidade, setBuscaCidade] = useState('');
  const [resultados, setResultados] = useState<Perfil[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [filtroEquipe, setFiltroEquipe] = useState('');

  const carregar = useCallback(async () => {
    if (!perfil?.municipio_id) {
      setEquipe([]);
      return;
    }

    const { data: pessoas } = await supabase.from('profiles').select('*').neq('id', perfil.id).order('nome');
    setEquipe((pessoas as Perfil[]) ?? []);
  }, [perfil]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const minhaEquipe = useMemo(
    () =>
      (equipe ?? []).filter(
        (p) =>
          p.municipio_id === perfil?.municipio_id &&
          p.papel !== 'admin' &&
          !p.conta_institucional
      ),
    [equipe, perfil?.municipio_id]
  );

  const minhaEquipeFiltrada = useMemo(() => {
    const termo = filtroEquipe.trim().toLowerCase();
    if (!termo) return minhaEquipe;
    return minhaEquipe.filter(
      (p) =>
        (p.nome ?? '').toLowerCase().includes(termo) ||
        (p.email ?? '').toLowerCase().includes(termo)
    );
  }, [minhaEquipe, filtroEquipe]);

  const termosCurtos = buscaEmail.trim().length < 3 && buscaCidade.trim().length < 3;

  const buscar = useCallback(async () => {
    setErro(null);
    setBuscando(true);
    setBuscou(true);
    const { data, error } = await supabase.rpc('buscar_pessoa_para_equipe', {
      p_email: buscaEmail.trim(),
      p_cidade: buscaCidade.trim(),
    });
    setBuscando(false);
    if (error) {
      setErro(`Não foi possível buscar: ${error.message}`);
      setResultados([]);
      return;
    }
    const encontrados = (data as Perfil[]) ?? [];
    const ids = [...new Set(encontrados.map((p) => p.municipio_id).filter((id): id is string => !!id))];
    if (ids.length > 0) {
      const { data: extra } = await supabase.from('municipios').select('*').in('id', ids);
      setMunicipios((extra as Municipio[]) ?? []);
    } else {
      setMunicipios([]);
    }
    setResultados(encontrados);
  }, [buscaEmail, buscaCidade]);

  // Busca enquanto digita; o botão continua funcionando para quem prefere tocar.
  useEffect(() => {
    if (termosCurtos) return;
    const timer = setTimeout(() => {
      void buscar();
    }, 400);
    return () => clearTimeout(timer);
  }, [termosCurtos, buscar]);

  function buscarPeloBotao() {
    if (termosCurtos) {
      setErro('Informe pelo menos 3 letras do e-mail ou da cidade para buscar.');
      return;
    }
    Keyboard.dismiss();
    void buscar();
  }

  async function vincularPessoa(pessoa: Perfil) {
    if (!perfil?.municipio_id) return;
    setErro(null);
    setAgindo(pessoa.id);
    const { data, error } = await supabase.rpc('vincular_pessoa_equipe', {
      p_pessoa_id: pessoa.id,
    });
    setAgindo(null);
    if (error) {
      setErro(`Não foi possível vincular: ${error.message}`);
      return;
    }
    const atualizada = data as Perfil | null;
    if (!atualizada) {
      setErro('Não foi possível vincular: tente buscar a pessoa novamente.');
      return;
    }
    setResultados((atual) => (atual ?? []).map((p) => (p.id === pessoa.id ? atualizada : p)));
    await carregar();
  }

  async function desvincularPessoa(pessoa: Perfil) {
    setErro(null);
    setAgindo(pessoa.id);
    const { data, error } = await supabase.rpc('desvincular_pessoa_equipe', {
      p_pessoa_id: pessoa.id,
    });
    setAgindo(null);
    if (error) {
      setErro(`Não foi possível desvincular: ${error.message}`);
      return;
    }
    const atualizada = data as Perfil | null;
    if (atualizada) {
      setResultados((atual) => (atual ?? []).map((p) => (p.id === pessoa.id ? atualizada : p)));
    }
    await carregar();
  }

  async function mudarPapel(pessoa: Perfil, novoPapel: 'cidadao' | 'gestor') {
    setErro(null);
    setAgindo(pessoa.id);
    const { data, error } = await supabase
      .from('profiles')
      .update({ papel: novoPapel })
      .eq('id', pessoa.id)
      .select('*')
      .maybeSingle();
    setAgindo(null);
    if (error) {
      setErro(`Não foi possível alterar o cargo: ${error.message}`);
      return;
    }
    if (!data) {
      setErro('Não foi possível alterar o cargo: vincule a pessoa à sua equipe antes de promover.');
      return;
    }
    setResultados((atual) =>
      (atual ?? []).map((p) => (p.id === pessoa.id ? (data as Perfil) : p))
    );
    await carregar();
  }

  function cartaoPessoa(p: Perfil, origem: 'equipe' | 'busca') {
    const semVinculo = !p.municipio_id;
    const daMinhaInstituicao = p.municipio_id === perfil?.municipio_id;
    const municipioPessoa = municipios.find((m) => m.id === p.municipio_id);

    return (
      <Cartao key={`${origem}-${p.id}`}>
        <View style={estilos.topo}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.nome}>{p.nome || 'Sem nome'}</Text>
            {p.email && <Text style={estilos.detalhe}>{p.email}</Text>}
            {p.cidade && (
              <Text style={estilos.detalhe}>
                {p.cidade}
                {p.uf ? ` - ${p.uf}` : ''}
              </Text>
            )}
            {municipioPessoa && !daMinhaInstituicao ? (
              <Text style={estilos.detalhe}>{municipioPessoa.nome}</Text>
            ) : null}
          </View>
          <Selo
            texto={
              semVinculo
                ? 'Sem vínculo'
                : p.papel === 'gestor'
                  ? rotuloGestorPessoa(p.genero)
                  : rotuloCidadao(p.genero)
            }
            fundo={p.papel === 'gestor' && !semVinculo ? Cores.primariaClara : Cores.neutroClaro}
            cor={p.papel === 'gestor' && !semVinculo ? Cores.primariaEscura : Cores.texto}
          />
        </View>

        {semVinculo && (
          <Botao
            titulo={`Vincular à minha ${rotuloInstituicao}`}
            carregando={agindo === p.id}
            aoTocar={() => vincularPessoa(p)}
            style={{ marginTop: Espaco.m }}
          />
        )}
        {daMinhaInstituicao && (
          <>
            {p.papel === 'cidadao' ? (
              <Botao
                titulo={`Promover a ${rotuloGestorPessoa(p.genero).toLowerCase()}`}
                carregando={agindo === p.id}
                aoTocar={() => mudarPapel(p, 'gestor')}
                style={{ marginTop: Espaco.m }}
              />
            ) : (
              <Botao
                titulo={rotuloRebaixarCidadao(p.genero)}
                variante="secundario"
                carregando={agindo === p.id}
                aoTocar={() => mudarPapel(p, 'cidadao')}
                style={{ marginTop: Espaco.m }}
              />
            )}
            <Botao
              titulo={`Desvincular da ${rotuloInstituicao}`}
              variante="perigo"
              carregando={agindo === p.id}
              aoTocar={() => desvincularPessoa(p)}
              style={{ marginTop: Espaco.s }}
            />
          </>
        )}
      </Cartao>
    );
  }

  if (!equipe) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo sub={`Atrele cidadãos e cidadãs a esta ${rotuloInstituicao}. Quem for promovido passa a receber, despachar e coletar.`}>
        Equipe
      </Titulo>

      <MensagemErro texto={erro} />

      <Text style={estilos.secao}>Buscar funcionário</Text>
      <Cartao>
        <Campo
          rotulo="E-mail"
          value={buscaEmail}
          onChangeText={setBuscaEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="parte do e-mail"
          returnKeyType="search"
          onSubmitEditing={buscarPeloBotao}
        />
        <Campo
          rotulo="Cidade"
          value={buscaCidade}
          onChangeText={setBuscaCidade}
          placeholder="Vitória"
          returnKeyType="search"
          onSubmitEditing={buscarPeloBotao}
        />
        <Botao titulo="Buscar" aoTocar={buscarPeloBotao} carregando={buscando} />
      </Cartao>

      {!termosCurtos &&
        buscou &&
        (resultados && resultados.length > 0 ? (
          resultados.map((p) => cartaoPessoa(p, 'busca'))
        ) : (
          <Vazio mensagem="Nenhuma pessoa encontrada com esse e-mail ou cidade." />
        ))}

      <Text style={estilos.secao}>Minha equipe</Text>
      <Cartao>
        <Campo
          rotulo="Buscar na minha equipe"
          value={filtroEquipe}
          onChangeText={setFiltroEquipe}
          autoCapitalize="none"
          placeholder="Nome ou e-mail"
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <Botao
          titulo={filtroEquipe.trim() ? 'Limpar busca' : 'Buscar'}
          variante="secundario"
          aoTocar={() => {
            Keyboard.dismiss();
            if (filtroEquipe.trim()) setFiltroEquipe('');
          }}
        />
      </Cartao>

      {minhaEquipe.length === 0 ? (
        <Vazio mensagem="Nenhuma pessoa vinculada ainda." />
      ) : minhaEquipeFiltrada.length === 0 ? (
        <Vazio mensagem="Ninguém na sua equipe corresponde a essa busca." />
      ) : (
        minhaEquipeFiltrada.map((p) => cartaoPessoa(p, 'equipe'))
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  secao: {
    fontSize: 15,
    fontWeight: '700',
    color: Cores.texto,
    marginTop: Espaco.s,
    marginBottom: Espaco.s,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.s,
  },
  nome: {
    fontSize: 16,
    fontWeight: '700',
    color: Cores.texto,
  },
  detalhe: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: 1,
  },
});
