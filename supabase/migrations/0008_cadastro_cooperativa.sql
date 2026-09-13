-- =============================================================
-- Cooperativa cria a própria conta (sem admin).
-- A prefeitura depois contrata: atrela e promove a gestor.
-- Execute DEPOIS do 0007_prefeitura_cooperativa.sql.
-- =============================================================

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $func$
declare
  novo_municipio uuid;
  tipo_conta text := new.raw_user_meta_data ->> 'tipo_conta';
begin
  if tipo_conta = 'cooperativa' then
    if coalesce(trim(new.raw_user_meta_data ->> 'nome_cooperativa'), '') = ''
       or coalesce(trim(new.raw_user_meta_data ->> 'cidade'), '') = ''
       or coalesce(trim(new.raw_user_meta_data ->> 'uf'), '') = '' then
      raise exception 'Informe nome, cidade e UF da cooperativa.';
    end if;

    insert into public.municipios (nome, cidade, uf, tipo)
    values (
      trim(new.raw_user_meta_data ->> 'nome_cooperativa'),
      trim(new.raw_user_meta_data ->> 'cidade'),
      upper(left(trim(new.raw_user_meta_data ->> 'uf'), 2)),
      'cooperativa'
    )
    returning id into novo_municipio;

    insert into public.materiais (municipio_id, nome, icone, cor) values
      (novo_municipio, 'Plástico', '🧴', '#2563EB'),
      (novo_municipio, 'Papelão', '📦', '#B45309'),
      (novo_municipio, 'Alumínio', '🥫', '#6B7280'),
      (novo_municipio, 'Vidro', '🍾', '#059669');
  else
    novo_municipio := nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid;
  end if;

  insert into public.profiles (id, municipio_id, nome, email, telefone, endereco, bairro, cidade, uf)
  values (
    new.id,
    novo_municipio,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'endereco',
    new.raw_user_meta_data ->> 'bairro',
    new.raw_user_meta_data ->> 'cidade',
    new.raw_user_meta_data ->> 'uf'
  );
  return new;
end;
$func$;

-- Prefeitura encontra cooperativas ainda não contratadas (e-mail/cidade/nome).
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

-- Atrela a cooperativa à prefeitura e promove a conta a gestor.
create or replace function public.contratar_cooperativa(p_profile_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $func$
declare
  alvo public.profiles;
  tipo public.tipo_municipio;
begin
  if not public.sou_gestor_prefeitura() then
    raise exception 'Só a prefeitura pode contratar uma cooperativa.';
  end if;

  select * into alvo from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Pessoa não encontrada.';
  end if;
  if alvo.municipio_id is null then
    raise exception 'Esta conta não é de uma cooperativa.';
  end if;

  select m.tipo into tipo from public.municipios m where m.id = alvo.municipio_id;
  if tipo is distinct from 'cooperativa' then
    raise exception 'Esta conta não é de uma cooperativa.';
  end if;

  insert into public.prefeitura_cooperativas (prefeitura_id, cooperativa_id)
  values (public.meu_municipio(), alvo.municipio_id)
  on conflict do nothing;

  update public.profiles set papel = 'gestor' where id = alvo.id;
end;
$func$;

grant execute on function public.contratar_cooperativa(uuid) to authenticated;
