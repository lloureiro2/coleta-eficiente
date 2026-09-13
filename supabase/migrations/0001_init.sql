-- =============================================================
-- Coleta Eficiente - Esquema inicial
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- (ou via `supabase db push` se usar o CLI).
-- =============================================================

-- ---------- Tipos ----------
create type public.tipo_municipio as enum ('prefeitura', 'cooperativa');
create type public.papel_usuario as enum ('cidadao', 'gestor');
create type public.status_solicitacao as enum (
  'pendente',
  'agendada',
  'caminhao_a_caminho',
  'coletada',
  'cancelada'
);

-- ---------- Tabelas ----------

-- O "domínio": cada prefeitura ou cooperativa contratante.
create table public.municipios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text not null,
  uf text not null,
  tipo public.tipo_municipio not null default 'prefeitura',
  created_at timestamptz not null default now()
);

-- Perfil de cada usuário (cidadão ou gestor), vinculado a um município.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  municipio_id uuid not null references public.municipios (id),
  papel public.papel_usuario not null default 'cidadao',
  nome text not null default '',
  telefone text,
  endereco text,
  bairro text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

-- Materiais recicláveis aceitos por município (plástico, papelão, alumínio, vidro...).
create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  nome text not null,
  icone text,
  cor text,
  created_at timestamptz not null default now()
);

-- Dias de coleta por material e bairro (bairro nulo = todos os bairros).
create table public.agenda_coletas (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  material_id uuid not null references public.materiais (id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0 = domingo
  bairro text,
  created_at timestamptz not null default now()
);

-- Solicitações de coleta porta a porta feitas pelos cidadãos.
create table public.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id),
  cidadao_id uuid not null references public.profiles (id) on delete cascade,
  status public.status_solicitacao not null default 'pendente',
  latitude double precision,
  longitude double precision,
  endereco text,
  bairro text,
  quantidade_estimada text,
  observacao text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Materiais de cada solicitação.
create table public.solicitacao_materiais (
  solicitacao_id uuid not null references public.solicitacoes (id) on delete cascade,
  material_id uuid not null references public.materiais (id) on delete cascade,
  primary key (solicitacao_id, material_id)
);

-- Controle da contratante: o que foi efetivamente coletado (kg e unidades).
create table public.registros_coleta (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id),
  solicitacao_id uuid references public.solicitacoes (id) on delete set null,
  material_id uuid not null references public.materiais (id),
  kg numeric(10, 2) not null default 0,
  unidades int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_solicitacoes_municipio_status on public.solicitacoes (municipio_id, status);
create index idx_solicitacoes_cidadao on public.solicitacoes (cidadao_id);
create index idx_registros_municipio_data on public.registros_coleta (municipio_id, created_at);
create index idx_agenda_municipio on public.agenda_coletas (municipio_id);

-- ---------- Funções auxiliares (evitam recursão de RLS) ----------

create or replace function public.meu_municipio()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select municipio_id from public.profiles where id = auth.uid();
$$;

create or replace function public.sou_gestor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and papel = 'gestor'
  );
$$;

-- ---------- Perfil criado automaticamente no cadastro ----------

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, municipio_id, nome, telefone, endereco, bairro)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'municipio_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'endereco',
    new.raw_user_meta_data ->> 'bairro'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_novo_usuario();

-- ---------- updated_at automático ----------

create or replace function public.atualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_solicitacoes_updated_at
  before update on public.solicitacoes
  for each row execute function public.atualizar_updated_at();

-- ---------- RLS (Row Level Security) ----------

alter table public.municipios enable row level security;
alter table public.profiles enable row level security;
alter table public.materiais enable row level security;
alter table public.agenda_coletas enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.solicitacao_materiais enable row level security;
alter table public.registros_coleta enable row level security;

-- Municípios: lista pública (necessária na tela de cadastro).
create policy "municipios_select" on public.municipios
  for select using (true);

-- Profiles: cada um vê o próprio; gestor vê os do seu município.
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or (public.sou_gestor() and municipio_id = public.meu_municipio())
  );

create policy "profiles_update_proprio" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and papel = 'cidadao' or public.sou_gestor());

-- Materiais: visíveis para membros do município; gerenciados pelo gestor.
create policy "materiais_select" on public.materiais
  for select using (municipio_id = public.meu_municipio());

create policy "materiais_gestor" on public.materiais
  for all using (public.sou_gestor() and municipio_id = public.meu_municipio())
  with check (public.sou_gestor() and municipio_id = public.meu_municipio());

-- Agenda: visível para membros do município; gerenciada pelo gestor.
create policy "agenda_select" on public.agenda_coletas
  for select using (municipio_id = public.meu_municipio());

create policy "agenda_gestor" on public.agenda_coletas
  for all using (public.sou_gestor() and municipio_id = public.meu_municipio())
  with check (public.sou_gestor() and municipio_id = public.meu_municipio());

-- Solicitações: cidadão vê/cria as próprias; gestor vê/atualiza as do município.
create policy "solicitacoes_select" on public.solicitacoes
  for select using (
    cidadao_id = auth.uid()
    or (public.sou_gestor() and municipio_id = public.meu_municipio())
  );

create policy "solicitacoes_insert" on public.solicitacoes
  for insert with check (
    cidadao_id = auth.uid() and municipio_id = public.meu_municipio()
  );

-- Cidadão só pode cancelar a própria solicitação enquanto pendente.
create policy "solicitacoes_cancelar_propria" on public.solicitacoes
  for update using (cidadao_id = auth.uid() and status = 'pendente')
  with check (cidadao_id = auth.uid() and status in ('pendente', 'cancelada'));

create policy "solicitacoes_update_gestor" on public.solicitacoes
  for update using (public.sou_gestor() and municipio_id = public.meu_municipio())
  with check (public.sou_gestor() and municipio_id = public.meu_municipio());

-- Materiais da solicitação: seguem a visibilidade da solicitação.
create policy "solicitacao_materiais_select" on public.solicitacao_materiais
  for select using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (
          s.cidadao_id = auth.uid()
          or (public.sou_gestor() and s.municipio_id = public.meu_municipio())
        )
    )
  );

create policy "solicitacao_materiais_insert" on public.solicitacao_materiais
  for insert with check (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id and s.cidadao_id = auth.uid()
    )
  );

-- Registros de coleta: gestor gerencia; cidadão vê os das próprias solicitações.
create policy "registros_select" on public.registros_coleta
  for select using (
    (public.sou_gestor() and municipio_id = public.meu_municipio())
    or exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id and s.cidadao_id = auth.uid()
    )
  );

create policy "registros_gestor" on public.registros_coleta
  for all using (public.sou_gestor() and municipio_id = public.meu_municipio())
  with check (public.sou_gestor() and municipio_id = public.meu_municipio());

-- ---------- Storage: bucket público para fotos das solicitações ----------

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "fotos_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos');

create policy "fotos_select" on storage.objects
  for select using (bucket_id = 'fotos');
