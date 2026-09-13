import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GradeMateriais } from '@/components/foto-material';
import { Carregando, Cartao, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatarKg, materiaisDoRegistro } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { Material, RegistroColeta } from '@/lib/types';

function inicioDoMes(deslocamento: number): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth() + deslocamento, 1);
}

type RegistroResumo = RegistroColeta & {
  solicitacoes?: { municipio_id: string; cooperativa_id: string | null } | null;
};

export default function ResumoGestor() {
  const { perfil } = useAuth();
  const [deslocamento, setDeslocamento] = useState(0);
  const [registros, setRegistros] = useState<RegistroColeta[] | null>(null);
  const [totalColetadas, setTotalColetadas] = useState(0);
  const [totalSolicitacoes, setTotalSolicitacoes] = useState(0);

  const carregar = useCallback(async () => {
    const inicio = inicioDoMes(deslocamento);
    const fim = inicioDoMes(deslocamento + 1);
    const municipioId = perfil?.municipio_id;
    setRegistros(null);

    let consultaRegistros = supabase
      .from('registros_coleta')
      .select(
        '*, materiais:material_id(*), registro_coleta_materiais(material_id, materiais:material_id(*)), solicitacoes:solicitacao_id(municipio_id, cooperativa_id)'
      )
      .gte('created_at', inicio.toISOString())
      .lt('created_at', fim.toISOString());

    let consultaColetadas = supabase
      .from('solicitacoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'coletada')
      .gte('updated_at', inicio.toISOString())
      .lt('updated_at', fim.toISOString());

    let consultaSolicitacoes = supabase
      .from('solicitacoes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', inicio.toISOString())
      .lt('created_at', fim.toISOString());

    if (municipioId) {
      consultaColetadas = consultaColetadas.or(`municipio_id.eq.${municipioId},cooperativa_id.eq.${municipioId}`);
      consultaSolicitacoes = consultaSolicitacoes.or(
        `municipio_id.eq.${municipioId},cooperativa_id.eq.${municipioId}`
      );
    }

    const [{ data }, { count: coletadas }, { count: solicitacoes }] = await Promise.all([
      consultaRegistros,
      consultaColetadas,
      consultaSolicitacoes,
    ]);

    const lista = ((data as RegistroResumo[]) ?? []).filter((registro) => {
      if (!municipioId) return false;
      return (
        registro.municipio_id === municipioId ||
        registro.solicitacoes?.cooperativa_id === municipioId ||
        registro.solicitacoes?.municipio_id === municipioId
      );
    });

    setRegistros(lista);
    setTotalColetadas(coletadas ?? 0);
    setTotalSolicitacoes(solicitacoes ?? 0);
  }, [deslocamento, perfil?.municipio_id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const porMaterial = useMemo(() => {
    const mapa = new Map<string, { chave: string; materiais: Material[]; kg: number; unidades: number }>();
    for (const registro of registros ?? []) {
      const materiais = materiaisDoRegistro(registro);
      const chave =
        materiais
          .map((material) => material.id)
          .sort()
          .join('+') || 'material';
      const atual = mapa.get(chave) ?? { chave, materiais, kg: 0, unidades: 0 };
      atual.kg += Number(registro.kg) || 0;
      atual.unidades += registro.unidades || 0;
      mapa.set(chave, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.kg - a.kg);
  }, [registros]);

  const totalKg = porMaterial.reduce((soma, item) => soma + item.kg, 0);
  const totalUnidades = porMaterial.reduce((soma, item) => soma + item.unidades, 0);

  const nomeMes = inicioDoMes(deslocamento).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Tela>
      <Titulo sub="Coletas e solicitações da sua equipe neste mês.">
        Resumo
      </Titulo>

      <View style={estilos.navegacaoMes}>
        <Pressable onPress={() => setDeslocamento((d) => d - 1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Cores.texto} />
        </Pressable>
        <Text style={estilos.nomeMes}>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</Text>
        <Pressable
          onPress={() => setDeslocamento((d) => Math.min(0, d + 1))}
          hitSlop={8}
          disabled={deslocamento === 0}
          style={{ opacity: deslocamento === 0 ? 0.3 : 1 }}>
          <Ionicons name="chevron-forward" size={22} color={Cores.texto} />
        </Pressable>
      </View>

      {!registros ? (
        <Carregando />
      ) : (
        <>
          <View style={estilos.cartoesTotais}>
            <Cartao style={estilos.cartaoTotal}>
              <Text style={estilos.valorTotal}>{formatarKg(totalKg)}</Text>
              <Text style={estilos.rotuloTotal}>Total coletado</Text>
            </Cartao>
            <Cartao style={estilos.cartaoTotal}>
              <Text style={estilos.valorTotal}>{totalUnidades}</Text>
              <Text style={estilos.rotuloTotal}>Unidades</Text>
            </Cartao>
            <Cartao style={estilos.cartaoTotal}>
              <Text style={estilos.valorTotal}>{totalColetadas}</Text>
              <Text style={estilos.rotuloTotal}>Coletas feitas</Text>
            </Cartao>
            <Cartao style={estilos.cartaoTotal}>
              <Text style={estilos.valorTotal}>{totalSolicitacoes}</Text>
              <Text style={estilos.rotuloTotal}>Solicitações</Text>
            </Cartao>
          </View>

          <Cartao>
            <Text style={estilos.rotuloSecao}>Por material</Text>
            {porMaterial.length === 0 ? (
              <Vazio mensagem="Nenhum registro de coleta neste mês." />
            ) : (
              porMaterial.map((item) => (
                <View key={item.chave} style={estilos.linhaMaterial}>
                  <GradeMateriais materiais={item.materiais} />
                  <Text style={estilos.valoresMaterial}>
                    {formatarKg(item.kg)}
                    {item.unidades > 0 ? ` · ${item.unidades} un.` : ''}
                  </Text>
                </View>
              ))
            )}
          </Cartao>
        </>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  navegacaoMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Espaco.m,
    paddingHorizontal: Espaco.s,
  },
  nomeMes: {
    fontSize: 17,
    fontWeight: '700',
    color: Cores.texto,
  },
  cartoesTotais: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.s,
  },
  cartaoTotal: {
    flexGrow: 1,
    flexBasis: '46%',
    alignItems: 'center',
    paddingVertical: Espaco.m,
  },
  valorTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: Cores.primariaEscura,
  },
  rotuloTotal: {
    fontSize: 12,
    color: Cores.textoSecundario,
    marginTop: 2,
    textAlign: 'center',
  },
  rotuloSecao: {
    fontSize: 15,
    fontWeight: '700',
    color: Cores.texto,
    marginBottom: Espaco.m,
  },
  linhaMaterial: {
    paddingVertical: Espaco.s,
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
    gap: Espaco.s,
  },
  valoresMaterial: {
    fontSize: 14,
    fontWeight: '600',
    color: Cores.texto,
  },
});
