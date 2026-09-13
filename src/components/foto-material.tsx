import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Raio } from '@/constants/theme';
import { iconeDoMaterial } from '@/lib/municipio';
import type { Material } from '@/lib/types';

export function FotoMaterial({
  material,
  selecionado = false,
  aoTocar,
}: {
  material: Pick<Material, 'nome' | 'icone' | 'cor'>;
  selecionado?: boolean;
  aoTocar?: () => void;
}) {
  const cor = material.cor ?? Cores.primaria;
  const estilo = [
    estilos.foto,
    selecionado ? { borderColor: cor, backgroundColor: `${cor}22` } : null,
  ];
  const conteudo = (
    <>
      <Text style={estilos.icone}>{iconeDoMaterial(material)}</Text>
      <Text style={estilos.nome} numberOfLines={2}>
        {material.nome}
      </Text>
    </>
  );

  if (aoTocar) {
    return (
      <Pressable onPress={aoTocar} style={estilo}>
        {conteudo}
      </Pressable>
    );
  }

  return <View style={estilo}>{conteudo}</View>;
}

export function GradeMateriais({
  materiais,
  estaSelecionado,
  aoTocar,
}: {
  materiais: Array<Pick<Material, 'id' | 'nome' | 'icone' | 'cor'> | null | undefined>;
  estaSelecionado?: (material: Pick<Material, 'id' | 'nome'>) => boolean;
  aoTocar?: (material: Pick<Material, 'id' | 'nome' | 'icone' | 'cor'>) => void;
}) {
  const lista = materiais.filter((material): material is NonNullable<typeof material> => !!material);
  if (lista.length === 0) return null;
  return (
    <View style={estilos.grade}>
      {lista.map((material) => (
        <FotoMaterial
          key={material.id || material.nome}
          material={material}
          selecionado={estaSelecionado ? estaSelecionado(material) : true}
          aoTocar={aoTocar ? () => aoTocar(material) : undefined}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  foto: {
    width: 76,
    minHeight: 84,
    padding: Espaco.s,
    borderRadius: Raio.m,
    borderWidth: 2,
    borderColor: Cores.borda,
    backgroundColor: Cores.neutroClaro,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  icone: {
    fontSize: 32,
    lineHeight: 38,
  },
  nome: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: Cores.texto,
    textAlign: 'center',
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.s,
  },
});
