import type { Material, Municipio, Perfil, Solicitacao } from './types';

export function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Prefeituras e cooperativas cadastradas na cidade (clientes independentes). */
export function contratantesDaCidade(
  municipios: Municipio[],
  opcoes: { cidade?: string | null; uf?: string | null }
): Municipio[] {
  const cidade = opcoes.cidade ? normalizarTexto(opcoes.cidade) : '';
  const uf = opcoes.uf?.trim().toUpperCase() || '';
  if (!cidade) return [];
  return municipios.filter((m) => {
    if (normalizarTexto(m.cidade) !== cidade) return false;
    if (uf && m.uf.toUpperCase() !== uf) return false;
    return true;
  });
}

/**
 * Encontra a prefeitura de uma cidade (usada para garantir que um gestor
 * fique vinculado a uma prefeitura). Retorna null se não houver.
 */
export function encontrarPrefeitura(
  municipios: Municipio[],
  ref: { cidade?: string | null; uf?: string | null }
): Municipio | null {
  const cidade = ref.cidade ? normalizarTexto(ref.cidade) : '';
  const uf = ref.uf?.trim().toUpperCase() || '';
  return (
    municipios.find(
      (m) =>
        m.tipo === 'prefeitura' &&
        (!cidade || normalizarTexto(m.cidade) === cidade) &&
        (!uf || m.uf.toUpperCase() === uf)
    ) ?? null
  );
}

/** Uma lista por nome (Plástico, Vidro...), sem repetir o mesmo material de vários contratantes. */
export function deduplicarMateriais(materiais: Material[]) {
  const vistos = new Set<string>();
  return materiais.filter((material) => {
    const chave = normalizarTexto(material.nome);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function chaveMaterial(nome: string) {
  return normalizarTexto(nome);
}

/** Emoji do material. Evita inicial solta (A, P, V...) quando o ícone não veio do banco. */
export function iconeDoMaterial(material: Pick<Material, 'nome' | 'icone'>) {
  const icone = material.icone?.trim() ?? '';
  if (icone && icone.length > 1 && !/^[A-Za-zÀ-ÿ0-9]$/.test(icone)) {
    return icone;
  }
  const nome = normalizarTexto(material.nome);
  if (nome.includes('pet')) return '🥤';
  if (nome.includes('plastic')) return '🧴';
  if (nome.includes('papelao')) return '📦';
  if (nome.includes('papel')) return '📄';
  if (nome.includes('alum')) return '🥫';
  if (nome.includes('vidro')) return '🍾';
  if (nome.includes('longa vida') || nome.includes('tetra')) return '🧃';
  if (nome.includes('eletr') || nome.includes('e-lixo')) return '🔌';
  if (nome.includes('oleo')) return '🛢️';
  if (nome.includes('organ')) return '🍃';
  if (nome.includes('metal') || nome.includes('ferro') || nome.includes('sucata')) return '⚙️';
  if (nome.includes('madeira')) return '🪵';
  if (nome.includes('tecido') || nome.includes('roupa')) return '👕';
  if (nome.includes('entulho') || nome.includes('entul')) return '🧱';
  if (nome.includes('pilha') || nome.includes('bater')) return '🔋';
  if (nome.includes('isopor')) return '◻️';
  if (nome.includes('lampada')) return '💡';
  if (nome.includes('pneu')) return '🚗';
  if (nome.includes('movel')) return '🪑';
  if (nome.includes('poda') || nome.includes('galho')) return '🌿';
  return '♻️';
}

export function ehGestorPrefeitura(perfil: Perfil | null) {
  return perfil?.papel === 'gestor' && perfil.municipios?.tipo === 'prefeitura';
}

export function ehGestorCooperativa(perfil: Perfil | null) {
  return perfil?.papel === 'gestor' && perfil.municipios?.tipo === 'cooperativa';
}

export function ehContaInstitucional(perfil: Perfil | null) {
  return !!perfil?.conta_institucional;
}

/** Nome da instituição (prefeitura/cooperativa) ou o nome da pessoa. */
export function nomeDaConta(perfil: Perfil | null) {
  if (!perfil) return '';
  if (perfil.conta_institucional && perfil.municipios?.nome) return perfil.municipios.nome;
  return perfil.nome;
}

export function ehGestorPessoa(perfil: Perfil | null) {
  return perfil?.papel === 'gestor' && !perfil.conta_institucional;
}

export function rotuloResponsavel(solicitacao: Solicitacao) {
  if (solicitacao.operador?.nome) {
    const papel = solicitacao.operador.genero === 'feminino' ? 'Cidadã gestora' : 'Cidadão gestor';
    return `${papel}: ${solicitacao.operador.nome}`;
  }
  if (solicitacao.cooperativa?.nome) return `Cooperativa: ${solicitacao.cooperativa.nome}`;
  return null;
}
