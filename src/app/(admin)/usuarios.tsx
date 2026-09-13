import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Carregando, Cartao, Chip, Selo, Tela, Titulo, Vazio } from '@/components/ui';
import { Cores, Espaco } from '@/constants/theme';
import { rotuloCidadao, rotuloGestorPessoa } from '@/lib/rotulos';
import { supabase } from '@/lib/supabase';
import type { Perfil, TipoMunicipio } from '@/lib/types';

type PerfilComMunicipio = Perfil & {
  municipios?: { nome: string; tipo: TipoMunicipio } | null;
};

type FiltroUsuario = 'todos' | 'cidadao' | 'cooperativa' | 'prefeitura';

const FILTROS: { valor: FiltroUsuario; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'cidadao', rotulo: 'Cidadãos e cidadãs' },
  { valor: 'cooperativa', rotulo: 'Cooperativas' },
  { valor: 'prefeitura', rotulo: 'Prefeituras' },
];

function categoria(usuario: PerfilComMunicipio): FiltroUsuario | 'admin' {
  if (usuario.papel === 'admin') return 'admin';
  if (usuario.conta_institucional && usuario.municipios?.tipo === 'cooperativa') return 'cooperativa';
  if (usuario.municipios?.tipo === 'prefeitura' && usuario.papel === 'gestor') return 'prefeitura';
  return 'cidadao';
}

function selo(usuario: PerfilComMunicipio) {
  const tipo = categoria(usuario);
  if (tipo === 'admin') return { texto: 'Admin', fundo: Cores.infoClaro, cor: Cores.info };
  if (tipo === 'cooperativa') return { texto: 'Cooperativa', fundo: Cores.alertaClaro, cor: Cores.alerta };
  if (tipo === 'prefeitura') {
    return usuario.conta_institucional
      ? { texto: 'Prefeitura', fundo: Cores.primariaClara, cor: Cores.primariaEscura }
      : { texto: rotuloGestorPessoa(usuario.genero), fundo: Cores.infoClaro, cor: Cores.info };
  }
  if (usuario.papel === 'gestor' && !usuario.conta_institucional) {
    return { texto: rotuloGestorPessoa(usuario.genero), fundo: Cores.infoClaro, cor: Cores.info };
  }
  return { texto: rotuloCidadao(usuario.genero), fundo: Cores.neutroClaro, cor: Cores.texto };
}

export default function UsuariosAdmin() {
  const [usuarios, setUsuarios] = useState<PerfilComMunicipio[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroUsuario>('todos');

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, municipios(nome, tipo)')
      .order('created_at', { ascending: false });
    setUsuarios((data as PerfilComMunicipio[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const filtrados = useMemo(() => {
    if (!usuarios) return [];
    if (filtro === 'todos') return usuarios;
    return usuarios.filter((u) => categoria(u) === filtro);
  }, [usuarios, filtro]);

  if (!usuarios) {
    return (
      <Tela rolagem={false}>
        <Carregando />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo sub="A prefeitura e a cooperativa são e-mails de acesso, criados pelo admin. Pessoas da Equipe viram gestores.">
        Usuários
      </Titulo>

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

      {filtrados.length === 0 && <Vazio mensagem="Nenhum usuário neste filtro." />}

      {filtrados.map((usuario) => {
        const marca = selo(usuario);
        return (
          <Cartao key={usuario.id}>
            <View style={estilos.topo}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.nome}>
                  {usuario.conta_institucional
                    ? usuario.municipios?.nome || usuario.nome || 'Conta de acesso'
                    : usuario.nome || 'Sem nome'}
                </Text>
                {usuario.email && <Text style={estilos.detalhe}>{usuario.email}</Text>}
                {!usuario.conta_institucional && (
                  <Text style={estilos.detalhe}>{usuario.municipios?.nome ?? 'Sem contratante'}</Text>
                )}
              </View>
              <Selo texto={marca.texto} fundo={marca.fundo} cor={marca.cor} />
            </View>
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
