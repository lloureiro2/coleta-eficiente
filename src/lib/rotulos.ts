import { Cores } from '@/constants/theme';
import type { GeneroPessoa, Material, RegistroColeta, Solicitacao, StatusSolicitacao } from './types';

export const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export const STATUS_ROTULO: Record<StatusSolicitacao, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  agendada: 'Encaminhada',
  confirmada: 'Confirmada',
  caminhao_a_caminho: 'Caminhão a caminho',
  coletada: 'Coletada',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
};

export const STATUS_COR: Record<StatusSolicitacao, { fundo: string; texto: string }> = {
  pendente: { fundo: Cores.alertaClaro, texto: Cores.alerta },
  aprovada: { fundo: Cores.primariaClara, texto: Cores.primariaEscura },
  agendada: { fundo: Cores.infoClaro, texto: Cores.info },
  confirmada: { fundo: Cores.primariaClara, texto: Cores.primariaEscura },
  caminhao_a_caminho: { fundo: Cores.infoClaro, texto: Cores.info },
  coletada: { fundo: Cores.primariaClara, texto: Cores.primariaEscura },
  recusada: { fundo: Cores.perigoClaro, texto: Cores.perigo },
  cancelada: { fundo: Cores.perigoClaro, texto: Cores.perigo },
};

/** Próxima etapa operacional — o mesmo para prefeitura e cooperativa. */
export const PROXIMO_STATUS: Partial<
  Record<StatusSolicitacao, { status: StatusSolicitacao; acao: string }>
> = {
  aprovada: { status: 'caminhao_a_caminho', acao: 'Despachar caminhão' },
  agendada: { status: 'caminhao_a_caminho', acao: 'Despachar caminhão' },
  confirmada: { status: 'caminhao_a_caminho', acao: 'Despachar caminhão' },
  caminhao_a_caminho: { status: 'coletada', acao: 'Registrar coleta' },
};

export function textoMotivoRecusa(
  solicitacao: Pick<Solicitacao, 'motivo_recusa' | 'origem_recusa' | 'status'>
) {
  const motivo = solicitacao.motivo_recusa?.trim();
  if (!motivo) return null;
  if (solicitacao.origem_recusa === 'cooperativa') {
    return `Recusada pela cooperativa: ${motivo}`;
  }
  if (solicitacao.origem_recusa === 'gestor') {
    return `Recusada pela equipe: ${motivo}`;
  }
  if (solicitacao.status === 'recusada' || solicitacao.origem_recusa === 'prefeitura') {
    return `Recusada pela prefeitura: ${motivo}`;
  }
  return `Motivo da recusa: ${motivo}`;
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarKg(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

export function materiaisDoRegistro(registro: RegistroColeta): Material[] {
  const lista = (registro.registro_coleta_materiais ?? [])
    .map((item) => item.materiais)
    .filter((material): material is Material => !!material);
  if (lista.length > 0) return lista;
  return registro.materiais ? [registro.materiais] : [];
}

export function formatarMateriaisRegistro(registro: RegistroColeta): string {
  const lista = materiaisDoRegistro(registro);
  if (lista.length > 0) {
    return lista
      .map((material) => `${material.icone ?? ''} ${material.nome}`.trim())
      .filter(Boolean)
      .join(' e ');
  }
  return 'Material';
}

export function rotuloCidadao(genero?: GeneroPessoa | null) {
  return genero === 'feminino' ? 'Cidadã' : 'Cidadão';
}

export function rotuloGestorPessoa(genero?: GeneroPessoa | null) {
  return genero === 'feminino' ? 'Cidadã gestora' : 'Cidadão gestor';
}

export function rotuloRebaixarCidadao(genero?: GeneroPessoa | null) {
  return genero === 'feminino' ? 'Rebaixar para cidadã' : 'Rebaixar para cidadão';
}

export function textoLocalSolicitacao(solicitacao: Pick<Solicitacao, 'endereco' | 'bairro' | 'cidade' | 'uf'>) {
  return (
    [solicitacao.endereco, solicitacao.bairro, [solicitacao.cidade, solicitacao.uf].filter(Boolean).join('/')]
      .filter(Boolean)
      .join(' · ') || 'Endereço via localização no mapa'
  );
}
