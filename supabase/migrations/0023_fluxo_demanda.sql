-- Cadastro só de pessoa física, cooperativa criada pelo admin,
-- cooperativa vê o processo inteiro, histórico de status e tokens de push.

create type public.genero_pessoa as enum ('masculino', 'feminino');

alter table public.profiles
  add column if not exists genero public.genero_pessoa,
  add column if not exists cep text,
  add column if not exists numero text;

alter table public.registros_coleta
  add column if not exists foto_url text;

create table if not exists public.solicitacao_eventos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes (id) on delete cascade,
  status public.status_solicitacao not null,
  ator_id uuid references public.profiles (id) on delete set null,
  ator_nome text,
  ator_rotulo text,
  endereco text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists idx_solicitacao_eventos_solicitacao
  on public.solicitacao_eventos (solicitacao_id, created_at);

create table if not exists public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  plataforma text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_dispositivos_push_user
  on public.dispositivos_push (user_id);

-- ---------- Cadastro: cidadão público; prefeitura/cooperativa só admin ----------

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $func$
declare
  novo_municipio uuid;
  tipo_conta text := new.raw_user_meta_data ->> 'tipo_conta';
  nome_conta text;
  e_institucional boolean := false;
  papel_inicial public.papel_usuario := 'cidadao';
begin
  if tipo_conta in ('prefeitura', 'cooperativa') then
    if not public.sou_admin() then
      raise exception 'Conta institucional só pode ser criada pelo admin.';
    end if;

    novo_municipio := nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid;
    nome_conta := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
    if novo_municipio is null or nome_conta is null then
      raise exception 'Informe o município e o nome da conta institucional.';
    end if;
    e_institucional := true;
    papel_inicial := 'gestor';
  elsif tipo_conta is null or tipo_conta = '' or tipo_conta = 'cidadao' then
    novo_municipio := nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid;
    nome_conta := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), new.email);
  else
    raise exception 'Tipo de conta inválido.';
  end if;

  insert into public.profiles (
    id, municipio_id, nome, email, telefone, endereco, bairro, cidade, uf,
    papel, conta_institucional, genero, cep, numero
  ) values (
    new.id,
    novo_municipio,
    nome_conta,
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'endereco',
    new.raw_user_meta_data ->> 'bairro',
    new.raw_user_meta_data ->> 'cidade',
    new.raw_user_meta_data ->> 'uf',
    papel_inicial,
    e_institucional,
    nullif(new.raw_user_meta_data ->> 'genero', '')::public.genero_pessoa,
    new.raw_user_meta_data ->> 'cep',
    new.raw_user_meta_data ->> 'numero'
  );
  return new;
end;
$func$;

create or replace function public.criar_contratante(
  p_nome text,
  p_cidade text,
  p_uf text,
  p_email text,
  p_senha text,
  p_tipo public.tipo_municipio
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $func$
declare
  novo_municipio uuid;
  novo_usuario uuid := gen_random_uuid();
  email_conta text := lower(trim(p_email));
  nome_conta text := trim(p_nome);
  cidade_conta text := trim(p_cidade);
  uf_conta text := upper(left(trim(p_uf), 2));
  rotulo text := case when p_tipo = 'cooperativa' then 'cooperativa' else 'prefeitura' end;
begin
  if not public.sou_admin() then
    raise exception 'Só o admin pode criar %.', rotulo;
  end if;
  if p_tipo not in ('prefeitura', 'cooperativa') then
    raise exception 'Tipo inválido.';
  end if;
  if nome_conta = '' or cidade_conta = '' or uf_conta = '' then
    raise exception 'Preencha nome, cidade e UF.';
  end if;
  if email_conta = '' or position('@' in email_conta) = 0 then
    raise exception 'Informe o e-mail de acesso da %.', rotulo;
  end if;
  if char_length(p_senha) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  if exists (select 1 from auth.users where lower(email) = email_conta) then
    raise exception 'Já existe uma conta com este e-mail.';
  end if;

  insert into public.municipios (nome, cidade, uf, tipo)
  values (nome_conta, cidade_conta, uf_conta, p_tipo)
  returning id into novo_municipio;

  perform public.popular_materiais_padrao(novo_municipio);

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    novo_usuario,
    'authenticated',
    'authenticated',
    email_conta,
    crypt(p_senha, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'tipo_conta', p_tipo::text,
      'nome', nome_conta,
      'municipio_id', novo_municipio,
      'cidade', cidade_conta,
      'uf', uf_conta
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    email
  ) values (
    novo_usuario::text,
    novo_usuario,
    jsonb_build_object('sub', novo_usuario::text, 'email', email_conta),
    'email',
    now(),
    now(),
    now(),
    email_conta
  );

  return novo_municipio;
end;
$func$;

create or replace function public.criar_prefeitura(
  p_nome text,
  p_cidade text,
  p_uf text,
  p_email text,
  p_senha text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
begin
  return public.criar_contratante(p_nome, p_cidade, p_uf, p_email, p_senha, 'prefeitura');
end;
$func$;

grant execute on function public.criar_contratante(text, text, text, text, text, public.tipo_municipio) to authenticated;
grant execute on function public.criar_prefeitura(text, text, text, text, text) to authenticated;

-- ---------- Visibilidade unificada ----------

create or replace function public.gestor_enxerga_solicitacao(
  p_municipio_id uuid,
  p_cooperativa_id uuid,
  p_operador_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.sou_admin()
    or (
      public.sou_gestor_prefeitura()
      and p_municipio_id = public.meu_municipio()
    )
    or (
      public.sou_gestor_cooperativa()
      and (
        p_municipio_id = public.meu_municipio()
        or p_cooperativa_id = public.meu_municipio()
      )
    )
    or p_operador_id = auth.uid();
$$;

drop policy if exists "solicitacoes_select" on public.solicitacoes;
create policy "solicitacoes_select" on public.solicitacoes
  for select using (
    cidadao_id = auth.uid()
    or public.gestor_enxerga_solicitacao(municipio_id, cooperativa_id, operador_id)
  );

drop policy if exists "solicitacoes_update_cooperativa" on public.solicitacoes;
create policy "solicitacoes_update_cooperativa" on public.solicitacoes
  for update using (
    public.sou_gestor_cooperativa()
    and cooperativa_id = public.meu_municipio()
    and municipio_id is distinct from public.meu_municipio()
  )
  with check (
    public.sou_gestor_cooperativa()
    and cooperativa_id = public.meu_municipio()
  );

drop policy if exists "solicitacoes_update_cooperativa_dona" on public.solicitacoes;
create policy "solicitacoes_update_cooperativa_dona" on public.solicitacoes
  for update using (
    public.sou_gestor_cooperativa()
    and municipio_id = public.meu_municipio()
  )
  with check (
    public.sou_gestor_cooperativa()
    and municipio_id = public.meu_municipio()
    and (cooperativa_id is null or cooperativa_id = public.meu_municipio())
    and (
      operador_id is null
      or exists (
        select 1 from public.profiles p
        where p.id = operador_id
          and p.municipio_id = public.meu_municipio()
          and p.papel = 'gestor'
          and coalesce(p.conta_institucional, false) = false
      )
    )
  );

drop policy if exists "solicitacao_materiais_select" on public.solicitacao_materiais;
create policy "solicitacao_materiais_select" on public.solicitacao_materiais
  for select using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (
          s.cidadao_id = auth.uid()
          or public.gestor_enxerga_solicitacao(s.municipio_id, s.cooperativa_id, s.operador_id)
        )
    )
  );

drop policy if exists "registros_select" on public.registros_coleta;
create policy "registros_select" on public.registros_coleta
  for select using (
    public.sou_admin()
    or exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id and s.cidadao_id = auth.uid()
    )
    or exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and public.gestor_enxerga_solicitacao(s.municipio_id, s.cooperativa_id, s.operador_id)
    )
  );

drop policy if exists "registro_materiais_select" on public.registro_coleta_materiais;
create policy "registro_materiais_select" on public.registro_coleta_materiais
  for select using (
    exists (
      select 1 from public.registros_coleta r
      join public.solicitacoes s on s.id = r.solicitacao_id
      where r.id = registro_id
        and (
          public.sou_admin()
          or s.cidadao_id = auth.uid()
          or public.gestor_enxerga_solicitacao(s.municipio_id, s.cooperativa_id, s.operador_id)
        )
    )
  );

create or replace function public.pode_registrar_coleta(p_solicitacao public.solicitacoes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      public.sou_gestor_cooperativa()
      and (
        p_solicitacao.cooperativa_id = public.meu_municipio()
        or p_solicitacao.municipio_id = public.meu_municipio()
      )
    )
    or p_solicitacao.operador_id = auth.uid()
    or (
      public.sou_gestor_prefeitura()
      and p_solicitacao.municipio_id = public.meu_municipio()
    );
$$;

drop function if exists public.registrar_coleta(uuid, uuid[], numeric, integer);

create or replace function public.registrar_coleta(
  p_solicitacao_id uuid,
  p_material_ids uuid[],
  p_kg numeric,
  p_unidades integer,
  p_foto_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare
  alvo public.solicitacoes;
  novo_id uuid;
  municipio_registro uuid;
begin
  select * into alvo from public.solicitacoes where id = p_solicitacao_id;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;
  if not public.pode_registrar_coleta(alvo) then
    raise exception 'Você não pode registrar esta coleta.';
  end if;
  if p_material_ids is null or coalesce(array_length(p_material_ids, 1), 0) = 0 then
    raise exception 'Confira os materiais desta solicitação.';
  end if;
  if exists (
    select 1
    from unnest(p_material_ids) as mid
    where not exists (
      select 1 from public.solicitacao_materiais sm
      where sm.solicitacao_id = p_solicitacao_id and sm.material_id = mid
    )
  ) then
    raise exception 'Registre apenas os materiais pedidos nesta solicitação.';
  end if;
  if coalesce(p_kg, 0) <= 0 then
    raise exception 'Informe o peso coletado (kg).';
  end if;
  if nullif(trim(coalesce(p_foto_url, '')), '') is null then
    raise exception 'Envie a foto da coleta.';
  end if;

  municipio_registro := coalesce(public.meu_municipio(), alvo.municipio_id);

  insert into public.registros_coleta (
    municipio_id, solicitacao_id, material_id, kg, unidades, foto_url
  ) values (
    municipio_registro, p_solicitacao_id, p_material_ids[1], coalesce(p_kg, 0), coalesce(p_unidades, 0), p_foto_url
  )
  returning id into novo_id;

  insert into public.registro_coleta_materiais (registro_id, material_id)
  select novo_id, unnest(p_material_ids)
  on conflict do nothing;

  return novo_id;
end;
$func$;

grant execute on function public.registrar_coleta(uuid, uuid[], numeric, integer, text) to authenticated;

create or replace function public.buscar_pessoa_para_equipe(p_email text, p_cidade text)
returns setof public.profiles
language plpgsql security definer
set search_path = public
as $func$
declare
  email_busca text := lower(trim(coalesce(p_email, '')));
  cidade_busca text := public.normalizar_texto(coalesce(p_cidade, ''));
begin
  if not public.sou_gestor() and not public.sou_admin() then
    raise exception 'Não autorizado';
  end if;
  if char_length(email_busca) < 3 and char_length(cidade_busca) < 3 then
    return;
  end if;

  if public.sou_gestor_cooperativa() then
    return query
    select p.*
    from public.profiles p
    left join public.municipios m on m.id = p.municipio_id
    where p.papel <> 'admin'
      and p.id <> auth.uid()
      and coalesce(p.conta_institucional, false) = false
      and (p.municipio_id is null or p.municipio_id = public.meu_municipio())
      and (
        (char_length(email_busca) >= 3 and lower(coalesce(p.email, '')) like '%' || email_busca || '%')
        or (
          char_length(cidade_busca) >= 3
          and (
            public.normalizar_texto(coalesce(p.cidade, '')) like '%' || cidade_busca || '%'
            or public.normalizar_texto(coalesce(p.bairro, '')) like '%' || cidade_busca || '%'
            or public.normalizar_texto(coalesce(p.endereco, '')) like '%' || cidade_busca || '%'
            or public.normalizar_texto(coalesce(m.cidade, '')) like '%' || cidade_busca || '%'
          )
        )
      );
    return;
  end if;

  return query
  select p.*
  from public.profiles p
  left join public.municipios m on m.id = p.municipio_id
  where p.papel <> 'admin'
    and p.id <> auth.uid()
    and (p.conta_institucional = false or m.tipo = 'cooperativa')
    and (
      (char_length(email_busca) >= 3 and lower(coalesce(p.email, '')) like '%' || email_busca || '%')
      or (
        char_length(cidade_busca) >= 3
        and (
          public.normalizar_texto(coalesce(p.cidade, '')) like '%' || cidade_busca || '%'
          or public.normalizar_texto(coalesce(p.bairro, '')) like '%' || cidade_busca || '%'
          or public.normalizar_texto(coalesce(p.endereco, '')) like '%' || cidade_busca || '%'
          or public.normalizar_texto(coalesce(m.cidade, '')) like '%' || cidade_busca || '%'
          or public.normalizar_texto(coalesce(m.nome, '')) like '%' || cidade_busca || '%'
        )
      )
    )
    and (
      p.municipio_id is null
      or p.municipio_id = public.meu_municipio()
      or m.tipo = 'cooperativa'
    );
end;
$func$;

-- ---------- Histórico + push ----------

create or replace function public.rotulo_status_solicitacao(p_status public.status_solicitacao)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pendente' then 'Pendente'
    when 'aprovada' then 'Aprovada'
    when 'agendada' then 'Encaminhada'
    when 'confirmada' then 'Confirmada'
    when 'caminhao_a_caminho' then 'Caminhão a caminho'
    when 'coletada' then 'Coletada'
    when 'recusada' then 'Recusada'
    when 'cancelada' then 'Cancelada'
    else p_status::text
  end;
$$;

create or replace function public.mensagem_push_status(p_status public.status_solicitacao)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pendente' then 'Sua solicitação de coleta foi registrada.'
    when 'aprovada' then 'Sua solicitação foi aprovada.'
    when 'agendada' then 'Sua coleta foi encaminhada para a equipe.'
    when 'confirmada' then 'A equipe confirmou a sua coleta.'
    when 'caminhao_a_caminho' then 'O caminhão está a caminho da sua coleta.'
    when 'coletada' then 'Sua coleta foi concluída.'
    when 'recusada' then 'Sua solicitação foi recusada.'
    when 'cancelada' then 'Sua solicitação foi cancelada.'
    else 'Sua solicitação foi atualizada: ' || public.rotulo_status_solicitacao(p_status)
  end;
$$;

create or replace function public.enviar_push_solicitacao(p_cidadao_id uuid, p_solicitacao_id uuid, p_status public.status_solicitacao)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  tokens text[];
  payload jsonb;
begin
  select coalesce(array_agg(expo_push_token), '{}')
    into tokens
  from public.dispositivos_push
  where user_id = p_cidadao_id;

  if coalesce(array_length(tokens, 1), 0) = 0 then
    return;
  end if;

  payload := (
    select jsonb_agg(
      jsonb_build_object(
        'to', t,
        'sound', 'default',
        'title', 'Coleta Eficiente',
        'body', public.mensagem_push_status(p_status),
        'data', jsonb_build_object(
          'solicitacaoId', p_solicitacao_id,
          'status', p_status
        )
      )
    )
    from unnest(tokens) as t
  );

  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := payload,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
end;
$func$;

create or replace function public.registrar_evento_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  ator public.profiles;
  instituicao public.municipios;
  nome_ator text;
  rotulo_ator text;
  local_texto text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select * into ator from public.profiles where id = auth.uid();
  if ator.municipio_id is not null then
    select * into instituicao from public.municipios where id = ator.municipio_id;
  end if;

  if ator.id is null then
    nome_ator := 'Sistema';
    rotulo_ator := 'Sistema';
  elsif coalesce(ator.conta_institucional, false) then
    nome_ator := coalesce(instituicao.nome, ator.nome);
    rotulo_ator := case instituicao.tipo
      when 'cooperativa' then 'Cooperativa'
      when 'prefeitura' then 'Prefeitura'
      else 'Instituição'
    end;
  elsif ator.papel = 'gestor' then
    nome_ator := ator.nome;
    rotulo_ator := case when ator.genero = 'feminino' then 'Cidadã gestora' else 'Cidadão gestor' end;
  elsif ator.genero = 'feminino' then
    nome_ator := ator.nome;
    rotulo_ator := 'Cidadã';
  else
    nome_ator := ator.nome;
    rotulo_ator := 'Cidadão';
  end if;

  local_texto := nullif(
    trim(both ' · ' from concat_ws(
      ' · ',
      new.endereco,
      new.bairro,
      nullif(concat_ws('/', new.cidade, new.uf), '')
    )),
    ''
  );

  insert into public.solicitacao_eventos (
    solicitacao_id, status, ator_id, ator_nome, ator_rotulo, endereco, latitude, longitude
  ) values (
    new.id,
    new.status,
    ator.id,
    nome_ator,
    rotulo_ator,
    local_texto,
    new.latitude,
    new.longitude
  );

  if ator.id is distinct from new.cidadao_id then
    perform public.enviar_push_solicitacao(new.cidadao_id, new.id, new.status);
  end if;

  return new;
end;
$func$;

drop trigger if exists trg_registrar_evento_solicitacao on public.solicitacoes;
create trigger trg_registrar_evento_solicitacao
  after insert or update of status on public.solicitacoes
  for each row execute function public.registrar_evento_solicitacao();

alter table public.solicitacao_eventos enable row level security;
alter table public.dispositivos_push enable row level security;

drop policy if exists "eventos_select" on public.solicitacao_eventos;
create policy "eventos_select" on public.solicitacao_eventos
  for select using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (
          s.cidadao_id = auth.uid()
          or public.gestor_enxerga_solicitacao(s.municipio_id, s.cooperativa_id, s.operador_id)
        )
    )
  );

drop policy if exists "push_select_proprio" on public.dispositivos_push;
create policy "push_select_proprio" on public.dispositivos_push
  for select using (user_id = auth.uid());

drop policy if exists "push_insert_proprio" on public.dispositivos_push;
create policy "push_insert_proprio" on public.dispositivos_push
  for insert with check (user_id = auth.uid());

drop policy if exists "push_update_proprio" on public.dispositivos_push;
create policy "push_update_proprio" on public.dispositivos_push
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_delete_proprio" on public.dispositivos_push;
create policy "push_delete_proprio" on public.dispositivos_push
  for delete using (user_id = auth.uid());

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'Extensão pg_net indisponível; o push pelo banco fica desligado.';
end;
$$;
