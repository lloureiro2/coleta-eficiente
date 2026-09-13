export type Papel = 'cidadao' | 'gestor' | 'admin';

export type TipoMunicipio = 'prefeitura' | 'cooperativa';

export type GeneroPessoa = 'masculino' | 'feminino';

export type StatusSolicitacao =
  | 'pendente'
  | 'aprovada'
  | 'agendada'
  | 'confirmada'
  | 'caminhao_a_caminho'
  | 'coletada'
  | 'recusada'
  | 'cancelada';

export interface Municipio {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  tipo: TipoMunicipio;
}

export interface Perfil {
  id: string;
  municipio_id: string | null;
  papel: Papel;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  numero: string | null;
  genero: GeneroPessoa | null;
  latitude: number | null;
  longitude: number | null;
  conta_institucional?: boolean;
  municipios?: Municipio | null;
}

export interface Material {
  id: string;
  municipio_id: string;
  nome: string;
  icone: string | null;
  cor: string | null;
}

export interface AgendaColeta {
  id: string;
  municipio_id: string;
  material_id: string;
  dia_semana: number; // 0 = domingo ... 6 = sábado
  bairro: string | null;
  materiais?: Material | null;
}

export interface SolicitacaoMaterial {
  material_id: string;
  materiais?: Material | null;
}

export interface Solicitacao {
  id: string;
  municipio_id: string;
  cooperativa_id: string | null;
  operador_id: string | null;
  cidadao_id: string;
  status: StatusSolicitacao;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  quantidade_estimada: string | null;
  observacao: string | null;
  motivo_recusa: string | null;
  origem_recusa: 'prefeitura' | 'cooperativa' | 'gestor' | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
  solicitacao_materiais?: SolicitacaoMaterial[];
  profiles?: Pick<Perfil, 'nome' | 'telefone' | 'genero'> | null;
  municipios?: Pick<Municipio, 'nome' | 'cidade' | 'tipo'> | null;
  cooperativa?: Pick<Municipio, 'nome' | 'cidade' | 'tipo'> | null;
  operador?: Pick<Perfil, 'id' | 'nome' | 'email' | 'genero'> | null;
  registros_coleta?: RegistroColeta[];
  solicitacao_eventos?: SolicitacaoEvento[];
}

export interface SolicitacaoEvento {
  id: string;
  solicitacao_id: string;
  status: StatusSolicitacao;
  ator_id: string | null;
  ator_nome: string | null;
  ator_rotulo: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface VinculoPrefeituraCooperativa {
  prefeitura_id: string;
  cooperativa_id: string;
}

export interface RegistroColetaMaterial {
  material_id: string;
  materiais?: Material | null;
}

export interface RegistroColeta {
  id: string;
  municipio_id: string;
  solicitacao_id: string | null;
  material_id: string;
  kg: number;
  unidades: number;
  foto_url: string | null;
  created_at: string;
  materiais?: Material | null;
  registro_coleta_materiais?: RegistroColetaMaterial[];
}
