-- O Supabase passou a gerar auth.identities.email a partir de identity_data.
-- Inserir o e-mail nessa coluna quebra criar_contratante (prefeitura/cooperativa).

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
  email_identidade_gerado boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'email'
      and is_generated = 'ALWAYS'
  );
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

  if email_identidade_gerado then
    insert into auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      novo_usuario::text,
      novo_usuario,
      jsonb_build_object('sub', novo_usuario::text, 'email', email_conta),
      'email',
      now(),
      now(),
      now()
    );
  else
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
  end if;

  return novo_municipio;
end;
$func$;

grant execute on function public.criar_contratante(text, text, text, text, text, public.tipo_municipio) to authenticated;
