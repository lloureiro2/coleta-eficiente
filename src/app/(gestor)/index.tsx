import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GradeMateriais } from '@/components/foto-material';
import MapaPontos from '@/components/mapa-pontos';
import { Botao, Carregando, Cartao, Chip, MensagemErro, Selo, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco, Raio } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { rotuloResponsavel } from '@/lib/municipio';
import { materiaisDaSolicitacao } from '@/lib/materiais';
import { formatarData, formatarKg, materiaisDoRegistro, rotuloCidadao, STATUS_COR, STATUS_ROTULO, textoMotivoRecusa } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { Solicitacao, StatusSolicitacao } from '@/lib/types';

type FiltroLista = StatusSolicitacao | 'todas' | 'em_rota' | 'despachar';

const FILTROS: { valor: FiltroLista; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'aprovada', rotulo: 'Aprovadas' },
  { valor: 'despachar', rotulo: 'Despachar' },
  { valor: 'em_rota', rotulo: 'Em rota' },
  { valor: 'coletada', rotulo: 'Coletadas' },
  { valor: 'recusada', rotulo: 'Recusadas' },
  { valor: 'todas', rotulo: 'Todas' },
];

const COR_PINO: Record<StatusSolicitacao, string> = {
  pendente: '#D97706',
  aprovada: '#15803D',
  agendada: '#2563EB',
  confirmada: '#15803D',
  caminhao_a_caminho: '#7C3AED',
  coletada: '#16A34A',
  recusada: '#DC2626',
  cancelada: '#DC2626',
};

export default function SolicitacoesGestor() {
  const { perfil } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [despachandoId, setDespachandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroLista>('pendente');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      supabase
        .from('solicitacoes')
        .select(
          '*, solicitacao_materiais(material_id, materiais(*)), profiles:cidadao_id(nome, telefone, genero), cooperativa:cooperativa_id(nome, cidade, tipo), operador:operador_id(id, nome, email, genero), registros_coleta(*, materiais:material_id(*), registro_coleta_materiais(material_id, materiais:material_id(*)))'
        )
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!ativo) return;
          if (error) {
            setErro(`Não foi possível carregar as solicitações: ${error.message}`);
            setSolicitacoes([]);
            return;
          }
          setErro(null);
          setSolicitacoes((data as Solicitacao[]) ?? []);
        });
      return () => {
        ativo = false;
      };
    }, [])
  );

  const podeOperar = useCallback(
    (s: Solicitacao) => {
      const dona = s.municipio_id === perfil?.municipio_id;
      const encaminhada = s.cooperativa_id === perfil?.municipio_id;
      const operador = s.operador_id === perfil?.id;
      return dona || encaminhada || operador;
    },
    [perfil?.id, perfil?.municipio_id]
  );

  const filtradas = useMemo(() => {
    if (!solicitacoes) return [];
    if (filtro === 'todas') return solicitacoes;
    if (filtro === 'despachar') {
      return solicitacoes.filter(
        (s) =>
          podeOperar(s) &&
          (s.status === 'aprovada' || s.status === 'agendada' || s.status === 'confirmada')
      );
    }
    if (filtro === 'em_rota') return solicitacoes.filter((s) => s.status === 'caminhao_a_caminho');
    return solicitacoes.filter((s) => s.status === filtro);
  }, [solicitacoes, filtro, podeOperar]);

  const pontos = useMemo(
    () =>
      filtradas
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          id: s.id,
          latitude: s.latitude as number,
          longitude: s.longitude as number,
          titulo: s.profiles?.nome ?? 'Solicitação',
          cor: COR_PINO[s.status],
        })),
    [filtradas]
  );

  const abrirDetalhe = useCallback((id: string) => {
    router.push(`/(gestor)/solicitacao/${id}`);
  }, []);

  async function despacharEAbrirRota(id: string) {
    setErro(null);
    setDespachandoId(id);
    const { error } = await supabase
      .from('solicitacoes')
      .update({ status: 'caminhao_a_caminho' })
      .eq('id', id);
    setDespachandoId(null);
    if (error) {
      setErro(`Não foi possível despachar o caminhão: ${error.message}`);
      return;
    }
    router.push('/(gestor)/rota');
  }

  if (!solicitacoes) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo
        sub="Receba, despache o caminhão e registre a coleta.">
        Solicitações
      </Titulo>
      <MensagemErro texto={erro} />

      <View style={estilos.filtros}>
        {FILTROS.map((f) => (
          <Chip
            key={f.valor}
            texto={f.rotulo}
            selecionado={filtro === f.valor}
            aoTocar={() => setFiltro(f.valor)}
          />
        ))}
      </View>

      {pontos.length > 0 && (
        <View style={{ marginBottom: Espaco.m }}>
          <MapaPontos pontos={pontos} altura={280} aoTocar={abrirDetalhe} />
        </View>
      )}

      {filtradas.length === 0 && <Vazio mensagem="Nenhuma solicitação neste filtro." />}

      {filtradas.map((s) => {
        const cores = STATUS_COR[s.status];
        const localizacao =
          [s.endereco, s.bairro, [s.cidade, s.uf].filter(Boolean).join('/')]
            .filter(Boolean)
            .join(' · ') || 'Endereço via localização no mapa';
        return (
          <Cartao key={s.id} aoTocar={() => abrirDetalhe(s.id)}>
            <View style={estilos.topo}>
              <Text style={estilos.nome}>{s.profiles?.nome ?? rotuloCidadao(s.profiles?.genero)}</Text>
              <Selo texto={STATUS_ROTULO[s.status]} fundo={cores.fundo} cor={cores.texto} />
            </View>
            <View style={estilos.corpo}>
              {s.foto_url ? (
                <Image source={{ uri: s.foto_url }} style={estilos.miniatura} contentFit="cover" />
              ) : null}
              <View style={estilos.info}>
                <Text style={estilos.detalhe}>{localizacao}</Text>
                {s.cep ? <Text style={estilos.detalhe}>CEP: {s.cep}</Text> : null}
                {s.status === 'coletada' && s.profiles?.telefone ? (
                  <Text style={estilos.detalhe}>Telefone: {s.profiles.telefone}</Text>
                ) : null}
                {s.status === 'coletada' && s.quantidade_estimada ? (
                  <Text style={estilos.detalhe}>Quantidade estimada: {s.quantidade_estimada}</Text>
                ) : null}
                {s.status === 'coletada' && s.observacao ? (
                  <Text style={estilos.detalhe}>Observação: {s.observacao}</Text>
                ) : null}
                {rotuloResponsavel(s) ? (
                  <Text style={estilos.detalhe}>{rotuloResponsavel(s)}</Text>
                ) : null}
                {textoMotivoRecusa(s) ? (
                  <Text style={[estilos.detalhe, { color: Cores.perigo }]}>{textoMotivoRecusa(s)}</Text>
                ) : null}
                <Text style={estilos.data}>
                  {s.status === 'coletada' ? `Coletada em ${formatarData(s.updated_at)}` : formatarData(s.created_at)}
                </Text>
              </View>
            </View>
            {s.status === 'coletada' && (s.registros_coleta ?? []).length > 0 ? (
              (s.registros_coleta ?? []).map((registro) => (
                <View key={registro.id} style={estilos.blocoRegistro}>
                  <GradeMateriais materiais={materiaisDoRegistro(registro)} />
                  <Text style={estilos.registro}>
                    {formatarKg(registro.kg)}
                    {registro.unidades > 0 ? ` · ${registro.unidades} un.` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <View style={estilos.blocoRegistro}>
                <GradeMateriais materiais={materiaisDaSolicitacao(s)} />
              </View>
            )}
            {(s.status === 'aprovada' || s.status === 'agendada' || s.status === 'confirmada') && podeOperar(s) ? (
              <Botao
                titulo="Despachar caminhão"
                aoTocar={() => despacharEAbrirRota(s.id)}
                carregando={despachandoId === s.id}
                style={{ marginTop: Espaco.m }}
              />
            ) : null}
            {s.status === 'caminhao_a_caminho' && podeOperar(s) ? (
              <Botao
                titulo="Abrir rota"
                variante="secundario"
                aoTocar={() => router.push('/(gestor)/rota')}
                style={{ marginTop: Espaco.m }}
              />
            ) : null}
          </Cartao>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.s,
    marginBottom: Espaco.m,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.s,
    marginBottom: Espaco.xs,
  },
  nome: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Cores.texto,
  },
  corpo: {
    flexDirection: 'row',
    gap: Espaco.m,
  },
  miniatura: {
    width: 64,
    height: 64,
    borderRadius: Raio.m,
    backgroundColor: Cores.neutroClaro,
  },
  info: {
    flex: 1,
  },
  blocoRegistro: {
    marginTop: Espaco.s,
  },
  detalhe: {
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  registro: {
    fontSize: 13,
    fontWeight: '600',
    color: Cores.texto,
    marginTop: 2,
  },
  data: {
    fontSize: 12,
    color: Cores.textoSecundario,
    marginTop: Espaco.xs,
  },
});
