import { normalizarTexto } from './municipio';
import type { Material, Solicitacao } from './types';

export const CATALOGO_MATERIAIS: { nome: string; icone: string; cor: string }[] = [
  { nome: 'Plástico', icone: '🧴', cor: '#2563EB' },
  { nome: 'PET', icone: '🥤', cor: '#0284C7' },
  { nome: 'Papel', icone: '📄', cor: '#CA8A04' },
  { nome: 'Papelão', icone: '📦', cor: '#B45309' },
  { nome: 'Alumínio', icone: '🥫', cor: '#6B7280' },
  { nome: 'Metal', icone: '⚙️', cor: '#4B5563' },
  { nome: 'Vidro', icone: '🍾', cor: '#059669' },
  { nome: 'Embalagem longa vida', icone: '🧃', cor: '#65A30D' },
  { nome: 'Isopor', icone: '🔳', cor: '#78716C' },
  { nome: 'Eletrônicos', icone: '🔌', cor: '#7C3AED' },
  { nome: 'Pilhas e baterias', icone: '🔋', cor: '#DC2626' },
  { nome: 'Óleo de cozinha', icone: '🛢️', cor: '#D97706' },
  { nome: 'Lâmpadas', icone: '💡', cor: '#F59E0B' },
  { nome: 'Orgânico', icone: '🍃', cor: '#16A34A' },
  { nome: 'Madeira', icone: '🪵', cor: '#92400E' },
  { nome: 'Tecidos', icone: '👕', cor: '#DB2777' },
  { nome: 'Entulho', icone: '🧱', cor: '#A8A29E' },
  { nome: 'Pneus', icone: '🚗', cor: '#111827' },
  { nome: 'Móveis', icone: '🪑', cor: '#9A3412' },
  { nome: 'Podas e galhos', icone: '🌿', cor: '#15803D' },
];

/** Sempre devolve os 20 materiais do catálogo, preenchendo o que o banco ainda não tiver. */
export function completarMateriais(cadastrados: Material[]): Material[] {
  const porNome = new Map<string, Material>();
  for (const material of cadastrados) {
    const chave = normalizarTexto(material.nome);
    if (!porNome.has(chave)) porNome.set(chave, material);
  }

  return CATALOGO_MATERIAIS.map((padrao) => {
    const existente = porNome.get(normalizarTexto(padrao.nome));
    if (existente) {
      return { ...existente, icone: padrao.icone, cor: existente.cor ?? padrao.cor };
    }
    return {
      id: `padrao:${normalizarTexto(padrao.nome)}`,
      municipio_id: '',
      nome: padrao.nome,
      icone: padrao.icone,
      cor: padrao.cor,
    };
  });
}

export function ehMaterialCadastrado(material: Pick<Material, 'id' | 'municipio_id'>) {
  return !!material.municipio_id && !material.id.startsWith('padrao:');
}

export function materiaisDaSolicitacao(solicitacao: Pick<Solicitacao, 'solicitacao_materiais'>): Material[] {
  return (solicitacao.solicitacao_materiais ?? [])
    .map((item) => item.materiais)
    .filter((material): material is Material => !!material);
}
