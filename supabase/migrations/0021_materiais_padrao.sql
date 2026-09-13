-- Catálogo completo de materiais coletáveis. Completa os municípios atuais
-- e passa a ser a lista padrão de prefeituras e cooperativas novas.

create or replace function public.popular_materiais_padrao(p_municipio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.materiais (municipio_id, nome, icone, cor)
  select p_municipio_id, v.nome, v.icone, v.cor
  from (
    values
      ('Plástico', '🧴', '#2563EB'),
      ('PET', '🥤', '#0284C7'),
      ('Papel', '📄', '#CA8A04'),
      ('Papelão', '📦', '#B45309'),
      ('Alumínio', '🥫', '#6B7280'),
      ('Metal', '⚙️', '#4B5563'),
      ('Vidro', '🍾', '#059669'),
      ('Embalagem longa vida', '🧃', '#65A30D'),
      ('Isopor', '◻️', '#78716C'),
      ('Eletrônicos', '🔌', '#7C3AED'),
      ('Pilhas e baterias', '🔋', '#DC2626'),
      ('Óleo de cozinha', '🛢️', '#D97706'),
      ('Lâmpadas', '💡', '#F59E0B'),
      ('Orgânico', '🍃', '#16A34A'),
      ('Madeira', '🪵', '#92400E'),
      ('Tecidos', '👕', '#DB2777'),
      ('Entulho', '🧱', '#A8A29E'),
      ('Pneus', '🛞', '#111827'),
      ('Móveis', '🪑', '#9A3412'),
      ('Podas e galhos', '🌿', '#15803D')
  ) as v(nome, icone, cor)
  where not exists (
    select 1
    from public.materiais m
    where m.municipio_id = p_municipio_id
      and lower(m.nome) = lower(v.nome)
  );
end;
$func$;

select public.popular_materiais_padrao(id) from public.municipios;

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

    perform public.popular_materiais_padrao(novo_municipio);

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
