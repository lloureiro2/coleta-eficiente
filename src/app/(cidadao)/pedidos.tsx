import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GradeMateriais } from '@/components/foto-material';
import { LinhaTempo } from '@/components/linha-tempo';
import { Botao, Carregando, Cartao, Selo, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { materiaisDaSolicitacao } from '@/lib/materiais';
import { formatarData, STATUS_COR, STATUS_ROTULO, textoMotivoRecusa } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { Solicitacao } from '@/lib/types';

export default function MeusPedidos() {
  const { perfil } = useAuth();
  const [pedidos, setPedidos] = useState<Solicitacao[] | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    const { data } = await supabase
      .from('solicitacoes')
      .select(
        '*, solicitacao_materiais(material_id, materiais(*)), solicitacao_eventos(*)'
      )
      .eq('cidadao_id', perfil.id)
      .order('created_at', { ascending: false });
    setPedidos((data as Solicitacao[]) ?? []);
  }, [perfil]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function cancelar(id: string) {
    setCancelando(id);
    await supabase.from('solicitacoes').update({ status: 'cancelada' }).eq('id', id);
    await carregar();
    setCancelando(null);
  }

  if (!pedidos) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo sub="Acompanhe cada etapa da coleta: hora, quem fez e onde.">Meus pedidos</Titulo>

      {pedidos.length === 0 && (
        <Vazio mensagem="Você ainda não fez nenhuma solicitação. Use a aba Solicitar para pedir uma coleta." />
      )}

      {pedidos.map((pedido) => {
        const cores = STATUS_COR[pedido.status];
        return (
          <Cartao key={pedido.id}>
            <View style={estilos.topo}>
              <Selo texto={STATUS_ROTULO[pedido.status]} fundo={cores.fundo} cor={cores.texto} />
              <Text style={estilos.data}>{formatarData(pedido.created_at)}</Text>
            </View>

            <View style={estilos.gradeMateriais}>
              <GradeMateriais materiais={materiaisDaSolicitacao(pedido)} />
            </View>

            {pedido.quantidade_estimada && (
              <Text style={estilos.detalhe}>Quantidade: {pedido.quantidade_estimada}</Text>
            )}
            {pedido.endereco && <Text style={estilos.detalhe}>Endereço: {pedido.endereco}</Text>}
            {pedido.bairro && <Text style={estilos.detalhe}>Bairro: {pedido.bairro}</Text>}
            {textoMotivoRecusa(pedido) ? (
              <Text style={[estilos.detalhe, { color: Cores.perigo }]}>{textoMotivoRecusa(pedido)}</Text>
            ) : null}

            <Text style={estilos.rotuloTempo}>Andamento</Text>
            <LinhaTempo eventos={pedido.solicitacao_eventos ?? []} />

            {pedido.status === 'pendente' && (
              <Botao
                titulo="Cancelar pedido"
                variante="perigo"
                carregando={cancelando === pedido.id}
                aoTocar={() => cancelar(pedido.id)}
                style={{ marginTop: Espaco.m }}
              />
            )}
          </Cartao>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Espaco.s,
  },
  data: {
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  gradeMateriais: {
    marginBottom: Espaco.s,
  },
  detalhe: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: 2,
  },
  rotuloTempo: {
    fontSize: 14,
    fontWeight: '700',
    color: Cores.texto,
    marginTop: Espaco.m,
  },
});
