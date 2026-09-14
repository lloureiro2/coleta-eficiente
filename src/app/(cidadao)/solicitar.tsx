import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GradeMateriais } from '@/components/foto-material';
import MapaPontos from '@/components/mapa-pontos';
import { Botao, Campo, Cartao, Chip, MensagemErro, Selo, Tela, Titulo } from '@/components/ui';
import { Cores, Espaco, Raio } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { buscarEnderecoPorCep, formatarCep, somenteDigitosCep } from '@/lib/cep';
import { enviarFoto } from '@/lib/fotos';
import {
  buscarEnderecoPorCoordenadas,
  encontrarContratanteMaisProximo,
  formatarKm,
  geocodificarEndereco,
} from '@/lib/geo';
import { completarMateriais, ehMaterialCadastrado } from '@/lib/materiais';
import { chaveMaterial, contratantesDaCidade, deduplicarMateriais } from '@/lib/municipio';
import { supabase } from '@/lib/supabase';
import type { Material, Municipio } from '@/lib/types';

export default function SolicitarColeta() {
  const { perfil } = useAuth();
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cep, setCep] = useState(perfil?.cep ?? '');
  const [endereco, setEndereco] = useState(perfil?.endereco ?? '');
  const [numero, setNumero] = useState(perfil?.numero ?? '');
  const [bairro, setBairro] = useState(perfil?.bairro ?? '');
  const [destinoEscolhidoId, setDestinoEscolhidoId] = useState<string | null>(null);
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [uf, setUf] = useState(perfil?.uf ?? '');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [foto, setFoto] = useState<{ base64: string; uri: string; mime: string } | null>(null);
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoMapa, setBuscandoMapa] = useState(false);
  const [pontoAjustado, setPontoAjustado] = useState(false);
  const [chaveMapa, setChaveMapa] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [proximaPrefeitura, setProximaPrefeitura] = useState<{
    municipio: Municipio | null;
    km: number;
    chave: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      supabase
        .from('municipios')
        .select('*')
        .order('nome')
        .then(({ data }) => {
          if (ativo) setMunicipios((data as Municipio[]) ?? []);
        });
      supabase
        .from('materiais')
        .select('*')
        .order('nome')
        .then(({ data }) => {
          if (ativo) setMateriais((data as Material[]) ?? []);
        });
      return () => {
        ativo = false;
      };
    }, [])
  );

  // "S/N" é número válido para o cadastro, mas atrapalha a busca do ponto no mapa.
  const semNumeroNaRua = /^s\s*\/?\s*n\.?$/i.test(numero.trim());
  const numeroParaMapa = semNumeroNaRua ? '' : numero.trim();

  // Valores primitivos: a releitura periódica do perfil não pode reiniciar o formulário.
  const cepPerfil = perfil?.cep ?? '';
  const enderecoPerfil = perfil?.endereco ?? '';
  const numeroPerfil = perfil?.numero ?? '';
  const bairroPerfil = perfil?.bairro ?? '';
  const cidadePerfil = perfil?.cidade ?? '';
  const ufPerfil = perfil?.uf ?? '';

  const reiniciarFormulario = useCallback(() => {
    setSelecionados([]);
    setQuantidade('');
    setObservacao('');
    setFoto(null);
    setCoordenadas(null);
    setPontoAjustado(false);
    setDestinoEscolhidoId(null);
    setErro(null);
    setCep(cepPerfil);
    setEndereco(enderecoPerfil);
    setNumero(numeroPerfil);
    setBairro(bairroPerfil);
    setCidade(cidadePerfil);
    setUf(ufPerfil);
  }, [cepPerfil, enderecoPerfil, numeroPerfil, bairroPerfil, cidadePerfil, ufPerfil]);

  // A limpeza roda ao sair da tela: nada do pedido anterior fica preenchido.
  useFocusEffect(useCallback(() => reiniciarFormulario, [reiniciarFormulario]));

  const destinosDaCidade = useMemo(
    () => contratantesDaCidade(municipios, { cidade, uf }),
    [municipios, cidade, uf]
  );

  const destinoDaCidade =
    destinosDaCidade.length === 1
      ? destinosDaCidade[0]
      : destinosDaCidade.find((d) => d.id === destinoEscolhidoId) ?? null;

  useEffect(() => {
    if (destinosDaCidade.length > 0 || !cidade.trim()) return;
    const chave = `${cidade.trim().toLowerCase()}|${uf.trim().toUpperCase()}`;
    let ativo = true;
    void (async () => {
      const resultado = await encontrarContratanteMaisProximo(
        coordenadas ?? { cidade: cidade.trim(), uf },
        municipios
      ).catch(() => null);
      if (!ativo) return;
      setProximaPrefeitura({
        municipio: resultado?.municipio ?? null,
        km: resultado?.km ?? 0,
        chave,
      });
    })();

    return () => {
      ativo = false;
    };
  }, [destinosDaCidade.length, cidade, uf, coordenadas, municipios]);

  const chaveProxima = `${cidade.trim().toLowerCase()}|${uf.trim().toUpperCase()}`;
  const proximaAtual = proximaPrefeitura?.chave === chaveProxima ? proximaPrefeitura : null;
  const destino = destinoDaCidade ?? (proximaAtual?.municipio ?? null);
  const redirecionada = destinosDaCidade.length === 0 && !!destino;
  const buscandoProxima = !!cidade.trim() && destinosDaCidade.length === 0 && proximaAtual === null;

  // Uma opção por tipo de material. Vários contratantes cadastram os mesmos
  // nomes (plástico, vidro...); sem isso a lista aparece repetida.
  const materiaisDoDestino = useMemo(() => {
    const ids = destino
      ? [destino.id]
      : destinosDaCidade.map((item) => item.id);
    const lista = ids.length > 0 ? materiais.filter((m) => ids.includes(m.municipio_id)) : materiais;
    return completarMateriais(deduplicarMateriais(lista));
  }, [materiais, destino, destinosDaCidade]);

  function alternarMaterial(nome: string) {
    const chave = chaveMaterial(nome);
    setSelecionados((atual) =>
      atual.includes(chave) ? atual.filter((m) => m !== chave) : [...atual, chave]
    );
  }

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
      setNumero('');
      setPontoAjustado(false);
      setBuscandoMapa(true);
      try {
        const ponto = await geocodificarEndereco({
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: '',
          cidade: dados.cidade,
          uf: dados.uf,
        });
        if (ponto && Number.isFinite(ponto.lat) && Number.isFinite(ponto.lng)) {
          setCoordenadas(ponto);
          setChaveMapa((n) => n + 1);
        }
      } catch {
        // O mapa fica com o ponto anterior, se houver.
      } finally {
        setBuscandoMapa(false);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar o CEP.');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function usarMinhaLocalizacao() {
    setErro(null);
    setBuscandoLocal(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErro('Permissão de localização negada. Preencha o endereço manualmente.');
        return;
      }
      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = posicao.coords.latitude;
      const lng = posicao.coords.longitude;
      setCoordenadas({ lat, lng });

      try {
        const dados = await buscarEnderecoPorCoordenadas(lat, lng);
        if (dados.cep) setCep(dados.cep);
        if (dados.logradouro) setEndereco(dados.logradouro);
        if (dados.numero) setNumero(dados.numero);
        if (dados.bairro) setBairro(dados.bairro);
        if (dados.cidade) setCidade(dados.cidade);
        if (dados.uf) setUf(dados.uf);
        setPontoAjustado(true);
      } catch (e) {
        setErro(
          e instanceof Error
            ? e.message
            : 'Localização capturada, mas não foi possível preencher o endereço. Informe o endereço ou o CEP.'
        );
      }
    } catch {
      setErro('Não foi possível obter sua localização. Preencha o endereço manualmente.');
    } finally {
      setBuscandoLocal(false);
    }
  }

  useEffect(() => {
    if (!cidade.trim() || pontoAjustado) return;
    let ativo = true;
    const timer = setTimeout(() => {
      setBuscandoMapa(true);
      geocodificarEndereco({
        cep,
        logradouro: endereco,
        numero: numeroParaMapa,
        cidade,
        uf,
      })
        .then((ponto) => {
          if (ativo && ponto && Number.isFinite(ponto.lat) && Number.isFinite(ponto.lng)) {
            setCoordenadas(ponto);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (ativo) setBuscandoMapa(false);
        });
    }, 400);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [cep, endereco, numeroParaMapa, cidade, uf, pontoAjustado]);

  function removerLocalizacao() {
    setCoordenadas(null);
    setPontoAjustado(false);
  }

  const ajustarPontoMapa = useCallback((latitude: number, longitude: number) => {
    setCoordenadas({ lat: latitude, lng: longitude });
    setPontoAjustado(true);
  }, []);

  function guardarFoto(resultado: ImagePicker.ImagePickerResult) {
    const arquivo = resultado.assets?.[0];
    if (!resultado.canceled && arquivo?.base64) {
      setFoto({
        base64: arquivo.base64,
        uri: arquivo.uri,
        mime: arquivo.mimeType ?? 'image/jpeg',
      });
    }
  }

  async function tirarFoto() {
    setErro(null);
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      setErro('Permita o acesso à câmera para tirar a foto dos materiais.');
      return;
    }
    guardarFoto(
      await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      })
    );
  }

  async function escolherFoto() {
    guardarFoto(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      })
    );
  }

  async function enviar() {
    setErro(null);
    if (!perfil) return;
    if (!cidade.trim()) {
      setErro('Informe a cidade da coleta pelo endereço, pela localização ou pelo CEP.');
      return;
    }
    if (destinosDaCidade.length > 1 && !destinoEscolhidoId) {
      setErro('Escolha se a coleta vai para a prefeitura ou para a cooperativa.');
      return;
    }
    if (buscandoProxima) {
      setErro('Aguarde: estamos localizando a prefeitura ou cooperativa mais próxima.');
      return;
    }
    if (!destino) {
      setErro('Não foi possível encontrar uma prefeitura ou cooperativa cadastrada para receber a coleta.');
      return;
    }
    if (selecionados.length === 0) {
      setErro('Escolha pelo menos um material.');
      return;
    }
    if (!numero.trim()) {
      setErro('Informe o número do local. Se o endereço não tiver número, escreva S/N.');
      return;
    }
    const enderecoCompleto = [endereco.trim(), numero.trim()].filter(Boolean).join(', ');
    if (!coordenadas && !enderecoCompleto) {
      setErro('Informe o endereço ou use sua localização atual.');
      return;
    }
    if (!foto) {
      setErro('Adicione uma foto dos materiais para enviar a solicitação.');
      return;
    }

    setEnviando(true);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        fotoUrl = await enviarFoto(foto.base64, foto.mime);
      }

      const { data: solicitacao, error } = await supabase
        .from('solicitacoes')
        .insert({
          municipio_id: destino.id,
          cidadao_id: perfil.id,
          latitude: coordenadas?.lat ?? null,
          longitude: coordenadas?.lng ?? null,
          endereco: enderecoCompleto || null,
          bairro: bairro.trim() || null,
          cep: cep.trim() ? formatarCep(cep) : null,
          cidade: cidade.trim() || null,
          uf: uf.trim() || null,
          quantidade_estimada: quantidade.trim() || null,
          observacao: observacao.trim() || null,
          foto_url: fotoUrl,
        })
        .select('id')
        .single();

      if (error || !solicitacao) {
        setErro(`Não foi possível enviar a solicitação: ${error?.message ?? 'erro desconhecido'}`);
        return;
      }

      const idsMateriais = selecionados
        .map((chave) => {
          const doDestino = materiais.find(
            (m) =>
              ehMaterialCadastrado(m) &&
              m.municipio_id === destino.id &&
              chaveMaterial(m.nome) === chave
          );
          return (
            doDestino ??
            materiais.find((m) => ehMaterialCadastrado(m) && chaveMaterial(m.nome) === chave)
          );
        })
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => m.id);

      if (idsMateriais.length === 0) {
        setErro('Escolha pelo menos um material.');
        return;
      }

      const { error: erroMateriais } = await supabase.from('solicitacao_materiais').insert(
        idsMateriais.map((materialId) => ({
          solicitacao_id: solicitacao.id,
          material_id: materialId,
        }))
      );
      if (erroMateriais) {
        setErro(`Solicitação criada, mas houve erro ao salvar os materiais: ${erroMateriais.message}`);
        return;
      }

      // Limpa o formulário e leva para a lista de pedidos.
      reiniciarFormulario();
      router.replace('/(cidadao)/pedidos');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Titulo sub="A prefeitura ou cooperativa enviará o caminhão até você.">
        Solicitar coleta
      </Titulo>

      <Cartao>
        <MensagemErro texto={erro} />

        <Text style={estilos.rotulo}>Materiais para coleta</Text>
        <View style={estilos.gradeMateriais}>
          <GradeMateriais
            materiais={materiaisDoDestino}
            estaSelecionado={(material) => selecionados.includes(chaveMaterial(material.nome))}
            aoTocar={(material) => alternarMaterial(material.nome)}
          />
        </View>

        <Campo
          rotulo="Quantidade estimada"
          value={quantidade}
          onChangeText={setQuantidade}
          placeholder="Ex.: 2 sacos grandes, 10 garrafas de vidro"
        />
        <Campo
          rotulo="Observação (opcional)"
          value={observacao}
          onChangeText={setObservacao}
          multiline
          placeholder="Ex.: deixar na portaria, interfone 12"
        />
      </Cartao>

      <Cartao>
        <Text style={estilos.rotulo}>Local da coleta</Text>

        <Text style={estilos.rotuloCep}>CEP (opcional)</Text>
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
        <Text style={estilos.dica}>
          O CEP é opcional. Você pode informar o endereço, usar a localização atual ou o CEP.
        </Text>

        <Botao
          titulo={coordenadas ? 'Atualizar localização atual' : 'Usar minha localização atual'}
          variante={coordenadas ? 'secundario' : 'primario'}
          aoTocar={usarMinhaLocalizacao}
          carregando={buscandoLocal}
          style={{ marginBottom: Espaco.m }}
        />
        <View style={estilos.linhaCidade}>
          <View style={{ flex: 2 }}>
            <Campo rotulo="Endereço" value={endereco} onChangeText={setEndereco} placeholder="Rua" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Número"
              value={numero}
              onChangeText={setNumero}
              autoCapitalize="characters"
              placeholder="120 ou S/N"
            />
          </View>
        </View>
        <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} placeholder="Seu bairro" />
        <View style={estilos.linhaCidade}>
          <View style={{ flex: 2 }}>
            <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} placeholder="Cidade" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="UF"
              value={uf}
              onChangeText={(t) => setUf(t.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              placeholder="UF"
            />
          </View>
        </View>

        <View style={{ marginBottom: Espaco.m }}>
          {buscandoMapa && !coordenadas ? (
            <Text style={estilos.dica}>Localizando o endereço no mapa…</Text>
          ) : coordenadas ? (
            <>
              <Text style={estilos.dica}>
                {!numeroParaMapa && !pontoAjustado
                  ? 'Sem número: o mapa mostra a área aproximada. Toque no mapa ou arraste o ponto para deixar a localização mais precisa.'
                  : 'Toque no mapa ou arraste o ponto para ajustar a localização da coleta.'}
              </Text>
              <MapaPontos
                key={`local-${chaveMapa}`}
                pontos={[
                  {
                    id: 'local',
                    latitude: coordenadas.lat,
                    longitude: coordenadas.lng,
                    titulo: 'Local da coleta',
                  },
                ]}
                altura={220}
                raioMetros={!numeroParaMapa && !pontoAjustado ? 180 : undefined}
                aoEscolherCoordenada={ajustarPontoMapa}
              />
              <Text style={estilos.coordenadas}>
                {coordenadas.lat.toFixed(5)}, {coordenadas.lng.toFixed(5)}
              </Text>
              <Botao titulo="Remover localização" variante="perigo" aoTocar={removerLocalizacao} />
            </>
          ) : cidade.trim() || endereco.trim() ? (
            <Text style={estilos.dica}>
              Não foi possível posicionar o endereço no mapa. Use a localização atual ou informe um CEP.
            </Text>
          ) : null}
        </View>

        {cidade.trim() && destinosDaCidade.length > 1 ? (
          <View style={{ marginBottom: Espaco.s }}>
            <Text style={estilos.rotulo}>Quem recebe esta coleta</Text>
            <View style={estilos.chipsDestino}>
              {destinosDaCidade.map((item) => (
                <Chip
                  key={item.id}
                  texto={`${item.tipo === 'prefeitura' ? 'Prefeitura' : 'Cooperativa'}: ${item.nome}`}
                  selecionado={destinoEscolhidoId === item.id}
                  aoTocar={() => setDestinoEscolhidoId(item.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {cidade.trim() && destinoDaCidade ? (
          <View style={estilos.destino}>
            <Ionicons name="business" size={18} color={Cores.primariaEscura} />
            <Text style={estilos.destinoTexto}>
              Esta coleta será enviada para <Text style={estilos.destinoNome}>{destinoDaCidade.nome}</Text>
            </Text>
            <Selo
              texto={destinoDaCidade.tipo === 'prefeitura' ? 'Prefeitura' : 'Cooperativa'}
              fundo={Cores.primariaClara}
              cor={Cores.primariaEscura}
            />
          </View>
        ) : cidade.trim() && destinosDaCidade.length > 1 ? (
          <View style={[estilos.destino, estilos.destinoAusente]}>
            <Ionicons name="alert-circle" size={18} color={Cores.alerta} />
            <Text style={[estilos.destinoTexto, { color: Cores.alerta }]}>
              Há prefeitura e cooperativa nesta cidade. Escolha quem deve receber a coleta.
            </Text>
          </View>
        ) : cidade.trim() ? (
          <View style={[estilos.destino, estilos.destinoAusente]}>
            <Ionicons name="alert-circle" size={18} color={Cores.alerta} />
            <Text style={[estilos.destinoTexto, { color: Cores.alerta }]}>
              Não há prefeitura nem cooperativa cadastrada em {cidade.trim()}
              {uf.trim() ? `/${uf.trim()}` : ''}.
              {buscandoProxima
                ? ' Procurando a prefeitura ou cooperativa cadastrada mais próxima…'
                : redirecionada && proximaAtual?.municipio
                  ? ` A coleta será enviada para a mais próxima: ${proximaAtual.municipio.nome} (${proximaAtual.municipio.cidade}/${proximaAtual.municipio.uf}, cerca de ${formatarKm(proximaAtual.km)}).`
                  : ' Nenhuma outra prefeitura ou cooperativa cadastrada foi localizada.'}
            </Text>
          </View>
        ) : null}
      </Cartao>

      <Cartao>
        <Text style={estilos.rotulo}>Foto dos materiais</Text>
        <Text style={estilos.dica}>
          Obrigatória. Ex.: tire uma foto das 10 garrafas de vinho para ajudar a equipe a estimar o
          volume.
        </Text>
        {foto ? (
          <View>
            <Image source={{ uri: foto.uri }} style={estilos.previa} contentFit="cover" />
            <Botao titulo="Remover foto" variante="perigo" aoTocar={() => setFoto(null)} />
          </View>
        ) : (
          <View style={estilos.opcoesFoto}>
            <Pressable onPress={tirarFoto} style={[estilos.botaoFoto, { flex: 1 }]}>
              <Ionicons name="camera" size={28} color={Cores.primaria} />
              <Text style={estilos.botaoFotoTexto}>Tirar foto</Text>
            </Pressable>
            <Pressable onPress={escolherFoto} style={[estilos.botaoFoto, { flex: 1 }]}>
              <Ionicons name="images" size={28} color={Cores.primaria} />
              <Text style={estilos.botaoFotoTexto}>Escolher da galeria</Text>
            </Pressable>
          </View>
        )}
      </Cartao>

      <Botao titulo="Enviar solicitação" aoTocar={enviar} carregando={enviando} />
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
  rotuloCep: {
    fontSize: 14,
    fontWeight: '600',
    color: Cores.texto,
    marginBottom: Espaco.s,
  },
  linhaCep: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Espaco.s,
    marginBottom: Espaco.m,
  },
  campoCep: {
    flex: 1,
    backgroundColor: Cores.cartao,
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
  chipsDestino: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.s,
    marginBottom: Espaco.s,
  },
  destino: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.s,
    backgroundColor: Cores.primariaClara,
    borderRadius: Raio.m,
    padding: Espaco.m,
    marginTop: Espaco.xs,
  },
  destinoTexto: {
    flex: 1,
    fontSize: 13,
    color: Cores.primariaEscura,
  },
  destinoNome: {
    fontWeight: '700',
  },
  destinoAusente: {
    backgroundColor: Cores.alertaClaro,
  },
  dica: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginBottom: Espaco.m,
  },
  gradeMateriais: {
    marginBottom: Espaco.m,
  },
  coordenadas: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginBottom: Espaco.m,
  },
  previa: {
    height: 180,
    borderRadius: Raio.m,
    marginBottom: Espaco.m,
  },
  opcoesFoto: {
    flexDirection: 'row',
    gap: Espaco.s,
  },
  botaoFoto: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Cores.borda,
    borderRadius: Raio.m,
    paddingVertical: Espaco.g,
    paddingHorizontal: Espaco.s,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.xs,
  },
  botaoFotoTexto: {
    color: Cores.primariaEscura,
    fontWeight: '600',
    textAlign: 'center',
  },
});
