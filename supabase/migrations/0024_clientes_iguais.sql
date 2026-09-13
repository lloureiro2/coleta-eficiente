-- Prefeitura e cooperativa são clientes iguais:
-- as duas recebem, despacham e coletam com as mesmas regras.

create or replace function public.criar_cooperativa(
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
  return public.criar_contratante(p_nome, p_cidade, p_uf, p_email, p_senha, 'cooperativa');
end;
$func$;

grant execute on function public.criar_cooperativa(text, text, text, text, text) to authenticated;

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
      public.sou_gestor()
      and (
        p_municipio_id = public.meu_municipio()
        or p_cooperativa_id = public.meu_municipio()
      )
    )
    or p_operador_id = auth.uid();
$$;

drop policy if exists "solicitacoes_update_prefeitura" on public.solicitacoes;
drop policy if exists "solicitacoes_update_cooperativa" on public.solicitacoes;
drop policy if exists "solicitacoes_update_cooperativa_dona" on public.solicitacoes;
drop policy if exists "solicitacoes_update_gestor" on public.solicitacoes;

create policy "solicitacoes_update_gestor" on public.solicitacoes
  for update using (
    public.sou_gestor()
    and (
      municipio_id = public.meu_municipio()
      or cooperativa_id = public.meu_municipio()
      or operador_id = auth.uid()
    )
  )
  with check (
    public.sou_gestor()
    and (
      municipio_id = public.meu_municipio()
      or cooperativa_id = public.meu_municipio()
      or operador_id = auth.uid()
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
      public.sou_gestor()
      and (
        p_solicitacao.municipio_id = public.meu_municipio()
        or p_solicitacao.cooperativa_id = public.meu_municipio()
      )
    )
    or p_solicitacao.operador_id = auth.uid();
$$;

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
end;
$func$;
