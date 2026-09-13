-- Cooperativa passa a ser só a conta do e-mail (sem usuários extras).
-- Nome/cidade/UF da cooperativa deixam de ser obrigatórios no cadastro.

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $func$
declare
  novo_municipio uuid;
  tipo_conta text := new.raw_user_meta_data ->> 'tipo_conta';
  nome_coop text;
begin
  if tipo_conta = 'cooperativa' then
    nome_coop := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome_cooperativa', new.raw_user_meta_data ->> 'nome', '')), '');
    if nome_coop is null then
      nome_coop := split_part(new.email, '@', 1);
    end if;

    insert into public.municipios (nome, cidade, uf, tipo)
    values (
      nome_coop,
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
  else
    novo_municipio := nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid;
  end if;

  insert into public.profiles (id, municipio_id, nome, email, telefone, endereco, bairro, cidade, uf)
  values (
    new.id,
    novo_municipio,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), new.email),
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
