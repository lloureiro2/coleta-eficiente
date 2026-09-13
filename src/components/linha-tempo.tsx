import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco } from '@/constants/theme';
import { formatarData, STATUS_COR, STATUS_ROTULO } from '@/lib/rotulos';
import type { SolicitacaoEvento } from '@/lib/types';

export function LinhaTempo({ eventos }: { eventos: SolicitacaoEvento[] }) {
  if (eventos.length === 0) return null;

  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <View style={estilos.lista}>
      {ordenados.map((evento, indice) => {
        const cores = STATUS_COR[evento.status];
        const ultimo = indice === ordenados.length - 1;
        return (
          <View key={evento.id} style={estilos.item}>
            <View style={estilos.eixo}>
              <View style={[estilos.ponto, { backgroundColor: cores.texto }]} />
              {!ultimo && <View style={estilos.linha} />}
            </View>
            <View style={[estilos.corpo, ultimo && { paddingBottom: 0 }]}>
              <Text style={estilos.status}>{STATUS_ROTULO[evento.status]}</Text>
              <Text style={estilos.meta}>{formatarData(evento.created_at)}</Text>
              {evento.ator_nome ? (
                <Text style={estilos.meta}>
                  {evento.ator_rotulo ? `${evento.ator_rotulo}: ` : ''}
                  {evento.ator_nome}
                </Text>
              ) : null}
              {evento.endereco ? <Text style={estilos.meta}>Onde: {evento.endereco}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: {
    marginTop: Espaco.s,
  },
  item: {
    flexDirection: 'row',
    gap: Espaco.s,
  },
  eixo: {
    width: 14,
    alignItems: 'center',
  },
  ponto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  linha: {
    flex: 1,
    width: 2,
    backgroundColor: Cores.borda,
    marginVertical: 2,
  },
  corpo: {
    flex: 1,
    paddingBottom: Espaco.m,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    color: Cores.texto,
  },
  meta: {
    fontSize: 12,
    color: Cores.textoSecundario,
    marginTop: 2,
  },
});
