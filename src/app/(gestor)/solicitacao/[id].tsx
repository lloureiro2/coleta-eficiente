import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GradeMateriais } from '@/components/foto-material';
import { LinhaTempo } from '@/components/linha-tempo';
import MapaPontos from '@/components/mapa-pontos';
import { Botao, Campo, Carregando, Cartao, MensagemErro, Selo, Tela, Vazio } from '@/components/ui';
import { Cores, Espaco, Raio } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { enviarFoto } from '@/lib/fotos';
import { rotuloResponsavel } from '@/lib/municipio';
import { materiaisDaSolicitacao } from '@/lib/materiais';
import {
  formatarData,
  formatarKg,
  materiaisDoRegistro,
  rotuloCidadao,
  STATUS_COR,
  STATUS_ROTULO,
  textoMotivoRecusa,
} from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { RegistroColeta, Solicitacao, SolicitacaoEvento, StatusSolicitacao } from '@/lib/types';

export default function DetalheSolicitacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useAuth();

  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [registros, setRegistros] = useState<RegistroColeta[]>([]);
  const [eventos, setEventos] = useState<SolicitacaoEvento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [kgColeta, setKgColeta] = useState('');
  const [unidadesColeta, setUnidadesColeta] = useState('');
  const [fotoColeta, setFotoColeta] = useState<{ base64: string; uri: string; mime: string } | null>(null);
  const [salvandoRegistro, setSalvandoRegistro] = useState(false);
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [
      { data: dadosSolicitacao },
      { data: dadosRegistros, error: erroRegistros },
      { data: dadosEventos },
    ] = await Promise.all([
      supabase
        .from('solicitacoes')
        .select(
          '*, solicitacao_materiais(material_id, materiais(*)), profiles:cidadao_id(nome, telefone, genero), cooperativa:cooperativa_id(nome, cidade, tipo), operador:operador_id(id, nome, email, genero)'
        )
        .eq('id', id)
        .single(),
      supabase
        .from('registros_coleta')
        .select(
          '*, materiais:material_id(*), registro_coleta_materiais(material_id, materiais:material_id(*))'
        )
        .eq('solicitacao_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('solicitacao_eventos')
        .select('*')
        .eq('solicitacao_id', id)
        .order('created_at', { ascending: true }),
    ]);
    const solicitacaoCarregada = (dadosSolicitacao as Solicitacao) ?? null;
    setSolicitacao(solicitacaoCarregada);
    if (erroRegistros) {
      setErro(`Não foi possível carregar os registros: ${erroRegistros.message}`);
    }
    setRegistros((dadosRegistros as RegistroColeta[]) ?? []);
    setEventos((dadosEventos as SolicitacaoEvento[]) ?? []);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function mudarStatus(novo: StatusSolicitacao, extra: Record<string, unknown> = {}) {
    if (!solicitacao) return;
    setErro(null);
    setMudandoStatus(true);
    const { error } = await supabase
      .from('solicitacoes')
      .update({ status: novo, ...extra })
      .eq('id', solicitacao.id);
    setMudandoStatus(false);
    if (error) {
      setErro(`Não foi possível atualizar o status: ${error.message}`);
      return;
    }
    await carregar();
  }

  async function aprovar() {
    await mudarStatus('aprovada', { motivo_recusa: null, origem_recusa: null });
  }

  async function recusarSolicitacao() {
    const motivo = motivoRecusa.trim();
    if (motivo.length < 3) {
      setErro('Informe o motivo da recusa.');
      return;
    }
    await mudarStatus('recusada', {
      motivo_recusa: motivo,
      origem_recusa: perfil?.municipios?.tipo === 'cooperativa' ? 'cooperativa' : 'prefeitura',
    });
  }

  async function escolherFotoColeta() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    });
    const arquivo = resultado.assets?.[0];
    if (!resultado.canceled && arquivo?.base64) {
      setFotoColeta({
        base64: arquivo.base64,
        uri: arquivo.uri,
        mime: arquivo.mimeType ?? 'image/jpeg',
      });
    }
  }

  async function salvarRegistro() {
    if (!solicitacao || !perfil) return;
    setErro(null);
    const materialIds = (solicitacao.solicitacao_materiais ?? []).map((item) => item.material_id);
    if (materialIds.length === 0) {
      setErro('Esta solicitação não tem materiais para conferir.');
      return;
    }
    const kgNumero = Number(kgColeta.replace(',', '.')) || 0;
    if (kgNumero <= 0) {
      setErro('Informe o peso coletado (kg).');
      return;
    }
    if (!fotoColeta) {
      setErro('Tire ou escolha uma foto da coleta.');
      return;
    }

    setSalvandoRegistro(true);
    try {
      const fotoUrl = await enviarFoto(fotoColeta.base64, fotoColeta.mime);
      const { error } = await supabase.rpc('registrar_coleta', {
        p_solicitacao_id: solicitacao.id,
        p_material_ids: materialIds,
        p_kg: kgNumero,
        p_unidades: Number(unidadesColeta) || 0,
        p_foto_url: fotoUrl,
      });
      if (error) {
        setErro(`Não foi possível salvar: ${error.message}`);
        return;
      }
      setKgColeta('');
      setUnidadesColeta('');
      setFotoColeta(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a foto da coleta.');
    } finally {
      setSalvandoRegistro(false);
    }
  }

  async function desfazerRegistro(registroId: string) {
    if (!solicitacao) return;
    setErro(null);
    setDesfazendoId(registroId);
    const { error } = await supabase.from('registros_coleta').delete().eq('id', registroId);
    if (error) {
      setDesfazendoId(null);
      setErro(`Não foi possível desfazer o registro: ${error.message}`);
      return;
    }
    const restam = registros.filter((registro) => registro.id !== registroId);
    if (restam.length === 0 && solicitacao.status === 'coletada') {
      await mudarStatus('aprovada');
    }
    setDesfazendoId(null);
    await carregar();
  }

  if (!solicitacao) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  const cores = STATUS_COR[solicitacao.status];
  const temCoordenadas = solicitacao.latitude != null && solicitacao.longitude != null;
  const eDona = solicitacao.municipio_id === perfil?.municipio_id;
  const eEncaminhada = solicitacao.cooperativa_id === perfil?.municipio_id;
  const eResponsavel = eDona || eEncaminhada || solicitacao.operador_id === perfil?.id;
  const podeDespachar =
    eResponsavel &&
    (solicitacao.status === 'aprovada' ||
      solicitacao.status === 'agendada' ||
      solicitacao.status === 'confirmada');
  const podeColetar = eResponsavel && solicitacao.status === 'caminhao_a_caminho';
  const materiaisPedido = materiaisDaSolicitacao(solicitacao);

  return (
    <Tela>
      <Pressable onPress={() => router.back()} style={estilos.voltar}>
        <Ionicons name="arrow-back" size={20} color={Cores.texto} />
        <Text style={estilos.voltarTexto}>Voltar</Text>
      </Pressable>

      <MensagemErro texto={erro} />

      <Cartao>
        <View style={estilos.topo}>
          <Text style={estilos.nome}>
            {solicitacao.profiles?.nome ?? rotuloCidadao(solicitacao.profiles?.genero)}
          </Text>
          <Selo texto={STATUS_ROTULO[solicitacao.status]} fundo={cores.fundo} cor={cores.texto} />
        </View>
        {solicitacao.profiles?.telefone && (
          <Text style={estilos.detalhe}>Telefone: {solicitacao.profiles.telefone}</Text>
        )}
        <Text style={estilos.detalhe}>Solicitado em: {formatarData(solicitacao.created_at)}</Text>
        {solicitacao.status === 'coletada' ? (
          <Text style={estilos.detalhe}>Coletada em: {formatarData(solicitacao.updated_at)}</Text>
        ) : null}
        {solicitacao.endereco && <Text style={estilos.detalhe}>Endereço: {solicitacao.endereco}</Text>}
        {solicitacao.bairro && <Text style={estilos.detalhe}>Bairro: {solicitacao.bairro}</Text>}
        {solicitacao.cidade && (
          <Text style={estilos.detalhe}>
            {solicitacao.cidade}
            {solicitacao.uf ? ` - ${solicitacao.uf}` : ''}
            {solicitacao.cep ? ` · CEP ${solicitacao.cep}` : ''}
          </Text>
        )}
        {rotuloResponsavel(solicitacao) && (
          <Text style={estilos.detalhe}>{rotuloResponsavel(solicitacao)}</Text>
        )}
        {solicitacao.quantidade_estimada && (
          <Text style={estilos.detalhe}>Quantidade estimada: {solicitacao.quantidade_estimada}</Text>
        )}
        {solicitacao.observacao && (
          <Text style={estilos.detalhe}>Observação: {solicitacao.observacao}</Text>
        )}
        {textoMotivoRecusa(solicitacao) && (
          <Text style={[estilos.detalhe, { color: Cores.perigo }]}>{textoMotivoRecusa(solicitacao)}</Text>
        )}

        <View style={estilos.fotosMateriais}>
          {materiaisPedido.length === 0 ? (
            <Text style={estilos.detalhe}>Materiais não informados</Text>
          ) : (
            <GradeMateriais materiais={materiaisPedido} />
          )}
        </View>

        {solicitacao.foto_url && (
          <Image source={{ uri: solicitacao.foto_url }} style={estilos.foto} contentFit="cover" />
        )}
      </Cartao>

      <Cartao>
        <Text style={estilos.rotuloSecao}>Andamento</Text>
        <LinhaTempo eventos={eventos} />
      </Cartao>

      {temCoordenadas && (
        <View style={{ marginBottom: Espaco.m }}>
          <MapaPontos
            pontos={[
              {
                id: solicitacao.id,
                latitude: solicitacao.latitude as number,
                longitude: solicitacao.longitude as number,
                titulo: solicitacao.profiles?.nome ?? 'Coleta',
              },
            ]}
            altura={220}
          />
        </View>
      )}

      {eDona && solicitacao.status === 'pendente' && (
        <Cartao>
          <Text style={estilos.rotuloSecao}>Aprovar solicitação</Text>
          <Botao
            titulo="Aprovar"
            aoTocar={aprovar}
            carregando={mudandoStatus}
            style={{ marginBottom: Espaco.s }}
          />
          <Campo
            rotulo="Motivo da recusa"
            value={motivoRecusa}
            onChangeText={setMotivoRecusa}
            placeholder="Explique por que a solicitação será recusada"
            multiline
          />
          <Botao
            titulo="Recusar solicitação"
            variante="perigo"
            aoTocar={recusarSolicitacao}
            carregando={mudandoStatus}
          />
        </Cartao>
      )}

      {podeDespachar && (
        <Cartao>
          <Text style={estilos.rotuloSecao}>Andamento</Text>
          <Text style={[estilos.detalhe, { marginBottom: Espaco.m }]}>
            Despache o caminhão para avisar que a coleta está em rota.
          </Text>
          <Botao
            titulo="Despachar caminhão"
            aoTocar={() => mudarStatus('caminhao_a_caminho')}
            carregando={mudandoStatus}
          />
        </Cartao>
      )}

      {podeColetar && (
        <Cartao>
          <Text style={estilos.rotuloSecao}>Registrar coleta</Text>
          <Text style={[estilos.detalhe, { marginBottom: Espaco.m }]}>
            Confira os materiais pedidos, tire uma foto e preencha o peso.
          </Text>
          <View style={estilos.fotosMateriais}>
            {materiaisPedido.length === 0 ? (
              <Text style={estilos.detalhe}>Nenhum material nesta solicitação.</Text>
            ) : (
              <GradeMateriais materiais={materiaisPedido} />
            )}
          </View>
          <Campo
            rotulo="Peso (kg)"
            value={kgColeta}
            onChangeText={setKgColeta}
            keyboardType="decimal-pad"
            placeholder="Ex.: 10"
          />
          <Campo
            rotulo="Unidades (opcional)"
            value={unidadesColeta}
            onChangeText={setUnidadesColeta}
            keyboardType="number-pad"
            placeholder="Ex.: 10"
          />
          <Text style={estilos.rotuloCampo}>Foto da coleta</Text>
          {fotoColeta ? (
            <View>
              <Image source={{ uri: fotoColeta.uri }} style={estilos.foto} contentFit="cover" />
              <Botao titulo="Remover foto" variante="perigo" aoTocar={() => setFotoColeta(null)} />
            </View>
          ) : (
            <Botao titulo="Escolher foto" variante="secundario" aoTocar={escolherFotoColeta} />
          )}
          <Botao
            titulo="Salvar coleta"
            aoTocar={salvarRegistro}
            carregando={salvandoRegistro}
            style={{ marginTop: Espaco.m }}
          />
        </Cartao>
      )}

      {(solicitacao.status === 'coletada' || podeColetar) && (
        <Cartao>
          <Text style={estilos.rotuloSecao}>Registros desta solicitação</Text>
          {registros.length === 0 ? (
            <Vazio mensagem="Nenhum registro de coleta ainda." />
          ) : (
            registros.map((registro) => (
              <View key={registro.id} style={estilos.blocoRegistroSalvo}>
                <GradeMateriais materiais={materiaisDoRegistro(registro)} />
                <View style={estilos.linhaRegistro}>
                  <Text style={estilos.registroValores}>
                    {formatarKg(registro.kg)}
                    {registro.unidades > 0 ? ` · ${registro.unidades} un.` : ''}
                  </Text>
                </View>
                {registro.foto_url ? (
                  <Image source={{ uri: registro.foto_url }} style={estilos.foto} contentFit="cover" />
                ) : null}
                <Text style={estilos.detalhe}>{formatarData(registro.created_at)}</Text>
                {podeColetar ? (
                  <Botao
                    titulo="Desfazer registro"
                    variante="secundario"
                    aoTocar={() => desfazerRegistro(registro.id)}
                    carregando={desfazendoId === registro.id}
                  />
                ) : null}
              </View>
            ))
          )}
        </Cartao>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  voltar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.xs,
    marginBottom: Espaco.m,
    alignSelf: 'flex-start',
  },
  voltarTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: Cores.texto,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.s,
    marginBottom: Espaco.s,
  },
  nome: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Cores.texto,
  },
  detalhe: {
    fontSize: 13,
    color: Cores.textoSecundario,
    marginTop: 2,
  },
  foto: {
    height: 200,
    borderRadius: Raio.m,
    marginTop: Espaco.m,
    marginBottom: Espaco.s,
  },
  rotuloSecao: {
    fontSize: 15,
    fontWeight: '700',
    color: Cores.texto,
    marginBottom: Espaco.m,
  },
  fotosMateriais: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.s,
    marginBottom: Espaco.m,
    marginTop: Espaco.s,
  },
  rotuloCampo: {
    fontSize: 14,
    fontWeight: '600',
    color: Cores.texto,
    marginBottom: Espaco.s,
  },
  blocoRegistroSalvo: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
    gap: Espaco.s,
  },
  linhaRegistro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  registroValores: {
    fontSize: 14,
    color: Cores.textoSecundario,
  },
});
