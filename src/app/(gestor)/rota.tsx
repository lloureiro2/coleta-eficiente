import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { GradeMateriais } from '@/components/foto-material';
import MapaPontos from '@/components/mapa-pontos';
import type { CoordenadaLinha } from '@/components/mapa-pontos.types';
import { Botao, Carregando, Cartao, MensagemErro, Selo, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { materiaisDaSolicitacao } from '@/lib/materiais';
import { rotuloCidadao, STATUS_COR, STATUS_ROTULO } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { Solicitacao } from '@/lib/types';

const OSRM_URL = 'https://router.project-osrm.org/trip/v1/driving';

interface RespostaOsrm {
  code: string;
  trips?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
  waypoints?: { waypoint_index: number }[];
}

interface Rota {
  paradas: Solicitacao[];
  linha: CoordenadaLinha[];
  distanciaKm: number;
  duracaoMin: number;
  partida: { latitude: number; longitude: number } | null;
}

export default function RotaCaminhao() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [rota, setRota] = useState<Rota | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      supabase
        .from('solicitacoes')
        .select('*, solicitacao_materiais(material_id, materiais(*)), profiles:cidadao_id(nome, telefone, genero)')
        .eq('status', 'caminhao_a_caminho')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at')
        .then(({ data }) => {
          if (ativo) setSolicitacoes((data as Solicitacao[]) ?? []);
        });
      return () => {
        ativo = false;
      };
    }, [])
  );

  async function calcular(usarMinhaLocalizacao: boolean) {
    if (!solicitacoes || solicitacoes.length === 0) return;
    setErro(null);
    setCalculando(true);
    setRota(null);

    try {
      let partida: { latitude: number; longitude: number } | null = null;
      if (usarMinhaLocalizacao) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const posicao = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          partida = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
        } else {
          setErro('Permissão de localização negada. Calculando a rota sem ponto de partida.');
        }
      }

      const entradas = [
        ...(partida ? [partida] : []),
        ...solicitacoes.map((s) => ({ latitude: s.latitude as number, longitude: s.longitude as number })),
      ];

      if (entradas.length < 2) {
        setErro('É preciso ter pelo menos duas paradas (ou uma parada e o ponto de partida).');
        return;
      }

      const coordenadas = entradas.map((p) => `${p.longitude},${p.latitude}`).join(';');
      const resposta = await fetch(
        `${OSRM_URL}/${coordenadas}?roundtrip=false&source=first&destination=any&geometries=geojson&overview=full`
      );
      const dados = (await resposta.json()) as RespostaOsrm;

      if (dados.code !== 'Ok' || !dados.trips?.[0] || !dados.waypoints) {
        setErro('Não foi possível calcular a rota agora. Tente novamente em instantes.');
        return;
      }

      // waypoints[i] corresponde à entrada i; waypoint_index é a posição dela na rota otimizada.
      const deslocamento = partida ? 1 : 0;
      const ordenadas = solicitacoes
        .map((solicitacao, i) => ({
          solicitacao,
          posicao: dados.waypoints![i + deslocamento].waypoint_index,
        }))
        .sort((a, b) => a.posicao - b.posicao)
        .map((item) => item.solicitacao);

      setRota({
        paradas: ordenadas,
        linha: dados.trips[0].geometry.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        })),
        distanciaKm: dados.trips[0].distance / 1000,
        duracaoMin: dados.trips[0].duration / 60,
        partida,
      });
    } catch {
      setErro('Falha ao consultar o serviço de rotas. Verifique a conexão e tente novamente.');
    } finally {
      setCalculando(false);
    }
  }

  function abrirNoGoogleMaps() {
    if (!rota || rota.paradas.length === 0) return;
    const destino = rota.paradas[rota.paradas.length - 1];
    const origem = rota.partida ?? {
      latitude: rota.paradas[0].latitude as number,
      longitude: rota.paradas[0].longitude as number,
    };
    const intermediarias = (rota.partida ? rota.paradas.slice(0, -1) : rota.paradas.slice(1, -1))
      .map((s) => `${s.latitude},${s.longitude}`)
      .join('|');
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${origem.latitude},${origem.longitude}` +
      `&destination=${destino.latitude},${destino.longitude}` +
      (intermediarias ? `&waypoints=${encodeURIComponent(intermediarias)}` : '') +
      `&travelmode=driving`;
    Linking.openURL(url);
  }

  if (!solicitacoes) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  function abrirDetalhe(id: string) {
    router.push(`/(gestor)/solicitacao/${id}`);
  }

  const pontosMapa = (rota?.paradas ?? solicitacoes).map((s, i) => ({
    id: s.id,
    latitude: s.latitude as number,
    longitude: s.longitude as number,
    titulo: s.profiles?.nome ?? 'Coleta',
    rotulo: rota ? String(i + 1) : undefined,
  }));

  return (
    <Tela>
      <Titulo sub="Toque numa parada para registrar o que foi coletado. Só entram coletas com o caminhão já despachado.">
        Rota do caminhão
      </Titulo>

      <MensagemErro texto={erro} />

      {solicitacoes.length === 0 ? (
        <Vazio mensagem="Nenhuma coleta em rota com localização no mapa. Despache o caminhão para montar a rota e registrar a coleta." />
      ) : (
        <>
          <Cartao>
            <Text style={estilos.info}>
              {solicitacoes.length} parada(s) ativa(s) com localização.
            </Text>
            <Botao
              titulo="Calcular rota partindo de onde estou"
              aoTocar={() => calcular(true)}
              carregando={calculando}
              style={{ marginBottom: Espaco.s }}
            />
            <Botao
              titulo="Calcular rota só entre as paradas"
              variante="secundario"
              aoTocar={() => calcular(false)}
              carregando={calculando}
            />
          </Cartao>

          {rota && (
            <Cartao>
              <View style={estilos.totais}>
                <View style={estilos.total}>
                  <Text style={estilos.totalValor}>{rota.distanciaKm.toFixed(1)} km</Text>
                  <Text style={estilos.totalRotulo}>Distância</Text>
                </View>
                <View style={estilos.total}>
                  <Text style={estilos.totalValor}>{Math.round(rota.duracaoMin)} min</Text>
                  <Text style={estilos.totalRotulo}>Tempo dirigindo</Text>
                </View>
                <View style={estilos.total}>
                  <Text style={estilos.totalValor}>{rota.paradas.length}</Text>
                  <Text style={estilos.totalRotulo}>Paradas</Text>
                </View>
              </View>
              <Botao titulo="Abrir navegação no Google Maps" aoTocar={abrirNoGoogleMaps} />
            </Cartao>
          )}

          <View style={{ marginBottom: Espaco.m }}>
            <MapaPontos pontos={pontosMapa} altura={300} linha={rota?.linha} aoTocar={abrirDetalhe} />
          </View>

          {(rota?.paradas ?? solicitacoes).map((s, i) => {
            const cores = STATUS_COR[s.status];
            return (
              <Cartao key={s.id} aoTocar={() => abrirDetalhe(s.id)}>
                <View style={estilos.linhaParada}>
                  {rota && (
                    <View style={estilos.numero}>
                      <Text style={estilos.numeroTexto}>{i + 1}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.nomeParada}>{s.profiles?.nome ?? rotuloCidadao(s.profiles?.genero)}</Text>
                    <Text style={estilos.detalheParada}>
                      {[s.endereco, s.bairro].filter(Boolean).join(' · ') ||
                        `${(s.latitude as number).toFixed(5)}, ${(s.longitude as number).toFixed(5)}`}
                    </Text>
                  </View>
                  <Selo texto={STATUS_ROTULO[s.status]} fundo={cores.fundo} cor={cores.texto} />
                </View>
                <View style={{ marginTop: Espaco.s }}>
                  <GradeMateriais materiais={materiaisDaSolicitacao(s)} />
                </View>
              </Cartao>
            );
          })}
        </>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  info: {
    fontSize: 14,
    color: Cores.textoSecundario,
    marginBottom: Espaco.m,
  },
  totais: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Espaco.m,
  },
  total: {
    alignItems: 'center',
  },
  totalValor: {
    fontSize: 18,
    fontWeight: '800',
    color: Cores.primariaEscura,
  },
  totalRotulo: {
    fontSize: 12,
    color: Cores.textoSecundario,
    marginTop: 2,
  },
  linhaParada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.s,
  },
  numero: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: {
    color: '#fff',
    fontWeight: '700',
  },
  nomeParada: {
    fontSize: 15,
    fontWeight: '700',
    color: Cores.texto,
  },
  detalheParada: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: 1,
  },
});
