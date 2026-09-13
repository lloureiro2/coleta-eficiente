-- Prefeitura = conta institucional (e-mail de acesso), não uma pessoa.
-- Cidadãos vinculados pela Equipe é que são promovidos a gestor.

alter table public.profiles
  add column if not exists conta_institucional boolean not null default false;

-- Contas de cooperativa já existentes são o e-mail da instituição.
update public.profiles p
set conta_institucional = true
from public.municipios m
where m.id = p.municipio_id
  and m.tipo = 'cooperativa';

-- Conta de acesso da prefeitura: o gestor cujo nome não é de um cidadão contratado.
-- Ajusta a conta de teste e qualquer gestor único da prefeitura.
update public.profiles p
set
  conta_institucional = true,
  nome = m.nome
from public.municipios m
where m.id = p.municipio_id
  and m.tipo = 'prefeitura'
  and p.papel = 'gestor'
  and p.email is not null;

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
  if tipo_conta = 'prefeitura' then
    if not public.sou_admin() then
      raise exception 'Prefeitura só pode ser criada pelo admin.';
    end if;

    novo_municipio := nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid;
    nome_conta := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
    if novo_municipio is null or nome_conta is null then
      raise exception 'Informe o município e o nome da prefeitura.';
    end if;
    e_institucional := true;
    papel_inicial := 'gestor';
  elsif tipo_conta = 'cooperativa' then
    nome_conta := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome_cooperativa', new.raw_user_meta_data ->> 'nome', '')), '');
    if nome_conta is null then
      nome_conta := split_part(new.email, '@', 1);
    end if;

    insert into public.municipios (nome, cidade, uf, tipo)
    values (
      nome_conta,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'cidade'), ''), 'A definir'),
      coalesce(nullif(upper(left(trim(coalesce(new.raw_user_meta_data ->> 'uf', '')), 2)), ''), '--'),
      'cooperativa'
    )
    returning id into novo_municipio;

    insert into public.materiais (municipio_id, nome, icone, cor) values
      (novo_municipio, 'Plástico', '🧴', '#2563EB'),
      (novo_municipio, 'Papelão', '📦', '#B45309'),
      (novo_municipio, 'Alumínio', '🥫', '#6B7280'),
      (novo_municipio, 'Vidro', '🍾', '#059669');

    e_institucional := true;
  else
    novo_municipio := nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid;
    nome_conta := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), new.email);
  end if;

  insert into public.profiles (
    id, municipio_id, nome, email, telefone, endereco, bairro, cidade, uf, papel, conta_institucional
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
    e_institucional
  );
  return new;
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
set search_path = public, extensions, auth
as $func$
declare
  novo_municipio uuid;
  novo_usuario uuid := gen_random_uuid();
  email_conta text := lower(trim(p_email));
  nome_pref text := trim(p_nome);
  cidade_pref text := trim(p_cidade);
  uf_pref text := upper(left(trim(p_uf), 2));
begin
  if not public.sou_admin() then
    raise exception 'Só o admin pode criar prefeitura.';
  end if;
  if nome_pref = '' or cidade_pref = '' or uf_pref = '' then
    raise exception 'Preencha nome, cidade e UF.';
  end if;
  if email_conta = '' or position('@' in email_conta) = 0 then
    raise exception 'Informe o e-mail de acesso da prefeitura.';
  end if;
  if char_length(p_senha) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  if exists (select 1 from auth.users where lower(email) = email_conta) then
    raise exception 'Já existe uma conta com este e-mail.';
  end if;

  insert into public.municipios (nome, cidade, uf, tipo)
  values (nome_pref, cidade_pref, uf_pref, 'prefeitura')
  returning id into novo_municipio;

  insert into public.materiais (municipio_id, nome, icone, cor) values
    (novo_municipio, 'Plástico', '🧴', '#2563EB'),
    (novo_municipio, 'Papelão', '📦', '#B45309'),
    (novo_municipio, 'Alumínio', '🥫', '#6B7280'),
    (novo_municipio, 'Vidro', '🍾', '#059669');

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
      'tipo_conta', 'prefeitura',
      'nome', nome_pref,
      'municipio_id', novo_municipio,
      'cidade', cidade_pref,
      'uf', uf_pref
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

grant execute on function public.criar_prefeitura(text, text, text, text, text) to authenticated;

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

-- Equipe não altera a conta de acesso da prefeitura/cooperativa.
drop policy if exists "profiles_update_gestor_equipe" on public.profiles;
create policy "profiles_update_gestor_equipe" on public.profiles
  for update using (
    public.sou_gestor()
    and conta_institucional = false
    and (municipio_id = public.meu_municipio() or municipio_id is null)
  )
  with check (
    public.sou_gestor()
    and conta_institucional = false
    and municipio_id = public.meu_municipio()
    and papel in ('cidadao', 'gestor')
  );
